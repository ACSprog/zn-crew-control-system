/**
 * Test Mode: while a Super Admin has it switched on, anyone with an allowed
 * email address can create their own Crew Control login from the sign-in
 * page (no admin needed), so a group of testers can get in quickly.
 *
 * Safeguards (also enforced by firestore.rules):
 *  - Only while settings/security.testMode is true.
 *  - Only emails ending in settings/security.testSignupDomain (if set).
 *  - Self-registered accounts can't be Super Admin or System Admin and are
 *    marked testAccount: true, shown with a TEST badge in User Access.
 *  - Switching Test Mode off stops new sign-ups; "Remove all test accounts"
 *    removes their access in one go.
 */
import { createUserWithEmailAndPassword, deleteUser, updateProfile } from 'firebase/auth';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebaseSync';
import { auth, holdAccessCheckUntil } from './authService';
import type { SystemUser, SystemUserRole } from '../types';
import { defaultPermissionsForRole } from './permissions';

export interface TestModeSettings {
  testMode: boolean;
  /** e.g. "zambiaairways.co.zm"; empty = any email address */
  testSignupDomain: string;
}

export const DEFAULT_TEST_DOMAIN = 'zambiaairways.co.zm';

/** Roles testers may pick for themselves (never Super Admin / System Admin). */
export const TEST_SIGNUP_ROLES: Array<{ role: SystemUserRole; label: string }> = [
  { role: 'OCC_CONTROLLER', label: 'OCC Controller / Duty Officer' },
  { role: 'SCHEDULER', label: 'Crew Scheduler' },
  { role: 'CHIEF_PILOT', label: 'Chief Pilot / Line Management' },
  { role: 'AUDITOR', label: 'Safety Auditor (read-only)' },
  { role: 'PILOT_CABIN', label: 'Flight Crew (own roster only)' },
];

/** Read without signing in (the sign-in page needs it). */
export async function getTestModeSettings(): Promise<TestModeSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'security'));
    const d = snap.exists() ? snap.data() || {} : {};
    return {
      testMode: d.testMode === true,
      testSignupDomain: typeof d.testSignupDomain === 'string' ? d.testSignupDomain : DEFAULT_TEST_DOMAIN,
    };
  } catch {
    return { testMode: false, testSignupDomain: DEFAULT_TEST_DOMAIN };
  }
}

/** Super Admin: switch Test Mode on/off and set which email domain may sign up. */
export async function setTestMode(on: boolean, domain: string, byEmail: string): Promise<void> {
  const clean = domain.trim().toLowerCase().replace(/^@/, '');
  if (clean && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) throw new Error('Enter a domain like zambiaairways.co.zm (or leave it empty for any email).');
  try {
    await setDoc(
      doc(db, 'settings', 'security'),
      { testMode: on, testSignupDomain: clean, updatedBy: byEmail, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    if ((e as { code?: string })?.code === 'permission-denied') {
      throw new Error('Permission denied. Only Super Admins can change Test Mode, and the latest rules must be deployed (npm run setup).');
    }
    throw e;
  }
}

export interface TestSignupInput {
  name: string;
  email: string;
  password: string;
  staffNumber: string;
  department: string;
  role: SystemUserRole;
}

function friendlySignupError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'This email already has a login. Use "Sign in", or "Forgot password?" if you don’t know the password.',
    'auth/invalid-email': 'That email address is not valid.',
    'auth/weak-password': 'Choose a stronger password (at least 8 characters with letters and a number).',
    'auth/operation-not-allowed': 'Email/password sign-in is not switched on for this project.',
    'auth/network-request-failed': 'Network error — check your connection and try again.',
    'permission-denied': 'Test sign-up is closed (Test Mode is off or your email domain is not allowed).',
  };
  return map[code] || (e as Error)?.message || 'Could not create the account.';
}

/**
 * Creates the tester's login and their profile, leaving them signed in.
 * If the profile can't be saved (Test Mode just switched off, wrong domain),
 * the new login is deleted again so nothing is left half-made.
 */
export async function registerTestAccount(input: TestSignupInput, settings: TestModeSettings): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!settings.testMode) throw new Error('Test sign-up is closed.');
  if (!name) throw new Error('Enter your full name.');
  if (settings.testSignupDomain && !email.endsWith(`@${settings.testSignupDomain}`)) {
    throw new Error(`Use your @${settings.testSignupDomain} email address.`);
  }
  if (input.password.length < 8 || !/[a-z]/i.test(input.password) || !/\d/.test(input.password)) {
    throw new Error('Use at least 8 characters for the password, with letters and a number.');
  }
  if (!TEST_SIGNUP_ROLES.some((r) => r.role === input.role)) throw new Error('Choose a role.');

  let finish: () => void = () => undefined;
  holdAccessCheckUntil(new Promise<void>((resolve) => (finish = resolve)));
  try {
    return await createLoginAndProfile(input, email, name);
  } finally {
    finish();
  }
}

async function createLoginAndProfile(input: TestSignupInput, email: string, name: string): Promise<void> {
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, input.password);
  } catch (e) {
    throw new Error(friendlySignupError(e));
  }
  const uid = cred.user.uid;
  try {
    await updateProfile(cred.user, { displayName: name }).catch(() => undefined);
    const profile: Partial<SystemUser> & Record<string, unknown> = {
      id: uid,
      name,
      email,
      staffNumber: input.staffNumber.trim(),
      role: input.role,
      department: input.department.trim() || 'Testing',
      base: 'LUN',
      status: 'ACTIVE',
      avatarInitials:
        name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((p) => p[0].toUpperCase())
          .join('') || 'T',
      permissions: defaultPermissionsForRole(input.role),
      testAccount: true,
      createdAt: serverTimestamp(),
      createdBy: 'self (Test Mode)',
    };
    await setDoc(doc(db, 'users', uid), profile);
  } catch (e) {
    await deleteUser(cred.user).catch(() => undefined);
    throw new Error(friendlySignupError(e));
  }
}

/** Removes Crew Control access for every self-registered test account. */
export async function removeAllTestAccounts(users: Array<SystemUser & { testAccount?: boolean }>, myUid: string): Promise<number> {
  const targets = users.filter((u) => u.testAccount === true && u.id !== myUid);
  let removed = 0;
  for (const u of targets) {
    try {
      await deleteDoc(doc(db, 'users', u.id));
      removed++;
    } catch {
      /* skip ones this admin may not remove */
    }
  }
  return removed;
}
