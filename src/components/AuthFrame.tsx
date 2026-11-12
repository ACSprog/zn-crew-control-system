import React from 'react';
import { Database, Lock, ShieldCheck, KeyRound, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { ZambiaAirwaysLogo } from './ZambiaAirwaysLogo';
import { useEmulator } from '../utils/firebaseSync';

/**
 * The dark Crew Control sign-in frame (header bar, glow, footer), shared by
 * the sign-in page and the other sign-in steps (2FA code, 2FA set-up,
 * first-login password) so they all look the same.
 */
export const AuthFrame: React.FC<{ children: React.ReactNode; statusLabel?: string }> = ({
  children,
  statusLabel = 'System Locked',
}) => (
  <div className="fixed inset-0 bg-[#1e1c1b] z-50 flex flex-col justify-between overflow-y-auto p-4 sm:p-8 animate-in fade-in duration-200">
    <div className="absolute top-0 right-0 w-96 h-96 bg-[#F37C1C]/10 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

    <div className="max-w-5xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between pt-2 pb-6 border-b border-slate-800 relative z-10 gap-4">
      <div className="flex items-center gap-3">
        <ZambiaAirwaysLogo className="h-9 w-auto" />
        <div>
          <h1 className="text-sm font-black text-white tracking-wide uppercase font-mono">Zambia Airways OCC</h1>
          <p className="text-[10px] text-slate-400 font-mono">Flight Operations &amp; Crew Control System</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900/90 text-slate-300 border border-slate-700/80 rounded-full text-[11px] font-mono">
          <Database className="w-3.5 h-3.5 text-[#F37C1C]" />
          <span>{useEmulator ? 'Local Emulator Mode' : 'Live Production Database'}</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 rounded-full text-xs font-mono font-bold">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>{statusLabel}</span>
        </div>
      </div>
    </div>

    <div className="max-w-md w-full mx-auto my-auto py-8 relative z-10 space-y-8">{children}</div>

    <div className="max-w-5xl w-full mx-auto text-center pt-6 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2">
      <span>Zambia Airways Operational Control Center (OCC) &bull; Kenneth Kaunda International Airport (LUN)</span>
      <span className="text-slate-400 flex items-center gap-1">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Firebase Authentication</span>
      </span>
    </div>
  </div>
);

/** Orange pill + big white title + grey subtitle, as on the sign-in page. */
export const AuthHeading: React.FC<{
  badge: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}> = ({ badge, icon, title, subtitle }) => (
  <div className="text-center space-y-2">
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F37C1C]/20 border border-[#F37C1C]/40 text-[#F37C1C] rounded-full text-xs font-mono font-bold">
      {icon || <KeyRound className="w-3.5 h-3.5" />}
      <span>{badge}</span>
    </div>
    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{title}</h2>
    {subtitle && <p className="text-xs text-slate-400 max-w-md mx-auto">{subtitle}</p>}
  </div>
);

/** Dark card that holds the form. */
export const AuthCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg p-6 space-y-4">{children}</div>
);

export const AuthAlert: React.FC<{ kind: 'error' | 'success' | 'info'; children: React.ReactNode }> = ({ kind, children }) => {
  const styles = {
    error: 'bg-red-950/60 border-red-800/80 text-red-300',
    success: 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300',
    info: 'bg-blue-950/60 border-blue-800/80 text-blue-300',
  }[kind];
  const Icon = kind === 'error' ? AlertCircle : kind === 'success' ? CheckCircle2 : Info;
  return (
    <div className={`flex items-start gap-2 border rounded-lg px-3 py-2 text-xs font-mono ${styles}`}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
};

export const authInputClass =
  'w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#F37C1C] font-mono shadow-inner disabled:opacity-60';

export const authPrimaryButtonClass =
  'w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F37C1C] hover:bg-[#e0700f] disabled:opacity-70 text-white font-bold text-xs font-mono rounded-xl transition-colors shadow-lg';

export const authSecondaryButtonClass =
  'w-full flex items-center justify-center gap-2 px-4 py-2 text-slate-400 hover:text-slate-200 font-bold text-xs font-mono transition-colors cursor-pointer';

export const authLabelClass = 'text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wide';
