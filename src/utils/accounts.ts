/**
 * User account management from the browser (free Spark plan, no server).
 * Ported from the Zambia Airways QSA Reporting System.
 *
 * Who can do what (also enforced by firestore.rules):
 *  - SUPER_ADMIN: manage everyone. Changes to ANOTHER Super Admin (remove,
 *    block, change role) are only *requested*; that Super Admin must approve.
 *  - ADMIN: manage everyone below Admin (not Admins or Super Admins).
 *  - Nobody can change their own role, status or 2FA setting.
 *
 * New logins are created through a second, isolated Firebase Auth instance so
 * the signed-in admin is not logged out. Each new user gets a random
 * temporary password, emailed through the Power Automate gateway when it is
 * set up (otherwise Firebase emails a "set your password" link), and must
 * choose their own password at first sign-in.
 *
 * Deleting a Firebase login or setting someone else's password needs the
 * Admin SDK (Cloud Functions = paid plan), so "Remove" removes all access
 * (the users/{uid} profile) and existing users get a password-reset email.
 */
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, firebaseWebConfig, useEmulator } from './firebaseSync';
import { auth, tempPasswordFingerprint, type PendingAdminAction } from './authService';
import { sendViaPowerAutomate, loadPowerAutomateConfig, isPowerAutomateConfigured } from './powerAutomateGateway';
import type { SystemUser, SystemUserPermissions, SystemUserRole } from '../types';

export const ROLE_LABELS: Record<SystemUserRole, string> = {
  SUPER_ADMIN: 'Super Admin / IT',
  ADMIN: 'System Admin',
  OCC_CONTROLLER: 'OCC Controller',
  SCHEDULER: 'Crew Scheduler',
  CHIEF_PILOT: 'Chief Pilot / Line Mgt',
  AUDITOR: 'Safety Auditor',
  FLIGHT_CREW: 'Flight Crew (Self-Service)',
  PILOT_CABIN: 'Flight Crew',
};

const JUNIOR_ROLES: SystemUserRole[] = ['OCC_CONTROLLER', 'SCHEDULER', 'CHIEF_PILOT', 'AUDITOR', 'FLIGHT_CREW', 'PILOT_CABIN'];

/** Roles `myRole` may give to others. */
export function assignableRoles(myRole: SystemUserRole | null | undefined): SystemUserRole[] {
  if (myRole === 'SUPER_ADMIN') return ['SUPER_ADMIN', 'ADMIN', ...JUNIOR_ROLES];
  if (myRole === 'ADMIN') return [...JUNIOR_ROLES];
  return [];
}

/** Whether `me` may change, block or remove `target` (never themselves). */
export function canManageAccount(me: SystemUser | null | undefined, target: SystemUser): boolean {
  if (!me || me.id === target.id) return false;
  if (me.role === 'SUPER_ADMIN') return true;
  if (me.role === 'ADMIN') return JUNIOR_ROLES.includes(target.role);
  return false;
}

export function canManageUsers(me: SystemUser | null | undefined): boolean {
  return me?.role === 'SUPER_ADMIN' || me?.role === 'ADMIN';
}

/** Changes to another Super Admin go through their confirmation. */
export function needsConfirmation(target: SystemUser): boolean {
  return target.role === 'SUPER_ADMIN';
}

export function friendlyAccountError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  const map: Record<string, string> = {
    'auth/email-already-in-use':
      'This email already has a login. If they should have access, ask a Super Admin to restore their account, or remove the old login in Firebase console → Authentication.',
    'auth/invalid-email': 'That email address is not valid.',
    'auth/operation-not-allowed': 'Email/Password sign-in is not turned on for this Firebase project.',
    'auth/weak-password': 'The password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'permission-denied':
      'Permission denied. Admins can only manage roles below Admin, Super Admins manage everyone, nobody can change their own account, and the latest firestore.rules must be deployed.',
  };
  return map[code] || (e as Error)?.message || 'Something went wrong.';
}

