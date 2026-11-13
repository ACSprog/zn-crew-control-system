/**
 * Sign-in, two-step sign-in (2FA) and account access checks.
 *
 * Same design as the Zambia Airways QSA Reporting System, and free on the
 * Spark plan (everything runs in the browser, no Cloud Functions):
 *  - Who may use the system, their role and whether they are blocked comes
 *    from the Firestore profile `users/{uid}` (written by Super Admins /
 *    Admins from User Access), not from token claims, so accounts can be
 *    managed from the browser. firestore.rules enforce the same checks.
 *  - Authenticator-app 2FA (TOTP) through Firebase Authentication with
 *    Identity Platform. Required for everyone (settings/security.require2fa)
 *    or per person (users/{uid}.twoFactor = 'on' | 'off').
 *  - 5 wrong passwords lock the account (signInLocks/{email}) until an
 *    Admin sends a password-reset email.
 *  - Session ends when the browser closes, after inactivity, and after a
 *    maximum session length (see SESSION_LIMITS).
 */
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword as firebaseUpdatePassword,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  EmailAuthProvider,
  setPersistence,
  browserSessionPersistence,
  getMultiFactorResolver,
  multiFactor,
  TotpMultiFactorGenerator,
  type MultiFactorResolver,
  type User,
} from 'firebase/auth';
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getAuditActor, logAudit, logSignInFailure, setAuditActor } from './auditTrail';
import { app, db, isDev, useEmulator } from './firebaseSync';
import type { SystemUser, SystemUserRole } from '../types';

export const auth = getAuth(app);

/** Email of the sign-in in progress (for logging a wrong authenticator code). */
let signInEmailInProgress = '';
/** Set when a password (+ code) sign-in just succeeded, so a page reload isn't logged as a sign-in. */
let freshSignIn = false;

export function takeFreshSignIn(): boolean {
  const was = freshSignIn;
  freshSignIn = false;
  return was;
}

if (useEmulator) {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    console.info('[authService] Connected to local Auth emulator at localhost:9099.');
  } catch (err) {
    console.warn('[authService] Could not connect to Auth emulator, falling back to live Firebase Auth.', err);
  }
}

/** Closing the browser signs the user out; refreshing the page does not. */
const persistenceReady: Promise<void> = setPersistence(auth, browserSessionPersistence).catch((e) =>
  console.warn('[authService] Could not set session-only sign-in:', e)
);

// ---------------------------------------------------------------------------
// Session limits
// ---------------------------------------------------------------------------

function envNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(n, min), max) : fallback;
}

/**
 * VITE_IDLE_MINUTES        sign out after this many minutes without activity (default 15)
 * VITE_MAX_SESSION_HOURS   sign in again after this many hours regardless (default 12, max 12;
 *                          firestore.rules refuse sessions older than 12 hours)
 */
export const SESSION_LIMITS = {
  idleMinutes: envNumber(import.meta.env.VITE_IDLE_MINUTES, 15, 2, 240),
  maxSessionHours: envNumber(import.meta.env.VITE_MAX_SESSION_HOURS, 12, 1, 12),
};

/** When the current session started (last real sign-in), in ms since epoch. */
export async function getSessionStartMs(user: User | null): Promise<number | null> {
  if (!user) return null;
  try {
    const token = await user.getIdTokenResult();
    return token.authTime ? new Date(token.authTime).getTime() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Wrong-password lockout
// ---------------------------------------------------------------------------

export const MAX_SIGNIN_ATTEMPTS = 5;
export const LOCKED_MESSAGE =
  'This account is locked after 5 wrong passwords. Contact a System Admin or Super Admin and ask them to send you a password reset email.';

export interface SignInLock {
  failures: number;
  locked: boolean;
}

export async function getSignInLock(email: string): Promise<SignInLock | null> {
  const id = email.trim().toLowerCase();
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, 'signInLocks', id));
    if (!snap.exists()) return null;
    const d = snap.data() || {};
    return { failures: Number(d.failures) || 0, locked: d.locked === true };
  } catch {
    return null;
  }
}

