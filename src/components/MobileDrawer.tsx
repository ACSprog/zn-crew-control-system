import React from 'react';
import { ActiveView, SystemUser } from '../types';
import {
  LayoutDashboard,
  Bell,
  Calendar,
  Users,
  Plane,
  CalendarOff,
  Cpu,
  ShieldCheck,
  Bot,
  BarChart3,
  Settings,
  Clock,
  CheckSquare,
  FileCheck2,
  GraduationCap,
  Layers,
  FileCode2,
  History,
  CalendarDays,
  Flame,
  Timer,
  BookOpen,
  UserCheck,
  Lock,
  X,
  Smartphone,
  LogOut,
  Save,
  RefreshCw,
} from 'lucide-react';
import { ZambiaAirwaysLogo } from './ZambiaAirwaysLogo';
import { canAccessView, normalizeRole } from '../utils/securityEngine';
import appIconImg from '../assets/images/app_mobile_icon_1786750492443.jpg';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  currentUser?: SystemUser;
  onOpenMobileAppModal: () => void;
  onLogout?: () => void;
  onSaveAllData?: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  activeView,
  onNavigate,
  currentUser,
  onOpenMobileAppModal,
  onLogout,
  onSaveAllData,
}) => {
  if (!isOpen) return null;

  const currentRole = currentUser ? normalizeRole(currentUser.role) : normalizeRole('ADMIN');

  const handleSelect = (view: ActiveView) => {
    const access = canAccessView(view, currentRole);
    if (!access.allowed) {
      alert(`🔒 Restricted: ${access.reason || 'Access denied for this role.'}`);
      return;
    }
    onNavigate(view);
    onClose();
  };

  const menuSections: {
    title: string;
    items: { id: ActiveView; label: string; icon: React.FC<{ className?: string }> }[];
  }[] = [
    {
      title: 'OPERATIONS',
      items: [
        { id: 'dashboard', label: 'OCC Dashboard', icon: LayoutDashboard },
        { id: 'portal', label: 'Crew Member Portal', icon: UserCheck },
        { id: 'flights', label: 'Flight Monitoring', icon: Plane },
        { id: 'notifications', label: 'Alerts & Notifications', icon: Bell },
        { id: 'crew', label: 'Crew Database', icon: Users },
        { id: 'q400', label: 'Q400 Fleet', icon: Layers },
        { id: 'b737', label: 'B737 Fleet', icon: Plane },
      ],
    },
    {
      title: 'SCHEDULING & HOURS',
      items: [
        { id: 'scheduling', label: 'Crew Scheduling', icon: ShieldCheck },
        { id: 'scheduler', label: 'Auto Scheduler Engine', icon: Cpu },
        { id: 'calendar', label: 'Roster Calendar', icon: CalendarDays },
        { id: 'crewhours', label: 'Crew Hours (FD/CC)', icon: Timer },
      ],
    },
    {
      title: 'COMPLIANCE & REPAIR',
      items: [
        { id: 'fatigue', label: 'Fatigue Monitoring Matrix', icon: Flame },
        { id: 'recency', label: '90-Day Recency Tracker', icon: Clock },
        { id: 'linechecks', label: 'Line Check Tracker', icon: CheckSquare },
        { id: 'documents', label: 'License & Document Expiries', icon: FileCheck2 },
        { id: 'leave', label: 'Leave & Availability', icon: CalendarOff },
        { id: 'training', label: 'Training Tracker', icon: GraduationCap },
      ],
    },
    {
      title: 'SYSTEM & TOOLS',
      items: [
        { id: 'guide', label: 'Staff Training & Manual', icon: BookOpen },
        { id: 'users', label: 'User Access & Roles', icon: ShieldCheck },
        { id: 'assistant', label: 'Gemini AI Assistant', icon: Bot },
        { id: 'reports', label: 'Reports & PDF Export', icon: BarChart3 },
        { id: 'legacy', label: 'Legacy Excel / VBA', icon: FileCode2 },
        { id: 'settings', label: 'Settings & Rules', icon: Settings },
        { id: 'audit', label: 'Audit Log & Seals', icon: History },
      ],
    },
  ];

  return (
    <div className="md:hidden fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Slide-in Drawer Container */}
      <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <ZambiaAirwaysLogo variant="dark" size="sm" />
          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close Navigation Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current User Summary */}
        {currentUser && (
          <div className="p-3.5 bg-[#2E2C2B] text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-9 h-9 rounded-full bg-[#F37C1C] text-white font-bold flex items-center justify-center text-xs font-mono shrink-0">
                {currentUser.avatarInitials}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold truncate leading-tight">{currentUser.name}</div>
                <div className="text-[10px] text-slate-300 font-mono">{currentUser.role}</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
              ACTIVE
            </span>
          </div>
        )}

        {/* Mobile App Install Button */}
        <div className="p-3 bg-orange-50 border-b border-orange-200">
          <button
            onClick={() => {
              onClose();
              onOpenMobileAppModal();
            }}
            className="w-full min-h-[48px] py-2 px-3 bg-[#F37C1C] hover:bg-[#D96B12] text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between shadow-xs active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md overflow-hidden bg-black shrink-0 border border-white/30">
                <img
                  src={appIconImg}
                  alt="App Icon"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-semibold">Install Mobile PWA</span>
            </div>
            <span className="text-[10px] bg-white/25 px-2 py-1 rounded-md font-mono font-bold">
              OPEN
            </span>
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {menuSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                {section.title}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                const access = canAccessView(item.id, currentRole);
                const isLocked = !access.allowed;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#F37C1C] text-white shadow-xs'
                        : isLocked
                        ? 'text-slate-400 opacity-60'
                        : 'text-[#2E2C2B] hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {isLocked && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-2">
          {onSaveAllData && (
            <button
              onClick={() => {
                onSaveAllData();
                onClose();
              }}
              className="w-full min-h-[44px] py-2.5 px-3 bg-[#2E2C2B] text-white rounded-xl text-xs font-bold hover:bg-[#1a1918] transition-colors cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Save className="w-4 h-4 text-[#F37C1C]" />
              <span>Save System Data</span>
            </button>
          )}

          {onLogout && (
            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full min-h-[44px] py-2.5 px-3 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <LogOut className="w-4 h-4" />
              <span>Lock / Exit Session</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
