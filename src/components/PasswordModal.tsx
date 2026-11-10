import React from 'react';
import { SystemUser, SystemUserRole } from '../types';
import { ShieldCheck, Eye, AlertCircle, X, UserCog } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  targetUser: SystemUser | null;
  onClose: () => void;
  onSuccess: (authenticatedUser: SystemUser) => void;
}

const ROLE_BADGES: Record<SystemUserRole, { label: string; color: string; bg: string }> = {
  SUPER_ADMIN: { label: 'Super Admin / IT', color: 'text-red-700', bg: 'bg-red-100 border-red-200' },
  ADMIN: { label: 'System Admin', color: 'text-red-700', bg: 'bg-red-100 border-red-200' },
  OCC_CONTROLLER: { label: 'OCC Controller', color: 'text-orange-800', bg: 'bg-orange-100 border-orange-200' },
  SCHEDULER: { label: 'Crew Scheduler', color: 'text-blue-800', bg: 'bg-blue-100 border-blue-200' },
  CHIEF_PILOT: { label: 'Chief Pilot / Line Mgt', color: 'text-purple-800', bg: 'bg-purple-100 border-purple-200' },
  FLIGHT_CREW: { label: 'Flight Crew (Self-Service)', color: 'text-emerald-800', bg: 'bg-emerald-100 border-emerald-200' },
  PILOT_CABIN: { label: 'Flight Crew', color: 'text-emerald-800', bg: 'bg-emerald-100 border-emerald-200' },
  AUDITOR: { label: 'Safety Auditor', color: 'text-indigo-800', bg: 'bg-indigo-100 border-indigo-200' },
};

/**
 * This used to be a fake "password check" modal with a hardcoded master
 * password list — it never guarded anything real. Real authentication is
 * now Firebase Auth (see LockScreenView.tsx). This component is kept only
 * as an honest "preview the UI as this account" confirmation, used by the
 * Header's quick-switch and User Management's role-preview feature. It
 * does not change actual Firestore permissions — those are still
 * determined entirely by whichever Firebase Auth account is really
 * signed in.
 */
export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  targetUser,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !targetUser) return null;

  const roleBadge = ROLE_BADGES[targetUser.role] || ROLE_BADGES.SCHEDULER;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-[#2E2C2B] text-white p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F37C1C]/20 border border-[#F37C1C]/40 text-[#F37C1C] flex items-center justify-center">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-white">Preview as This Account</h3>
              <p className="text-[11px] text-slate-300">Display-only — your real permissions don't change</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#2E2C2B] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {targetUser.avatarInitials}
              </div>
              <div className="truncate">
                <h4 className="text-xs font-black text-slate-900 truncate">{targetUser.name}</h4>
                <p className="text-[11px] text-slate-500 font-mono truncate">{targetUser.email}</p>
              </div>
            </div>

            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border shrink-0 ${roleBadge.bg} ${roleBadge.color}`}>
              {roleBadge.label}
            </span>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
            <span>
              This changes what's <strong>displayed</strong> in the UI so you can see what this role's
              screen looks like. Your real data access is still controlled entirely by your own signed-in
              Firebase account — switching this display does not grant or remove any actual permissions.
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSuccess(targetUser)}
              className="px-4 py-2 bg-[#F37C1C] hover:bg-[#D96B12] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Preview as {targetUser.name.split(' ')[0]}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};