import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { multiFactor, sendEmailVerification, TotpMultiFactorGenerator, type TotpSecret } from 'firebase/auth';
import { ShieldCheck, Loader2, Mail, CheckCircle2, Smartphone, LogOut, Copy, X } from 'lucide-react';
import { auth, isEnrolledIn2fa } from '../utils/authService';
import { AuthFrame, AuthHeading, AuthCard, AuthAlert, authPrimaryButtonClass, authSecondaryButtonClass } from './AuthFrame';

const ISSUER = 'Zambia Airways Crew Control';

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  if (code === 'auth/requires-recent-login') return 'For security, please sign out and sign in again, then set up 2FA straight away.';
  if (code === 'auth/invalid-verification-code') return 'That code is not right. Enter the current 6-digit code shown in your app.';
  if (code === 'auth/unverified-email') return 'Please verify your email address first.';
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
    return 'Authenticator-app 2FA is not switched on for this Firebase project yet. The project owner runs this once in the project folder:  npm run 2fa:enable';
  }
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes and try again.';
  return (e as Error)?.message || 'Something went wrong.';
}

type Theme = 'dark' | 'light';

const T = {
  dark: {
    step: 'p-4 rounded-xl border border-slate-800 bg-slate-950/50 space-y-2',
    stepTitle: 'text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2',
    text: 'text-xs text-slate-400 leading-relaxed',
    done: 'text-xs text-emerald-400 font-mono flex items-center gap-1.5',
    btn: 'px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold font-mono rounded-lg transition-colors disabled:opacity-60',
    primary: authPrimaryButtonClass,
    input:
      'w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#F37C1C] font-mono tracking-[0.4em] disabled:opacity-50',
    key: 'text-[11px] font-mono text-slate-300 break-all bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5',
  },
  light: {
    step: 'p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2',
    stepTitle: 'text-[11px] font-mono font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2',
    text: 'text-xs text-slate-600 leading-relaxed',
    done: 'text-xs text-emerald-700 font-mono flex items-center gap-1.5',
    btn: 'px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors disabled:opacity-60',
    primary:
      'w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F37C1C] hover:bg-[#D96B12] disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-colors shadow-md',
    input:
      'w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#F37C1C] font-mono tracking-[0.4em] disabled:opacity-50',
    key: 'text-[11px] font-mono text-slate-700 break-all bg-white border border-slate-200 rounded-lg px-2 py-1.5',
  },
};