/** Readable temporary password: no look-alike characters (0/O, 1/l/I). */
export function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%*?';
  const all = upper + lower + digits;
  const pick = (set: string, n: number) => {
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => set[b % set.length]).join('');
  };
  const chars = (pick(upper, 2) + pick(lower, 2) + pick(digits, 2) + pick(symbols, 1) + pick(all, 5)).split('');
  const bytes = new Uint8Array(chars.length);
  crypto.getRandomValues(bytes);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'ZA'
  );
}

export interface NewAccountInput {
  name: string;
  email: string;
  staffNumber: string;
  role: SystemUserRole;
  department: string;
  base: string;
  permissions: SystemUserPermissions;
}

export interface AddAccountResult {
  uid: string;
  tempPassword: string;
  /** How the new user was told: company mailbox (Power Automate), Firebase link, or not at all */
  emailVia: 'outlook' | 'firebase' | 'none';
  emailError?: string;
}

async function sendWelcomeEmail(input: NewAccountInput, tempPassword: string, invitedBy: string) {
  const cfg = await loadPowerAutomateConfig();
  if (!isPowerAutomateConfigured(cfg)) return { sent: false as const };
  const loginUrl = window.location.origin;
  const text = [
    `Hello ${input.name},`,
    '',
    `A Zambia Airways Crew Control account has been created for you by ${invitedBy}.`,
    `Role: ${ROLE_LABELS[input.role]}`,
    '',
    `Sign in at: ${loginUrl}`,
    `Email: ${input.email}`,
    `Temporary password: ${tempPassword}`,
    '',
    'You will be asked to choose your own password when you first sign in.',
  ].join('\n');
  const html = text
    .split('\n')
    .map((l) => (l ? `<p style="margin:0 0 6px">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>` : '<br/>'))
    .join('');
  const r = await sendViaPowerAutomate({
    kind: 'NOTIFICATION',
    channel: 'EMAIL',
    to: input.email,
    recipientName: input.name,
    subject: 'Your Zambia Airways Crew Control login',
    textBody: text,
    htmlBody: html,
    priority: 'HIGH',
  });
  return { sent: r.success, error: r.success ? undefined : r.message };
}

/** Creates the login (temporary password), the profile, and tells the user. */
export async function addAccount(input: NewAccountInput, invitedBy: string): Promise<AddAccountResult> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Enter a valid email address.');
  const tempPassword = generateTempPassword();

  // Isolated Auth instance: creating a user would otherwise sign the admin out.
  let uid = '';
  const secondaryApp = initializeApp(firebaseWebConfig, `account-admin-${Date.now()}`);
  try {
    const secondaryAuth = initializeAuth(secondaryApp, { persistence: inMemoryPersistence });
    if (useEmulator) connectAuthEmulator(secondaryAuth, 'http://localhost:9099', { disableWarnings: true });
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
    uid = cred.user.uid;
    await signOut(secondaryAuth);
  } catch (e) {
    throw new Error(friendlyAccountError(e));
  } finally {
    await deleteApp(secondaryApp).catch(() => undefined);
  }

  try {
    await setDoc(doc(db, 'users', uid), {
      id: uid,
      name: input.name.trim(),
      email,
      staffNumber: input.staffNumber.trim(),
      role: input.role,
      department: input.department,
      base: input.base,
      status: 'ACTIVE',
      avatarInitials: initials(input.name),
      permissions: input.permissions,
      mustChangePassword: true,
      tempPasswordHash: await tempPasswordFingerprint(uid, tempPassword),
      createdAt: serverTimestamp(),
      createdBy: invitedBy,
    });
  } catch (e) {
    throw new Error(
      `${friendlyAccountError(e)} (The login ${email} was created but has no Crew Control access yet. UID: ${uid})`
    );
  }

  const welcome = await sendWelcomeEmail({ ...input, email }, tempPassword, invitedBy).catch((e) => ({
    sent: false as const,
    error: (e as Error)?.message,
  }));
  if (welcome.sent) return { uid, tempPassword, emailVia: 'outlook' };
  try {
    await sendPasswordResetEmail(auth, email);
    return { uid, tempPassword, emailVia: 'firebase', emailError: welcome.error };
  } catch (e) {
    return { uid, tempPassword, emailVia: 'none', emailError: friendlyAccountError(e) };
  }
}

