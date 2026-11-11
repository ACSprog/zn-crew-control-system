/**
 * In-app notifications stored in Firestore (`inAppNotifications`), so a
 * message created on the OCC computer actually reaches the crew member's own
 * phone/browser. Previously they were saved only in the sender's browser
 * (localStorage) while being reported as "Delivered".
 *
 * A document is either targeted (targetEmail = crew member's email, lower
 * case) or a broadcast to everyone (targetEmail = null). Security rules let a
 * user read only broadcasts and messages addressed to their own sign-in email,
 * and mark them read by adding their uid to `readBy`.
 */
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseSync';
import { auth } from './authService';
import type { SystemNotification } from '../types';

const COLLECTION = 'inAppNotifications';
const MAX_AGE_DAYS = 60;

export interface InAppNotificationInput {
  /** Recipient's sign-in email; omit/null for a broadcast to all users. */
  targetEmail?: string | null;
  targetCrewId?: string;
  type: SystemNotification['type'];
  title: string;
  message: string;
  flightNumber?: string;
  dutyCode?: SystemNotification['dutyCode'];
  revision?: number;
}

export async function sendInAppNotification(input: InAppNotificationInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    targetEmail: input.targetEmail ? input.targetEmail.trim().toLowerCase() : null,
    targetCrewId: input.targetCrewId || null,
    type: input.type,
    title: input.title,
    message: input.message,
    flightNumber: input.flightNumber || null,
    dutyCode: input.dutyCode || null,
    revision: input.revision ?? null,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.email || 'unknown',
    readBy: [],
  });
  return ref.id;
}

export async function markInAppNotificationRead(id: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await updateDoc(doc(db, COLLECTION, id), { readBy: arrayUnion(uid) });
}

/**
 * Live list of the signed-in user's notifications (their own + broadcasts),
 * newest first, last 60 days.
 */
export function subscribeToMyNotifications(
  onChange: (items: SystemNotification[]) => void
): () => void {
  const user = auth.currentUser;
  if (!user || !user.email) {
    onChange([]);
    return () => {};
  }
  const email = user.email.toLowerCase();
  const uid = user.uid;
  const mine = new Map<string, SystemNotification>();
  const broadcast = new Map<string, SystemNotification>();

  const toItem = (id: string, d: Record<string, unknown>): SystemNotification => {
    const ts = d.createdAt instanceof Timestamp ? d.createdAt.toDate() : new Date();
    return {
      id,
      targetCrewId: (d.targetCrewId as string) || undefined,
      type: d.type as SystemNotification['type'],
      title: String(d.title || ''),
      message: String(d.message || ''),
      timestamp: ts.toISOString(),
      read: Array.isArray(d.readBy) && (d.readBy as string[]).includes(uid),
      flightNumber: (d.flightNumber as string) || undefined,
      dutyCode: (d.dutyCode as SystemNotification['dutyCode']) || undefined,
      revision: (d.revision as number) ?? undefined,
    };
  };

  const emit = () => {
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 3600 * 1000;
    const all = [...mine.values(), ...broadcast.values()]
      .filter((n) => new Date(n.timestamp).getTime() >= cutoff)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .slice(0, 100);
    onChange(all);
  };

  const listen = (q: ReturnType<typeof query>, target: Map<string, SystemNotification>) =>
    onSnapshot(
      q,
      (snap) => {
        target.clear();
        snap.forEach((d) => target.set(d.id, toItem(d.id, d.data() as Record<string, unknown>)));
        emit();
      },
      (err) => console.warn('[InAppNotifications] listener error:', err)
    );

  const unsubMine = listen(query(collection(db, COLLECTION), where('targetEmail', '==', email)), mine);
  const unsubBroadcast = listen(query(collection(db, COLLECTION), where('targetEmail', '==', null)), broadcast);
  return () => {
    unsubMine();
    unsubBroadcast();
  };
}