/** The three steps: verify email → scan QR → confirm code. */
export const EnrollFlow: React.FC<{ onEnrolled: () => void; theme?: Theme }> = ({ onEnrolled, theme = 'dark' }) => {
  const c = T[theme];
  const user = auth.currentUser;
  const [verified, setVerified] = useState<boolean>(Boolean(user?.emailVerified));
  const [sentVerification, setSentVerification] = useState(false);
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const startSecret = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const session = await multiFactor(user).getSession();
      const s = await TotpMultiFactorGenerator.generateSecret(session);
      setSecret(s);
      setQr(await QRCode.toDataURL(s.generateQrCodeUrl(user.email || 'user', ISSUER), { margin: 1, width: 220 }));
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (verified && !secret) startSecret();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified]);

  if (!user) return <AuthAlert kind="error">You are not signed in.</AuthAlert>;

  const sendVerification = async () => {
    setBusy(true);
    setError(null);
    try {
      await sendEmailVerification(user);
      setSentVerification(true);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const checkVerified = async () => {
    setBusy(true);
    setError(null);
    try {
      await user.reload();
      if (user.emailVerified) {
        await user.getIdToken(true);
        setVerified(true);
      } else {
        setError("Your email isn't verified yet. Click the link in the email (check spam), then try again.");
      }
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const enroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret) return;
    setBusy(true);
    setError(null);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.replace(/\s/g, ''));
      await multiFactor(user).enroll(assertion, 'Authenticator app');
      onEnrolled();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className={c.step}>
        <div className={c.stepTitle}>
          <Mail className="w-3.5 h-3.5 text-[#F37C1C]" /> 1. Verify your email
        </div>
        {verified ? (
          <div className={c.done}>
            <CheckCircle2 className="w-4 h-4" /> {user.email} verified
          </div>
        ) : (
          <>
            <p className={c.text}>We need to confirm {user.email} belongs to you.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={sendVerification} disabled={busy} className={c.btn}>
                {sentVerification ? 'Send the email again' : 'Send verification email'}
              </button>
              {sentVerification && (
                <button type="button" onClick={checkVerified} disabled={busy} className={c.btn}>
                  I've clicked the link
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className={c.step}>
        <div className={c.stepTitle}>
          <Smartphone className="w-3.5 h-3.5 text-[#F37C1C]" /> 2. Scan with your authenticator app
        </div>
        {verified && (
          <>
            <p className={c.text}>
              Open <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong> on your phone, tap{' '}
              <strong>+</strong>, and scan this code.
            </p>
            {qr ? (
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <img src={qr} alt="QR code for your authenticator app" className="w-40 h-40 rounded-lg bg-white p-1" />
                <div className="space-y-1.5 w-full">
                  <p className={c.text}>Can't scan? Enter this key instead (time-based):</p>
                  <div className={c.key}>{secret?.secretKey}</div>
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard
                        ?.writeText(secret?.secretKey || '')
                        .then(() => setCopied(true))
                        .catch(() => undefined)
                    }
                    className={`${c.btn} inline-flex items-center gap-1.5`}
                  >
                    <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy key'}
                  </button>
                </div>
              </div>
            ) : busy ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#F37C1C]" />
            ) : (
              <button type="button" onClick={startSecret} className={c.btn}>
                Show QR code
              </button>
            )}
          </>
        )}
      </div>

      <form onSubmit={enroll} className={c.step}>
        <div className={c.stepTitle}>
          <ShieldCheck className="w-3.5 h-3.5 text-[#F37C1C]" /> 3. Enter the 6-digit code
        </div>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          disabled={!secret}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          className={c.input}
        />
        <button type="submit" disabled={!secret || busy || code.replace(/\s/g, '').length < 6} className={c.primary}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          <span>Turn on 2FA</span>
        </button>
      </form>

      {error &&
        (theme === 'dark' ? (
          <AuthAlert kind="error">{error}</AuthAlert>
        ) : (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800">{error}</div>
        ))}
    </div>
  );
};

/** Full page: 2FA is required and this session didn't use it. */
export const TwoFactorRequired: React.FC<{ email: string; enrolled: boolean; onSignOut: () => void }> = ({
  email,
  enrolled,
  onSignOut,
}) => {
  const [done, setDone] = useState(false);
  return (
    <AuthFrame statusLabel="2FA Required">
      <AuthHeading
        badge="Two-Step Sign-In"
        icon={<ShieldCheck className="w-3.5 h-3.5" />}
        title="Set up two-step sign-in"
        subtitle={`Crew Control holds sensitive crew and operational data, so your account (${email}) needs an authenticator-app code to sign in.`}
      />
      <AuthCard>
        {enrolled ? (
          <AuthAlert kind="info">
            2FA is already set up on your account, but this session didn't use it. Sign out and sign in again with your
            code.
          </AuthAlert>
        ) : done ? (
          <AuthAlert kind="success">
            Two-step sign-in is on. Sign out and sign in again with your password and the code from your app.
          </AuthAlert>
        ) : (
          <EnrollFlow onEnrolled={() => setDone(true)} />
        )}
        <button type="button" onClick={onSignOut} className={authSecondaryButtonClass}>
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </AuthCard>
    </AuthFrame>
  );
};

/** "Two-Step Sign-In" window from the user menu: status, and set-up if not on yet. */
export const TwoFactorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  /** After enrolling, the user is signed out to sign in with a code */
  onEnrolled: () => void;
}> = ({ isOpen, onClose, onEnrolled }) => {
  if (!isOpen) return null;
  const user = auth.currentUser;
  const enrolled = isEnrolledIn2fa(user);
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] overflow-y-auto">
        <div className="bg-[#2E2C2B] text-white p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F37C1C]/20 border border-[#F37C1C]/40 text-[#F37C1C] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-white">Two-Step Sign-In (2FA)</h3>
              <p className="text-[11px] text-slate-300">Authenticator-app code at every sign-in</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {enrolled ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>
                <strong>2FA is ON.</strong> You sign in with your password and the 6-digit code from your authenticator
                app. Lost or changed your phone? Ask a Super Admin to reset your 2FA.
              </span>
            </div>
          ) : (
            <EnrollFlow
              theme="light"
              onEnrolled={onEnrolled}
            />
          )}
        </div>
      </div>
    </div>
  );
};
