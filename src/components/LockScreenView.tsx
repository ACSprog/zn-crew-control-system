import React, { useState } from 'react';
import { ZambiaAirwaysLogo } from './ZambiaAirwaysLogo';
import { Lock, ShieldCheck, KeyRound, Database, Loader2, Eye, EyeOff, AlertCircle, Mail, CheckCircle2, ArrowLeft } from 'lucide-react';
import { signIn, sendPasswordReset } from '../utils/authService';
import { useEmulator } from '../utils/firebaseSync';

interface LockScreenViewProps {
  onAuthenticated?: () => void;
}

function friendlyAuthError(code: string | undefined): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'That doesn\u2019t look like a valid email address.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact your system administrator.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error \u2014 check your connection and try again.';
    default:
      return 'Sign-in failed. Please check your credentials and try again.';
  }
}

export const LockScreenView: React.FC<LockScreenViewProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'reset'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating) return;
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Enter both your email and password.');
      return;
    }

    setIsAuthenticating(true);
    try {
      await signIn(email, password);
      onAuthenticated?.();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setErrorMessage(friendlyAuthError(code));
      setIsAuthenticating(false);
    }
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
        setResetError('That doesn\u2019t look like a valid email address.');
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
  };

  return (
    <div className="fixed inset-0 bg-[#1e1c1b] z-50 flex flex-col justify-between overflow-y-auto p-4 sm:p-8 animate-in fade-in duration-200">
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#F37C1C]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between pt-2 pb-6 border-b border-slate-800 relative z-10 gap-4">
        <div className="flex items-center gap-3">
          <ZambiaAirwaysLogo className="h-9 w-auto" />
          <div>
            <h1 className="text-sm font-black text-white tracking-wide uppercase font-mono">
              Zambia Airways OCC
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              Flight Operations &amp; Crew Control System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900/90 text-slate-300 border border-slate-700/80 rounded-full text-[11px] font-mono">
            <Database className="w-3.5 h-3.5 text-[#F37C1C]" />
            <span>{useEmulator ? 'Local Emulator Mode' : 'Live Production Database'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 rounded-full text-xs font-mono font-bold">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>System Locked</span>
          </div>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto my-auto py-8 relative z-10 space-y-8">
        {mode === 'login' ? (
          <>
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F37C1C]/20 border border-[#F37C1C]/40 text-[#F37C1C] rounded-full text-xs font-mono font-bold">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Secure Sign-In</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Sign in to your account
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Enter the email and password assigned to you by your system administrator.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg p-6 space-y-4"
            >
              {errorMessage && (
                <div className="flex items-start gap-2 bg-red-950/60 border border-red-800/80 text-red-300 rounded-lg px-3 py-2 text-xs font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wide">
                  Email
                </label>
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
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#F37C1C] font-mono shadow-inner disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wide">
                    Password
                  </label>
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
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#F37C1C] font-mono shadow-inner disabled:opacity-60"
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

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F37C1C] hover:bg-[#e0700f] disabled:opacity-70 text-white font-bold text-xs font-mono rounded-xl transition-colors shadow-lg"
              >
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
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F37C1C]/20 border border-[#F37C1C]/40 text-[#F37C1C] rounded-full text-xs font-mono font-bold">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Password Reset</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Reset your password
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Enter your account email and we'll send you a link to set a new password.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg p-6 space-y-4">
              {resetSent ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 rounded-lg px-3 py-3 text-xs font-mono">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      If an account exists for <strong>{resetEmail}</strong>, a reset link has been sent. Check your
                      inbox (and spam folder).
                    </span>
                  </div>
                  {useEmulator && (
                    <div className="flex items-start gap-2 bg-blue-950/60 border border-blue-800/80 text-blue-300 rounded-lg px-3 py-2 text-[11px] font-mono">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Local emulator mode doesn't send real emails. Open{' '}
                        <code className="text-blue-200">localhost:4001</code> → Authentication to retrieve the test
                        reset link.
                      </span>
                    </div>
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
                  {resetError && (
                    <div className="flex items-start gap-2 bg-red-950/60 border border-red-800/80 text-red-300 rounded-lg px-3 py-2 text-xs font-mono">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wide">
                      Email
                    </label>
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
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#F37C1C] font-mono shadow-inner disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingReset}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F37C1C] hover:bg-[#e0700f] disabled:opacity-70 text-white font-bold text-xs font-mono rounded-xl transition-colors shadow-lg"
                  >
                    {isSendingReset ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Send Reset Link</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={backToLogin}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-slate-400 hover:text-slate-200 font-bold text-xs font-mono transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>

      <div className="max-w-5xl w-full mx-auto text-center pt-6 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>Zambia Airways Operational Control Center (OCC) &bull; Kenneth Kaunda International Airport (LUN)</span>
        <span className="text-slate-400 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Firebase Authentication</span>
        </span>
      </div>
    </div>
  );
};