/** Adds one wrong password to the email's counter; the 5th locks the account. */
async function recordFailedSignIn(email: string): Promise<SignInLock | null> {
  const ref = doc(db, 'signInLocks', email.trim().toLowerCase());
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const cur = snap.exists() ? snap.data() || {} : null;
      if (cur?.locked === true) return { failures: Number(cur.failures) || MAX_SIGNIN_ATTEMPTS, locked: true };
      const failures = (cur ? Number(cur.failures) || 0 : 0) + 1;
      const locked = failures >= MAX_SIGNIN_ATTEMPTS;
      if (!cur) {
        tx.set(ref, { failures, locked: false, lastFailureAt: serverTimestamp() });
      } else {
        tx.update(ref, {
          failures,
          locked,
          lastFailureAt: serverTimestamp(),
          ...(locked ? { lockedAt: serverTimestamp() } : {}),
        });
      }
      return { failures, locked };
    });
  } catch (e) {
    console.warn('[authService] Could not record the failed sign-in:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Temporary-password fingerprint (detects that a new user chose their own)
// ---------------------------------------------------------------------------

/** SHA-256 of uid + temporary password. The temporary password itself is never stored. */
export async function tempPasswordFingerprint(uid: string, password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${uid}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Password typed at the latest sign-in, kept in memory only until access is checked (max 2 min). */
let pendingSignInPassword: { password: string; at: number } | null = null;
function takePendingPassword(): string | null {
  const p = pendingSignInPassword;
  pendingSignInPassword = null;
  return p && Date.now() - p.at < 120_000 ? p.password : null;
}

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------

export interface SignInResult {
  user: User | null;
  error?: string;
  /** Password was right; the 6-digit authenticator code is needed next */
  mfaResolver?: MultiFactorResolver;
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) return { user: null, error: 'Enter both your email and password.' };
  await persistenceReady;
  signInEmailInProgress = cleanEmail;
  if ((await getSignInLock(cleanEmail))?.locked) {
    void logSignInFailure('Sign-in refused', cleanEmail, 'Attempt on a locked account (locked after 5 wrong passwords).');
    return { user: null, error: LOCKED_MESSAGE };
  }
  pendingSignInPassword = { password, at: Date.now() };
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    freshSignIn = true;
    return { user: cred.user };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/multi-factor-auth-required') {
      return { user: null, mfaResolver: getMultiFactorResolver(auth, err as Parameters<typeof getMultiFactorResolver>[1]) };
    }
    pendingSignInPassword = null;
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      const lock = await recordFailedSignIn(cleanEmail);
      if (lock?.locked) {
        void logSignInFailure('Account locked', cleanEmail, `Wrong password; account locked after ${MAX_SIGNIN_ATTEMPTS} wrong passwords.`);
        return { user: null, error: LOCKED_MESSAGE };
      }
      void logSignInFailure(
        'Sign-in failed',
        cleanEmail,
        lock ? `Wrong email or password (${lock.failures} of ${MAX_SIGNIN_ATTEMPTS} before lock-out).` : 'Wrong email or password.'
      );
      const left = lock ? MAX_SIGNIN_ATTEMPTS - lock.failures : null;
      return {
        user: null,
        error:
          left === null
            ? 'Incorrect email or password.'
            : `Incorrect email or password. ${left} attempt${left === 1 ? '' : 's'} left before the account is locked.`,
      };
    }
    const messages: Record<string, string> = {
      'auth/invalid-email': 'That doesn’t look like a valid email address.',
      'auth/user-disabled': 'This account has been disabled. Contact your system administrator.',
      'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
      'auth/network-request-failed': 'Network error — check your connection and try again.',
    };
    return { user: null, error: messages[code] || 'Sign-in failed. Please check your credentials and try again.' };
  }
}

/** Second sign-in step: the 6-digit code from the authenticator app. */
export async function completeMfaSignIn(resolver: MultiFactorResolver, code: string): Promise<SignInResult> {
  const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  if (!hint) return { user: null, error: 'No authenticator app is set up for this account. Contact a Super Admin.' };
  try {
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.replace(/\s/g, ''));
    const cred = await resolver.resolveSignIn(assertion);
    freshSignIn = true;
    return { user: cred.user };
  } catch (err: unknown) {
    const c = (err as { code?: string })?.code || '';
    if (c === 'auth/invalid-verification-code' || c === 'auth/totp-challenge-timeout') {
      void logSignInFailure('Authenticator code rejected', signInEmailInProgress, 'Wrong or expired 6-digit authenticator code.');
      return { user: null, error: 'That code is not right or has expired. Enter the current 6-digit code from your app.' };
    }
    if (c === 'auth/too-many-requests') return { user: null, error: 'Too many attempts. Wait a few minutes and try again.' };
    return { user: null, error: (err as Error)?.message || 'Could not verify the code.' };
  }
}