/** Profile fields any manager may edit (not security-relevant). */
export interface ProfileChanges {
  name: string;
  staffNumber: string;
  department: string;
  base: string;
}

/** Edits name/department/etc. and, if allowed, role + permissions. */
export async function updateAccount(
  target: SystemUser,
  changes: ProfileChanges & { role: SystemUserRole; permissions: SystemUserPermissions }
): Promise<void> {
  const ref = doc(db, 'users', target.id);
  const profile = {
    name: changes.name.trim(),
    staffNumber: changes.staffNumber.trim(),
    department: changes.department,
    base: changes.base,
    avatarInitials: initials(changes.name),
  };
  try {
    if (target.role === 'SUPER_ADMIN') {
      // Role/permission changes to a Super Admin go through requestSuperAdminAction()
      await updateDoc(ref, profile);
    } else {
      await updateDoc(ref, { ...profile, role: changes.role, permissions: changes.permissions });
    }
  } catch (e) {
    throw new Error(friendlyAccountError(e));
  }
}

/** Block (access stops immediately, user stays listed) or unblock. */
export async function setAccountBlocked(target: SystemUser, blocked: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', target.id), { status: blocked ? 'INACTIVE' : 'ACTIVE' });
  } catch (e) {
    throw new Error(friendlyAccountError(e));
  }
}

/** Super Admin: start ('on') or stop ('off') two-step sign-in for one person. */
export async function setAccountTwoFactor(target: SystemUser, mode: 'on' | 'off'): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', target.id), { twoFactor: mode });
  } catch (e) {
    if ((e as { code?: string })?.code === 'permission-denied') {
      throw new Error(
        `Permission denied. Only Super Admins can start or stop 2FA, and not on their own account. If you are a Super Admin, the latest security rules aren't deployed yet: run  npm run setup  in the project folder.`
      );
    }
    throw new Error(friendlyAccountError(e));
  }
}

/** Removes all access (the login itself stays; deleting it needs a server). */
export async function removeAccount(target: SystemUser): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', target.id));
  } catch (e) {
    throw new Error(friendlyAccountError(e));
  }
}

/** Emails the user a password-reset link; also unlocks them after 5 wrong passwords. Returns true if it was locked. */
export async function sendAccountPasswordReset(email: string): Promise<boolean> {
  const clean = email.trim().toLowerCase();
  let wasLocked = false;
  const ref = doc(db, 'signInLocks', clean);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      wasLocked = snap.data()?.locked === true;
      await deleteDoc(ref);
    }
  } catch (e) {
    if (wasLocked) throw new Error(`Could not unlock the account: ${friendlyAccountError(e)}`);
  }
  try {
    await sendPasswordResetEmail(auth, clean);
  } catch (e) {
    throw new Error(friendlyAccountError(e));
  }
  return wasLocked;
}

/** Wrong-password status for each email (admins only). */
export async function loadSignInLocks(emails: string[]): Promise<Record<string, { failures: number; locked: boolean }>> {
  const out: Record<string, { failures: number; locked: boolean }> = {};
  await Promise.all(
    emails
      .filter(Boolean)
      .map((e) => e.trim().toLowerCase())
      .map(async (e) => {
        try {
          const snap = await getDoc(doc(db, 'signInLocks', e));
          if (snap.exists()) {
            const d = snap.data() || {};
            out[e] = { failures: Number(d.failures) || 0, locked: d.locked === true };
          }
        } catch {
          /* ignore */
        }
      })
  );
  return out;
}

// ---------------------------------------------------------------------------
// Require 2FA for everyone (Super Admins)
// ---------------------------------------------------------------------------

export async function getRequire2fa(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'security'));
    return snap.exists() && snap.data()?.require2fa === true;
  } catch {
    return false;
  }
}

