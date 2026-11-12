import React, { useEffect, useState } from 'react';
import type { MultiFactorResolver } from 'firebase/auth';
import { Lock, Loader2, Eye, EyeOff, Mail, ArrowLeft, Smartphone, ShieldCheck } from 'lucide-react';
import { signIn, completeMfaSignIn, sendPasswordReset, takeLoginNotice } from '../utils/authService';
import { useEmulator } from '../utils/firebaseSync';
import {
  AuthFrame,
  AuthHeading,
  AuthCard,
  AuthAlert,
  authInputClass,
  authPrimaryButtonClass,
  authSecondaryButtonClass,
  authLabelClass,
} from './AuthFrame';

interface LockScreenViewProps {
  onAuthenticated?: () => void;
  /** Why the user is on this page (signed out after inactivity, account blocked, …) */
  notice?: string | null;
}

export const LockScreenView: React.FC<LockScreenViewProps> = ({ onAuthenticated, notice }) => {
  const [mode, setMode] = useState<'login' | 'code' | 'reset'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState<string | null>(notice || null);

  // Second step (authenticator app code)
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  // Messages carried across a sign-out ("password changed, sign in again", …)
  useEffect(() => {
    const carried = takeLoginNotice();
    if (carried) {
      setInfoMessage(carried.text);
      if (carried.email) setEmail(carried.email);
    }
  }, []);

  useEffect(() => {
    if (notice) setInfoMessage(notice);
  }, [notice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating) return;
    setErrorMessage('');
    setInfoMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Enter both your email and password.');
      return;
    }

    setIsAuthenticating(true);
    const res = await signIn(email, password);
    if (res.mfaResolver) {
      setMfaResolver(res.mfaResolver);
      setMfaCode('');
      setMode('code');
      setIsAuthenticating(false);
      return;
    }
    if (res.error || !res.user) {
      setErrorMessage(res.error || 'Sign-in failed.');
      setIsAuthenticating(false);
      return;
    }
    onAuthenticated?.();
  };

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaResolver || isAuthenticating) return;
    setErrorMessage('');
    setIsAuthenticating(true);
    const res = await completeMfaSignIn(mfaResolver, mfaCode);
    if (res.error || !res.user) {
      setErrorMessage(res.error || 'Could not verify the code.');
      setIsAuthenticating(false);
      return;
    }
    onAuthenticated?.();
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSendingReset) return;
    setResetError('');

    if (!resetEmail.trim()) {
      setResetError('Enter your email address.');
      return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordReset(resetEmail);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/invalid-email') {
        setResetError('That doesn’t look like a valid email address.');
        setIsSendingReset(false);
        return;
      }
      if (code === 'app/locked') {
        setResetError((err as Error).message);
        setIsSendingReset(false);
        return;
      }
      // Any other error (including user-not-found) still shows the same
      // "check your inbox" success state below, so an outside observer
      // can't use this form to probe which accounts exist.
    }
    setResetSent(true);
    setIsSendingReset(false);
  };

  const backToLogin = () => {
    setMode('login');
    setResetSent(false);
    setResetError('');
    setResetEmail('');
    setMfaResolver(null);
    setMfaCode('');
    setErrorMessage('');
    setPassword('');
  };

  return (
    <AuthFrame>
      {mode === 'login' && (
        <>
          <AuthHeading
            badge="Secure Sign-In"
            title="Sign in to your account"
            subtitle="Enter the email and password assigned to you by your system administrator."
          />

          <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg p-6 space-y-4">
            {infoMessage && <AuthAlert kind="info">{infoMessage}</AuthAlert>}
            {errorMessage && <AuthAlert kind="error">{errorMessage}</AuthAlert>}

            <div className="space-y-1.5">
              <label className={authLabelClass}>Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@zambiaairways.co.zm"
                  disabled={isAuthenticating}
                  className={authInputClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className={authLabelClass}>Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setMode('reset');
                  }}
                  className="text-[11px] font-mono text-[#F37C1C] hover:text-[#ffa552] transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isAuthenticating}
                  className={`${authInputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isAuthenticating} className={authPrimaryButtonClass}>
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          <p className="text-center text-[11px] text-slate-500 font-mono">
            Don't have an account? Contact your system administrator to be added.
          </p>
        </>
      )}

      {mode === 'code' && (
        <>
          <AuthHeading
            badge="Two-Step Sign-In"
            icon={<ShieldCheck className="w-3.5 h-3.5" />}
            title="Enter your 6-digit code"
            subtitle="Open your authenticator app (Google or Microsoft Authenticator) and enter the current code for Zambia Airways Crew Control."
          />

          <form onSubmit={handleSubmitCode} className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg p-6 space-y-4">
            {errorMessage && <AuthAlert kind="error">{errorMessage}</AuthAlert>}

            <div className="space-y-1.5">
              <label className={authLabelClass}>Authenticator code</label>
              <div className="relative">
                <Smartphone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={7}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="123456"
                  disabled={isAuthenticating}
                  className={`${authInputClass} tracking-[0.4em] text-sm`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating || mfaCode.replace(/\s/g, '').length < 6}
              className={authPrimaryButtonClass}
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Verify &amp; Sign In</span>
              )}
            </button>

            <button type="button" onClick={backToLogin} className={authSecondaryButtonClass}>
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </form>

          <p className="text-center text-[11px] text-slate-500 font-mono">
            Lost your phone? Ask a Super Admin to reset your two-step sign-in.
          </p>
        </>
      )}

      {mode === 'reset' && (
        <>
          <AuthHeading
            badge="Password Reset"
            title="Reset your password"
            subtitle="Enter your account email and we'll send you a link to set a new password."
          />

          <AuthCard>
            {resetSent ? (
              <div className="space-y-4">
                <AuthAlert kind="success">
                  If an account exists for <strong>{resetEmail}</strong>, a reset link has been sent. Check your inbox
                  (and spam folder).
                </AuthAlert>
                {useEmulator && (
                  <AuthAlert kind="info">
                    Local emulator mode doesn't send real emails. Open <code className="text-blue-200">localhost:4001</code>{' '}
                    → Authentication to retrieve the test reset link.
                  </AuthAlert>
                )}
                <button
                  type="button"
                  onClick={backToLogin}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs font-mono rounded-xl transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendReset} className="space-y-4">
                {resetError && <AuthAlert kind="error">{resetError}</AuthAlert>}

                <div className="space-y-1.5">
                  <label className={authLabelClass}>Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      autoComplete="username"
                      autoFocus
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@zambiaairways.co.zm"
                      disabled={isSendingReset}
                      className={authInputClass}
                    />
                  </div>
                </div>

                <button type="submit" disabled={isSendingReset} className={authPrimaryButtonClass}>
                  {isSendingReset ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </button>

                <button type="button" onClick={backToLogin} className={authSecondaryButtonClass}>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
              </form>
            )}
          </AuthCard>
        </>
      )}
    </AuthFrame>
  );
};