export async function signOutUser(reason = 'Signed out'): Promise<void> {
  if (getAuditActor()) await logAudit({ area: 'sign-in', action: 'Signed out', details: reason });
  setAuditActor(null);
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * "Forgot password?" on the sign-in page. Refused while the account is locked
 * (an Admin's reset email is what unlocks it).
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if ((await getSignInLock(clean))?.locked) {
    const err = new Error(LOCKED_MESSAGE) as Error & { code?: string };
    err.code = 'app/locked';
    throw err;
  }
  await sendPasswordResetEmail(auth, clean);
}

// ---------------------------------------------------------------------------
// Account access check (runs after every sign-in)
// ---------------------------------------------------------------------------

export interface PendingAdminAction {
  type: 'remove' | 'block' | 'role';
  newRole?: SystemUserRole;
  requestedBy: string;
  requestedByEmail: string;
  requestedAt?: unknown;
}

export interface UserAccess {
  /** Has an active users/{uid} profile */
  allowed: boolean;
  /** Why not allowed, ready to show on the sign-in page */
  deniedReason?: string;
  role: SystemUserRole | null;
  profile: Partial<SystemUser> | null;
  mustChangePassword: boolean;
  /** 2FA is required for this person (everyone setting, unless their own setting says otherwise) */
  require2fa: boolean;
  /** settings/security.require2fa */
  global2fa: boolean;
  /** Per-person setting from a Super Admin */
  twoFactor?: 'on' | 'off';
  twoFactorEnrolled: boolean;
  pendingAction?: PendingAdminAction;
}

/** Is 2FA required for this person? Their own setting wins over the everyone setting. */
export function effectiveRequire2fa(global2fa: boolean, twoFactor?: 'on' | 'off'): boolean {
  return twoFactor === 'on' || (global2fa && twoFactor !== 'off');
}

const VALID_ROLES: SystemUserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'OCC_CONTROLLER',
  'SCHEDULER',
  'CHIEF_PILOT',
  'AUDITOR',
  'FLIGHT_CREW',
  'PILOT_CABIN',
];

export const BLOCKED_MESSAGE = 'Your account has been blocked. Contact a System Admin if you think this is a mistake.';

export async function verifyUserAccess(user: User): Promise<UserAccess> {
  const denied = (deniedReason: string): UserAccess => {
    setAuditActor(null);
    void logSignInFailure('Sign-in refused', user.email || '', deniedReason);
    return deniedAccess(deniedReason);
  };
  const deniedAccess = (deniedReason: string): UserAccess => ({
    allowed: false,
    deniedReason,
    role: null,
    profile: null,
    mustChangePassword: false,
    require2fa: false,
    global2fa: false,
    twoFactorEnrolled: false,
  });

  let data: Record<string, unknown>;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) {
      return denied('Access denied: this login has no Crew Control account. Contact your system administrator.');
    }
    data = snap.data() || {};
  } catch {
    return denied('Could not check your account. Check your connection and try again.');
  }

  if ((data.status as string | undefined) && data.status !== 'ACTIVE') return denied(BLOCKED_MESSAGE);
  const role = VALID_ROLES.includes(data.role as SystemUserRole) ? (data.role as SystemUserRole) : null;
  if (!role) return denied('Your account has no valid role. Contact your system administrator.');

  // Locked after 5 wrong passwords (the password may since have been guessed): no access.
  // Otherwise this successful sign-in clears earlier failed attempts.
  if (user.email) {
    const lock = await getSignInLock(user.email);
    if (lock?.locked) return denied(LOCKED_MESSAGE);
    if (lock && lock.failures > 0) {
      await deleteDoc(doc(db, 'signInLocks', user.email.toLowerCase())).catch(() => undefined);
    }
  }

  // Still flagged as using the temporary password? If they just signed in with a
  // different password they already chose their own (e.g. via a reset email).
  let mustChangePassword = data.mustChangePassword === true;
  const typed = takePendingPassword();
  if (mustChangePassword && typed && typeof data.tempPasswordHash === 'string') {
    if ((await tempPasswordFingerprint(user.uid, typed)) !== data.tempPasswordHash) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { mustChangePassword: false, tempPasswordHash: deleteField() });
        mustChangePassword = false;
      } catch (e) {
        console.warn('[authService] Could not clear the temporary-password flag:', e);
      }
    }
  }

  const twoFactor = data.twoFactor === 'on' || data.twoFactor === 'off' ? (data.twoFactor as 'on' | 'off') : undefined;
  let global2fa = false;
  try {
    const sec = await getDoc(doc(db, 'settings', 'security'));
    global2fa = sec.exists() && sec.data()?.require2fa === true;
  } catch {
    global2fa = false;
  }

  const profile = { ...data } as Partial<SystemUser> & Record<string, unknown>;
  delete profile.password;
  delete profile.tempPasswordHash;

  setAuditActor({ uid: user.uid, email: user.email || '', name: String(data.name || user.displayName || ''), role });

  return {
    allowed: true,
    role,
    profile,
    mustChangePassword,
    require2fa: effectiveRequire2fa(global2fa, twoFactor),
    global2fa,
    twoFactor,
    twoFactorEnrolled: data.twoFactorEnrolled === true,
    pendingAction: (data.pendingAction as PendingAdminAction | undefined) || undefined,
  };
}