/**
 * Switches 2FA ON for everyone. Only allowed from a session that itself used
 * 2FA, which proves authenticator codes work before everyone depends on them.
 * Switching it off for everyone is an emergency command (npm run 2fa:relax).
 */
export async function enableRequire2fa(byEmail: string): Promise<void> {
  const token = await auth.currentUser?.getIdTokenResult();
  if (!token?.signInSecondFactor) {
    throw new Error(
      'Set up 2FA on your own account first (your name, top right → Two-Step Sign-In), then sign out and back in with your code.'
    );
  }
  try {
    await setDoc(
      doc(db, 'settings', 'security'),
      { require2fa: true, updatedBy: byEmail, updatedAt: serverTimestamp() },
      { merge: true } // keep the Test Mode settings
    );
  } catch (e) {
    throw new Error(friendlyAccountError(e));
  }
}

/** The command the project owner runs to remove someone's lost authenticator (free plan). */
export function reset2faCommand(email: string): string {
  return `npm run reset-2fa -- --email ${email}`;
}

// ---------------------------------------------------------------------------
// Two-person rule for Super Admin accounts
// ---------------------------------------------------------------------------

export function describePendingAction(pa: PendingAdminAction, whose: 'your' | 'their' = 'their'): string {
  if (pa.type === 'remove') return `remove ${whose} Super Admin account`;
  if (pa.type === 'block') return `block ${whose} account`;
  return `change ${whose} role to ${ROLE_LABELS[pa.newRole || 'ADMIN']}`;
}

/** Super Admin: ask another Super Admin to confirm removing / blocking / changing their role. */
export async function requestSuperAdminAction(
  target: SystemUser,
  type: PendingAdminAction['type'],
  newRole: SystemUserRole | undefined,
  me: { uid: string; email: string }
): Promise<void> {
  const pendingAction: Record<string, unknown> = {
    type,
    requestedBy: me.uid,
    requestedByEmail: me.email,
    requestedAt: serverTimestamp(),
  };
  if (type === 'role') pendingAction.newRole = newRole;
  try {
    await updateDoc(doc(db, 'users', target.id), { pendingAction });
  } catch (e) {
    throw new Error(
      (e as { code?: string })?.code === 'permission-denied'
        ? 'Permission denied. Another Super Admin may already have a request waiting for this person, or the latest firestore.rules are not deployed.'
        : friendlyAccountError(e)
    );
  }
}

/** Super Admin: withdraw your own request. */
export async function cancelSuperAdminAction(target: SystemUser): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', target.id), { pendingAction: deleteField() });
  } catch (e) {
    throw new Error(friendlyAccountError(e));
  }
}

/** The Super Admin concerned: approve or decline a request about their own account. */
export async function answerMyPendingAction(pa: PendingAdminAction, approve: boolean): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const ref = doc(db, 'users', uid);
  try {
    if (!approve) {
      await updateDoc(ref, { pendingAction: deleteField() });
      return;
    }
    const batch = writeBatch(db);
    if (pa.type === 'remove') batch.delete(ref);
    else if (pa.type === 'block') batch.update(ref, { status: 'INACTIVE', pendingAction: deleteField() });
    else batch.update(ref, { role: pa.newRole, pendingAction: deleteField() });
    await batch.commit();
  } catch (e) {
    throw new Error(friendlyAccountError(e));
  }
}

/** The signed-in user editing their own display details (not role, status, email or staff number). */
export async function updateOwnProfile(
  uid: string,
  changes: { name: string; department: string; base: string; staffNumber?: string }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      name: changes.name.trim(),
      department: changes.department,
      base: changes.base,
      avatarInitials: initials(changes.name),
      // Staff accounts may set their own staff number; crew logins can't
      // (the crew portal is matched on it). Enforced by firestore.rules.
      ...(changes.staffNumber !== undefined ? { staffNumber: changes.staffNumber.trim() } : {}),
    });
  } catch (e) {
    throw new Error(friendlyAccountError(e));
  }
}
