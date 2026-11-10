import React, { useState, useEffect } from 'react';
import { ActiveView, SystemUser, SystemUserRole, SystemNotification } from '../types';
import {
  Cpu,
  RefreshCw,
  UserCheck,
  ShieldCheck,
  ChevronDown,
  User,
  Lock,
  Clock,
  Save,
  CheckCircle,
  Download,
  KeyRound,
  LogOut,
  Cloud,
  CloudOff,
  Wifi,
  Bell,
  Check,
  Calendar,
  AlertTriangle,
  Smartphone,
  Menu,
} from 'lucide-react';
import { PasswordModal } from './PasswordModal';
import { loadSystemNotifications, markNotificationAsRead } from '../utils/storage';

interface HeaderProps {
  activeView: ActiveView;
  onGenerateRoster?: () => void;
  onResetData?: () => void;
  onSaveAllData?: () => void;
  onLogout?: () => void;
  onChangePasswordClick?: () => void;
  openPositionsCount?: number;
  onNavigate?: (view: ActiveView) => void;
  currentUser?: SystemUser;
  systemUsers?: SystemUser[];
  onSelectCurrentUser?: (user: SystemUser) => void;
  syncStatus?: 'connected' | 'connecting' | 'error';
  onOpenMobileDrawer?: () => void;
  onOpenMobileAppModal?: () => void;
}

const VIEW_TITLES: Record<ActiveView, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'OCC Operations Dashboard',
    subtitle: 'Real-time Zambia Airways OCC Fleet & Crew Monitoring',
  },
  flights: {
    title: 'Flight Monitoring',
    subtitle: 'Q400 & B737 Operational Flight Schedule & Delay Tracking',
  },
  crew: {
    title: 'Crew Database',
    subtitle: 'Captains, First Officers & Cabin Crew Records & Expiries',
  },
  q400: {
    title: 'Q400 Fleet Module',
    subtitle: 'De Havilland Dash 8-Q400 Fleet Operations, Roster & Crew Availability',
  },
  b737: {
    title: 'B737 Fleet Module',
    subtitle: 'Boeing 737-800 Jet Fleet Operations, Routes & Crew Roster',
  },
  scheduling: {
    title: 'Crew Scheduling',
    subtitle: 'Interactive Duty Assignment with Real-Time Legality Blocking',
  },
  scheduler: {
    title: 'Auto Scheduler Engine',
    subtitle: 'Algorithmic Roster Draft Generation & Weighted Optimization',
  },
  calendar: {
    title: 'Roster Calendar',
    subtitle: 'Monthly, Weekly & Daily Roster Duty Indicators',
  },
  crewhours: {
    title: 'Crew Hours (FD / CC)',
    subtitle: 'Daily Flight Hour Tracking & Pilot/Cabin Crew Monthly Summaries',
  },
  fatigue: {
    title: 'Fatigue Monitoring',
    subtitle: 'Rolling Duty Hours & Fatigue Threshold Dashboard',
  },
  recency: {
    title: 'Recency Tracker',
    subtitle: '90-Day Pilot Takeoff/Landing Recency & Sector Currency',
  },
  linechecks: {
    title: 'Line Check Tracker',
    subtitle: 'Annual Line Check Expiry & Qualification Renewal Schedule',
  },
  documents: {
    title: 'License & Document Tracker',
    subtitle: 'Passport, Airport Pass, Medical & License Expiry Warnings',
  },
  leave: {
    title: 'Leave & Availability',
    subtitle: 'Annual Leave, Sick, Standby & Exclusions Control',
  },
  training: {
    title: 'Training Tracker',
    subtitle: 'Simulator, Recurrent, CRM, SEP & Safety Qualification Status',
  },
  reports: {
    title: 'Reports & Analytics',
    subtitle: 'Daily/Weekly/Monthly Utilization & Fleet CSV Exports',
  },
  assistant: {
    title: 'AI Assistant',
    subtitle: 'AI Schedule Analytics & Advisory via Microsoft 365 Copilot Chat',
  },
  legacy: {
    title: 'Legacy Excel System Mapping',
    subtitle: 'VBA Macro Conversion Engine & Excel Workbook Import Matrix',
  },
  settings: {
    title: 'Settings & Rules',
    subtitle: 'FTL Legality Rules, Warning Thresholds & Complement Settings',
  },
  audit: {
    title: 'Audit Log',
    subtitle: 'System Change History & Schedule Modification Audit Trail',
  },
  guide: {
    title: 'Staff Training & Manual',
    subtitle: 'Operational Guide, Standard Operating Procedures (SOPs) & FTL Matrix',
  },
  portal: {
    title: 'Crew Member Portal',
    subtitle: 'Individual Duty Rosters, Report Times (STD-01:00) & FTL Acknowledgments',
  },
  crewportal: {
    title: 'Crew Member Portal',
    subtitle: 'Individual Duty Rosters, Report Times (STD-01:00) & FTL Acknowledgments',
  },
  users: {
    title: 'User Access & Permissions',
    subtitle: 'Role-Based Access Control (RBAC), System Users & Privilege Configuration',
  },
  notifications: {
    title: 'Notification Center & Broadcasts',
    subtitle: 'Automated WhatsApp & Email Notifications, Queue Manager & Templates',
  },
};