/**
 * Live view of the signed-in user's own profile: ends the session at once if
 * the account is blocked or removed, and shows Super Admin confirmation
 * requests / 2FA changes straight away.
 */
export function subscribeMyUserRecord(
  uid: string,
  onChange: (state: {
    exists: boolean;
    blocked: boolean;
    pendingAction?: PendingAdminAction;
    twoFactor?: 'on' | 'off';
    role?: SystemUserRole;
  }) => void
): () => void {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      const d = snap.data();
      onChange({
        exists: snap.exists(),
        blocked: !!d && (d.status as string | undefined) !== undefined && d.status !== 'ACTIVE',
        pendingAction: (d?.pendingAction as PendingAdminAction | undefined) || undefined,
        twoFactor: d?.twoFactor === 'on' || d?.twoFactor === 'off' ? d.twoFactor : undefined,
        role: d?.role as SystemUserRole | undefined,
      });
    },
    () => undefined
  );
}

// ---------------------------------------------------------------------------
// Two-step sign-in helpers for the signed-in user
// ---------------------------------------------------------------------------

/** Is the signed-in user enrolled in authenticator-app 2FA? */
export function isEnrolledIn2fa(user: User | null | undefined): boolean {
  if (!user) return false;
  return multiFactor(user).enrolledFactors.some((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
}

/** Did this session sign in with the authenticator code? */
export async function sessionUsed2fa(user: User | null | undefined): Promise<boolean> {
  if (!user) return false;
  try {
    const token = await user.getIdTokenResult();
    return Boolean(token.signInSecondFactor);
  } catch {
    return false;
  }
}

/** Removes the signed-in user's own authenticator app(s) (after a Super Admin switched their 2FA off). */
export async function removeOwnAuthenticator(user: User): Promise<void> {
  const mf = multiFactor(user);
  for (const f of mf.enrolledFactors.filter((x) => x.factorId === TotpMultiFactorGenerator.FACTOR_ID)) {
    await mf.unenroll(f);
  }
}

/** Records on the user's own profile whether they use an authenticator app (for the 2FA ON badge). */
export async function recordMy2faInUse(uid: string, inUse: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), { twoFactorEnrolled: inUse });
  } catch (e) {
    console.warn('[authService] Could not record the 2FA status:', e);
  }
}

/** Records the sign-in time on the user's own profile (shown as "Last login"). */
export async function recordLastLogin(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), { lastLogin: new Date().toISOString() });
  } catch {
    /* older rules: not important */
  }
}

// ---------------------------------------------------------------------------
// Own password
// ---------------------------------------------------------------------------

function passwordError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  const map: Record<string, string> = {
    'auth/wrong-password': 'The current password is incorrect.',
    'auth/invalid-credential': 'The current password is incorrect.',
    'auth/weak-password': 'The new password is too weak.',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/requires-recent-login': 'Please sign out and sign in again, then retry.',
    'auth/multi-factor-auth-required': 'Please sign out and sign in again (with your 2FA code), then retry.',
  };
  return map[code] || (e as Error)?.message || 'Something went wrong.';
}

/** Changes the signed-in user's own password and clears any "must change" flag. */
export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) throw new Error('Use at least 8 characters for the new password.');
  if (newPassword === currentPassword) throw new Error('The new password must be different from the current one.');
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No authenticated user session found.');
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
    await firebaseUpdatePassword(user, newPassword);
  } catch (e) {
    throw new Error(passwordError(e));
  }
  try {
    await updateDoc(doc(db, 'users', user.uid), { mustChangePassword: false, tempPasswordHash: deleteField() });
  } catch {
    /* flag may not exist; the password is changed either way */
  }
}

/** Clears the signed-in user's "must change password" flag without changing the password. */
export async function clearMustChangePassword(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await updateDoc(doc(db, 'users', user.uid), { mustChangePassword: false, tempPasswordHash: deleteField() });
}

// ---------------------------------------------------------------------------
// Login notices carried across a sign-out (e.g. "password changed, sign in again")
// ---------------------------------------------------------------------------

const NOTICE_KEY = 'zn_login_notice';

export function setLoginNotice(text: string, email?: string): void {
  try {
    sessionStorage.setItem(NOTICE_KEY, JSON.stringify({ text, email: email || '' }));
  } catch {
    /* ignore */
  }
}

export function takeLoginNotice(): { text: string; email: string } | null {
  try {
    const raw = sessionStorage.getItem(NOTICE_KEY);
    sessionStorage.removeItem(NOTICE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Kept for older imports
export async function getUserRole(user: User): Promise<SystemUserRole | null> {
  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  const role = snap?.data()?.role as SystemUserRole | undefined;
  return role && VALID_ROLES.includes(role) ? role : null;
}

export { isDev };
