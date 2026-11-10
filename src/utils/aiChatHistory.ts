import {
  collection,
  addDoc,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db, sanitizeForFirestore } from './firebaseSync';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  createdAt: string;
  verifiedByEngine?: boolean;
}

function sessionsCol(uid: string) {
  return collection(db, 'aiChatSessions', uid, 'sessions');
}

function messagesCol(uid: string, sessionId: string) {
  return collection(db, 'aiChatSessions', uid, 'sessions', sessionId, 'messages');
}

/** Creates a new, empty chat session and returns its id. */
export async function createChatSession(uid: string): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(sessionsCol(uid), { title: 'New Chat', createdAt: now, updatedAt: now });
  return ref.id;
}

/** Live-subscribes to a user's list of chat sessions, most recently active first. */
export function subscribeChatSessions(uid: string, callback: (sessions: ChatSession[]) => void): () => void {
  const q = query(sessionsCol(uid), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: ChatSession[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as Omit<ChatSession, 'id'>) }));
      callback(items);
    },
    (err) => console.warn('[aiChatHistory] Sessions sync notice:', err)
  );
}

/** Live-subscribes to one session's messages, oldest first. */
export function subscribeSessionMessages(
  uid: string,
  sessionId: string,
  callback: (messages: StoredChatMessage[]) => void
): () => void {
  const q = query(messagesCol(uid, sessionId), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: StoredChatMessage[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as Omit<StoredChatMessage, 'id'>) }));
      callback(items);
    },
    (err) => console.warn('[aiChatHistory] Messages sync notice:', err)
  );
}

/**
 * Saves a message to a session. On a session's first user message, also
 * sets the session's title to a short preview of it (Claude-style
 * auto-titling) and always bumps updatedAt so the sidebar re-sorts by
 * most-recently-active.
 */
export async function saveSessionMessage(
  uid: string,
  sessionId: string,
  sender: 'user' | 'assistant',
  text: string,
  verifiedByEngine = false,
  isFirstUserMessage = false
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await addDoc(messagesCol(uid, sessionId), sanitizeForFirestore({ sender, text, verifiedByEngine, createdAt: now }));
    const sessionUpdate: Record<string, unknown> = { updatedAt: now };
    if (isFirstUserMessage) {
      sessionUpdate.title = text.length > 48 ? text.slice(0, 48) + '…' : text;
    }
    await setDoc(doc(db, 'aiChatSessions', uid, 'sessions', sessionId), sessionUpdate, { merge: true });
  } catch (err) {
    console.warn('[aiChatHistory] Failed to persist message:', err);
  }
}

/** Permanently deletes one chat session and every message inside it. */
export async function deleteChatSession(uid: string, sessionId: string): Promise<void> {
  const snap = await getDocs(messagesCol(uid, sessionId));
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'aiChatSessions', uid, 'sessions', sessionId));
  await batch.commit();
}