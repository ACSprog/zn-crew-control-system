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
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { app, db, isDev, useEmulator } from './firebaseSync';
import { SystemUser, SystemUserRole } from '../types';

export const auth = getAuth(app);

if (useEmulator) {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    console.info('[authService] Connected to local Auth emulator at localhost:9099.');
  } catch (err) {
    console.warn('[authService] Could not connect to Auth emulator, falling back to live Firebase Auth.', err);
  }
}

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  await credential.user.getIdTokenResult(true);
  return credential.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function getUserRole(user: User): Promise<SystemUserRole | null> {
  const tokenResult = await user.getIdTokenResult();
  const role = tokenResult.claims.role as SystemUserRole | undefined;
  return role || null;
}

export async function loadUserProfile(user: User): Promise<Partial<SystemUser> | null> {
  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<SystemUser>;
  delete (data as Record<string, unknown>).password;
  return data;
}

/**
 * Sends a Firebase Auth password-reset email to the given address. Used
 * both by an admin resetting someone else's password (from User
 * Management) and by the "Forgot password?" link on the login screen.
 * In the local emulator this doesn't send a real email — open the Auth
 * emulator UI (localhost:4001 → Authentication) to retrieve the test
 * reset link for a given account.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('No authenticated user session found.');
  }
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await firebaseUpdatePassword(user, newPassword);
}

export { isDev };