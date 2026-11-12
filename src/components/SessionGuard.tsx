import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import type { User } from 'firebase/auth';
import { SESSION_LIMITS, getSessionStartMs } from '../utils/authService';

/** Last activity time, shared by all tabs in this browser so working in one keeps the others alive. */
const LAST_ACTIVITY_KEY = 'zn_crew_last_activity';
const WARNING_SECONDS = 60;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

export function markActivity() {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    /* private mode etc.: the in-memory timer still works */
  }
}

export function clearActivity() {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    /* ignore */
  }
}

function readLastActivity(): number {
  try {
    return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Signs the user out after SESSION_LIMITS.idleMinutes without activity (with
 * a 60-second warning) and after SESSION_LIMITS.maxSessionHours since they
 * signed in, even if active.
 */
export const SessionGuard: React.FC<{ user: User | null; onExpire: (message: string) => void }> = ({ user, onExpire }) => {
  const idleMs = SESSION_LIMITS.idleMinutes * 60_000;
  const maxMs = SESSION_LIMITS.maxSessionHours * 3_600_000;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const localLast = useRef(0);
  const sessionStart = useRef<number | null>(null);
  const expired = useRef(false);

  const expire = useCallback(
    (message: string) => {
      if (expired.current) return;
      expired.current = true;
      setSecondsLeft(null);
      onExpire(message);
    },
    [onExpire]
  );

  const touch = useCallback(() => {
    localLast.current = Date.now();
    markActivity();
  }, []);

  useEffect(() => {
    if (!user) return;
    expired.current = false;
    const stored = readLastActivity();
    if (stored && Date.now() - stored >= idleMs) {
      expire(`You were signed out after ${SESSION_LIMITS.idleMinutes} minutes without activity.`);
      return;
    }
    touch();
    getSessionStartMs(user).then((ms) => {
      sessionStart.current = ms;
    });

    let lastWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite < 5000) return;
      lastWrite = now;
      touch();
    };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true, capture: true }));

    const timer = window.setInterval(() => {
      const now = Date.now();
      if (sessionStart.current && now - sessionStart.current >= maxMs) {
        expire(`Your session reached the ${SESSION_LIMITS.maxSessionHours}-hour limit. Please sign in again.`);
        return;
      }
      const idle = now - Math.max(localLast.current, readLastActivity());
      if (idle >= idleMs) {
        expire(`You were signed out after ${SESSION_LIMITS.idleMinutes} minutes without activity.`);
      } else if (idle >= idleMs - WARNING_SECONDS * 1000) {
        setSecondsLeft(Math.ceil((idleMs - idle) / 1000));
      } else {
        setSecondsLeft(null);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity, { capture: true }));
    };
  }, [user, idleMs, maxMs, expire, touch]);

  if (secondsLeft === null) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-[#2E2C2B] text-white p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F37C1C]/20 border border-[#F37C1C]/40 text-[#F37C1C] flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Are you still there?</h3>
            <p className="text-[11px] text-slate-300">Inactive session</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-700">
            For security you'll be signed out in <strong className="font-mono">{secondsLeft}s</strong>. Unsaved changes are
            kept on this device.
          </p>
          <button
            type="button"
            autoFocus
            onClick={() => {
              touch();
              setSecondsLeft(null);
            }}
            className="w-full px-4 py-2.5 bg-[#F37C1C] hover:bg-[#D96B12] text-white text-xs font-bold rounded-xl transition-colors shadow-md"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
};
