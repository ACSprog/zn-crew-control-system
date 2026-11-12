import React, { useState } from 'react';
import { KeyRound, Lock, Loader2, LogOut, Check, X } from 'lucide-react';
import { changeOwnPassword, clearMustChangePassword, setLoginNotice } from '../utils/authService';
import {
  AuthFrame,
  AuthHeading,
  AuthAlert,
  authInputClass,
  authPrimaryButtonClass,
  authSecondaryButtonClass,
  authLabelClass,
} from './AuthFrame';

export function checkPassword(pw: string, repeat: string) {
  const checks = [
    { label: 'At least 8 characters', ok: pw.length >= 8, required: true },
    { label: 'Contains a letter and a number', ok: /[a-z]/i.test(pw) && /\d/.test(pw), required: true },
    { label: 'Upper and lower case letters', ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), required: false },
    { label: 'A symbol (e.g. ! @ # ?)', ok: /[^a-z0-9]/i.test(pw), required: false },
    { label: 'Both passwords match', ok: pw.length > 0 && pw === repeat, required: true },
  ];
  return { checks, acceptable: checks.every((c) => !c.required || c.ok) };
}

/** Shown after a user signs in with the temporary password from their welcome email. */
export const FirstLoginPasswordChange: React.FC<{
  email: string;
  onPasswordChanged: () => void;
  onSkipped: () => void;
  onSignOut: () => void;
}> = ({ email, onPasswordChanged, onSkipped, onSignOut }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { checks, acceptable } = checkPassword(next, next2);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!acceptable) {
      setError('Please meet the required items in the checklist.');
      return;
    }
    setBusy(true);
    try {
      await changeOwnPassword(current, next);
      setLoginNotice('Your password has been changed. Sign in with your new password.', email);
      onPasswordChanged();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    setError(null);
    try {
      await clearMustChangePassword();
      onSkipped();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, auto: string, autoFocus = false) => (
    <div className="space-y-1.5">
      <label className={authLabelClass}>{label}</label>
      <div className="relative">
        <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
        <input
          type="password"
          autoComplete={auto}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => set(e.target.value)}
          disabled={busy}
          className={authInputClass}
        />
      </div>
    </div>
  );

  return (
    <AuthFrame statusLabel="Password Change Required">
      <AuthHeading
        badge="First Sign-In"
        icon={<KeyRound className="w-3.5 h-3.5" />}
        title="Set your own password"
        subtitle={`You signed in to ${email} with a temporary password. Choose your own password to continue.`}
      />

      <form onSubmit={submit} className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg p-6 space-y-4">
        {field('Temporary password (from your email)', current, setCurrent, 'current-password', true)}
        {field('New password', next, setNext, 'new-password')}
        {field('Repeat new password', next2, setNext2, 'new-password')}

        <ul className="space-y-1">
          {checks.map((c) => (
            <li
              key={c.label}
              className={`flex items-center gap-1.5 text-[11px] font-mono ${
                c.ok ? 'text-emerald-400' : c.required ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {c.ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
              <span>
                {c.label}
                {!c.required && ' (recommended)'}
              </span>
            </li>
          ))}
        </ul>

        {error && <AuthAlert kind="error">{error}</AuthAlert>}

        <button type="submit" disabled={busy || !current || !acceptable} className={authPrimaryButtonClass}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          <span>Save password</span>
        </button>

        <button type="button" onClick={skip} disabled={busy} className={authSecondaryButtonClass}>
          I already chose my own password from the email link
        </button>
        <button type="button" onClick={onSignOut} className={authSecondaryButtonClass}>
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </form>
    </AuthFrame>
  );
};