const ROLE_BADGES: Record<SystemUserRole, { label: string; color: string; bg: string }> = {
  SUPER_ADMIN: { label: 'Super Admin / IT', color: 'text-red-700', bg: 'bg-red-100 border-red-200' },
  ADMIN: { label: 'System Admin', color: 'text-red-700', bg: 'bg-red-100 border-red-200' },
  SCHEDULER: { label: 'Crew Scheduler', color: 'text-blue-800', bg: 'bg-blue-100 border-blue-200' },
  OCC_CONTROLLER: { label: 'OCC Controller', color: 'text-orange-800', bg: 'bg-orange-100 border-orange-200' },
  CHIEF_PILOT: { label: 'Chief Pilot / Line Mgt', color: 'text-purple-800', bg: 'bg-purple-100 border-purple-200' },
  FLIGHT_CREW: { label: 'Flight Crew (Self-Service)', color: 'text-emerald-800', bg: 'bg-emerald-100 border-emerald-200' },
  PILOT_CABIN: { label: 'Flight Crew', color: 'text-emerald-800', bg: 'bg-emerald-100 border-emerald-200' },
  AUDITOR: { label: 'Safety Auditor (Read-Only)', color: 'text-indigo-800', bg: 'bg-indigo-100 border-indigo-200' },
};

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onGenerateRoster,
  onResetData,
  onSaveAllData,
  onLogout,
  onChangePasswordClick,
  openPositionsCount = 0,
  onNavigate,
  currentUser,
  systemUsers = [],
  onSelectCurrentUser,
  syncStatus = 'connected',
  onOpenMobileDrawer,
  onOpenMobileAppModal,
}) => {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>(loadSystemNotifications());
  const [authModalTargetUser, setAuthModalTargetUser] = useState<SystemUser | null>(null);
  const [isJustSaved, setIsJustSaved] = useState(false);

  // 15-Minute Session Inactivity Timer — now genuinely tracks inactivity:
  // any click, keypress, or scroll resets the countdown, matching what the
  // label actually claims. Only truly idle sessions auto-lock.
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number>(15 * 60);

  const handleResetSessionTimer = () => {
    setSessionSecondsLeft(15 * 60);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSecondsLeft((prev) => {
        if (prev <= 1) {
          if (onLogout) onLogout();
          return 15 * 60;
        }
        return prev - 1;
      });
    }, 1000);

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const onActivity = () => setSessionSecondsLeft(15 * 60);
    activityEvents.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    return () => {
      clearInterval(timer);
      activityEvents.forEach((evt) => window.removeEventListener(evt, onActivity));
    };
  }, [onLogout]);

  const formatSessionTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    setNotifications(loadSystemNotifications());
  }, [activeView]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    notifications.forEach((n) => markNotificationAsRead(n.id));
    setNotifications(loadSystemNotifications());
  };

  const handleSaveClick = () => {
    if (onSaveAllData) {
      onSaveAllData();
      setIsJustSaved(true);
      setTimeout(() => setIsJustSaved(false), 3000);
    }
  };

  const pageInfo = VIEW_TITLES[activeView] || {
    title: 'OCC Dashboard',
    subtitle: 'Zambia Airways Crew Control Center',
  };

  const todayDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const activeRoleBadge = currentUser ? (ROLE_BADGES[currentUser.role] || ROLE_BADGES.SUPER_ADMIN) : null;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-2.5 sm:px-6 lg:px-8 flex-shrink-0 z-20 shadow-2xs">
      <div className="flex items-center gap-1.5 sm:gap-4 truncate">
        {onOpenMobileDrawer && (
          <button
            onClick={onOpenMobileDrawer}
            className="md:hidden p-2.5 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95"
            aria-label="Open Navigation Menu"
            title="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col truncate">
          <h1 className="text-sm sm:text-base font-extrabold text-[#2E2C2B] tracking-tight leading-tight truncate">
            {pageInfo.title}
          </h1>
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium truncate hidden xs:inline">
            {pageInfo.subtitle}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {onOpenMobileAppModal && (
          <button
            onClick={onOpenMobileAppModal}
            className="px-2.5 sm:px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#F37C1C] rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0 min-h-[40px] active:scale-95"
            title="Install or Export Zambia Airways Mobile App (iOS / Android / PWA / APK)"
          >
            <Smartphone className="w-4 h-4 text-[#F37C1C]" />
            <span className="inline font-semibold">Mobile App</span>
          </button>
        )}


        {/* 15-Minute Session Inactivity Timer */}
        <button
          onClick={handleResetSessionTimer}
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border transition-all cursor-pointer ${
            sessionSecondsLeft < 180
              ? 'bg-red-50 text-red-700 border-red-300 animate-pulse'
              : sessionSecondsLeft < 300
              ? 'bg-amber-50 text-amber-700 border-amber-300'
              : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}
          title="Auto-lock after 15 minutes of inactivity. Any activity resets this automatically."
        >
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>{formatSessionTime(sessionSecondsLeft)}</span>
        </button>

        {/* Real-time Cloud Sync Badge */}
        <div
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border transition-all ${
            syncStatus === 'connected'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : syncStatus === 'connecting'
              ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
          title={
            syncStatus === 'connected'
              ? 'Auto-sync active across all devices & users'
              : syncStatus === 'connecting'
              ? 'Connecting to real-time database...'
              : 'Sync disconnected'
          }
        >
          {syncStatus === 'connected' ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              <span>Realtime Sync</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            </>
          ) : syncStatus === 'connecting' ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <CloudOff className="w-3.5 h-3.5 text-red-600" />
              <span>Offline</span>
            </>
          )}
        </div>

        <div className="hidden lg:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-700 font-mono">{todayDate}</span>
        </div>

        {onSaveAllData && (
          <button
            onClick={handleSaveClick}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
              isJustSaved
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-200'
                : 'bg-[#2E2C2B] text-white hover:bg-[#1f1d1c] border-[#2E2C2B]'
            }`}
            title="Save all crew database, flight schedules, fleet, and user records"
          >
            {isJustSaved ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-200 animate-bounce" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-[#F37C1C]" />
                <span className="hidden sm:inline">Save Data</span>
              </>
            )}
          </button>
        )}

        {onNavigate && (
          <button
            onClick={() => onNavigate('calendar')}
            className="px-3 py-1.5 bg-slate-100 text-[#2E2C2B] text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            View Roster
          </button>
        )}

        {onGenerateRoster && (
          <button
            onClick={onGenerateRoster}
            disabled={currentUser && !currentUser.permissions.canGenerateRoster}
            title={currentUser && !currentUser.permissions.canGenerateRoster ? 'Auto-scheduler generation restricted to Admin/Scheduler' : 'Run Auto Scheduler'}
            className="px-3.5 py-1.5 bg-[#F37C1C] hover:bg-[#D96B12] disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-2"
          >
            <Cpu className="w-4 h-4" />
            <span className="hidden sm:inline">Generate Roster</span>
            {openPositionsCount > 0 && (
              <span className="px-1.5 py-0.2 bg-white/25 text-white rounded-full text-[10px] font-mono font-bold">
                {openPositionsCount}
              </span>
            )}
          </button>
        )}

        {onResetData && (
          <button
            onClick={onResetData}
            disabled={currentUser && !currentUser.permissions.canResetData}
            className="p-1.5 text-slate-400 hover:text-[#2E2C2B] hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
            title={currentUser && !currentUser.permissions.canResetData ? 'Database reset restricted to Admin' : 'Reset Sample Data'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* Real-time Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
            className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="OCC Operational Alerts & Publications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#F37C1C] rounded-full animate-ping" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1 py-0.2 bg-[#F37C1C] text-white rounded-full text-[9px] font-mono font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-4 space-y-3 font-sans">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#F37C1C]" />
                  <span className="text-xs font-bold text-slate-800 uppercase font-mono">
                    Operational Alerts ({notifications.length})
                  </span>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No new alerts or notifications.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        markNotificationAsRead(notif.id);
                        setNotifications(loadSystemNotifications());
                        if (onNavigate && notif.type === 'ROSTER_PUBLISHED') {
                          onNavigate('portal');
                          setIsNotifDropdownOpen(false);
                        }
                      }}
                      className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                        notif.read
                          ? 'bg-slate-50 border-slate-200 text-slate-600'
                          : 'bg-orange-50/70 border-[#F37C1C]/40 text-slate-900 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 font-mono text-[11px]">
                          {notif.title}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        {notif.message}
                      </p>
                      {notif.revision && (
                        <span className="inline-block mt-1 px-1.5 py-0.2 bg-[#F37C1C]/15 text-[#F37C1C] rounded text-[9px] font-bold font-mono">
                          REV {notif.revision}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Account Switcher Dropdown */}
        {currentUser && (
          <div className="relative pl-2 border-l border-slate-200">
            <button
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
              className="flex items-center gap-2 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-full bg-[#2E2C2B] text-white font-bold flex items-center justify-center text-xs font-mono shadow-xs shrink-0">
                {currentUser.avatarInitials}
              </div>

              <div className="hidden sm:flex flex-col pr-1">
                <span className="text-xs font-extrabold text-slate-900 leading-tight truncate max-w-[120px]">
                  {currentUser.name}
                </span>
                {activeRoleBadge && (
                  <span className={`text-[9px] font-mono font-bold ${activeRoleBadge.color}`}>
                    {activeRoleBadge.label}
                  </span>
                )}
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isUserDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in duration-150">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
                  <p className="text-[10px] font-bold text-slate-400 font-mono uppercase">Logged in as</p>
                  <p className="text-xs font-extrabold text-slate-900 truncate">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono truncate">{currentUser.email}</p>
                  <div className="mt-1.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${activeRoleBadge?.bg} ${activeRoleBadge?.color}`}>
                      {activeRoleBadge?.label} Access
                    </span>
                  </div>
                </div>

                <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase font-mono">
                  Switch Active User Session:
                </div>

                <div className="max-h-48 overflow-y-auto px-2 space-y-1">
                  {systemUsers.map((u) => {
                    const isSelected = u.id === currentUser.id;
                    const rBadge = ROLE_BADGES[u.role];
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          setIsUserDropdownOpen(false);
                          if (isSelected) return;
                          setAuthModalTargetUser(u);
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected ? 'bg-orange-50 text-[#F37C1C] font-extrabold' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate">{u.name}</span>
                            <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">{u.staffNumber}</div>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 border ${rBadge.bg} ${rBadge.color}`}>
                          {rBadge.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-2 border-t border-slate-100 mt-2 space-y-1">
                  {onChangePasswordClick && (
                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        onChangePasswordClick();
                      }}
                      className="w-full px-3 py-1.5 bg-slate-100 hover:bg-[#F37C1C] hover:text-white text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Change My Password</span>
                    </button>
                  )}

                  {onNavigate && (
                    <button
                      onClick={() => {
                        onNavigate('users');
                        setIsUserDropdownOpen(false);
                      }}
                      className="w-full px-3 py-1.5 bg-slate-100 hover:bg-[#2E2C2B] hover:text-white text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Manage User Access</span>
                    </button>
                  )}

                  {onLogout && (
                    <button
                      onClick={() => {
                        setIsUserDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full px-3 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-red-200"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out &amp; Save App</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Password Auth Security Modal */}
      <PasswordModal
        isOpen={!!authModalTargetUser}
        targetUser={authModalTargetUser}
        onClose={() => setAuthModalTargetUser(null)}
        onSuccess={(authenticatedUser) => {
          if (onSelectCurrentUser) onSelectCurrentUser(authenticatedUser);
          setAuthModalTargetUser(null);
        }}
      />
    </header>
  );
};


