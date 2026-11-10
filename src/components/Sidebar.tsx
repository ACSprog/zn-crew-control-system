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
  Smartphone,
} from 'lucide-react';
import { ZambiaAirwaysLogo } from './ZambiaAirwaysLogo';
import { canAccessView, normalizeRole } from '../utils/securityEngine';

interface SidebarProps {
  activeView: ActiveView;
  setActiveView?: (view: ActiveView) => void;
  onNavigate?: (view: ActiveView) => void;
  openPositionsCount?: number;
  conflictsCount?: number;
  currentUser?: SystemUser;
  onRestrictedAttempt?: (reason: string) => void;
  onOpenMobileAppModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  onNavigate,
  openPositionsCount = 0,
  conflictsCount = 0,
  currentUser,
  onRestrictedAttempt,
  onOpenMobileAppModal,
}) => {
  const currentRole = currentUser ? normalizeRole(currentUser.role) : normalizeRole('ADMIN');

  const handleSelect = (view: ActiveView) => {
    const access = canAccessView(view, currentRole);
    if (!access.allowed) {
      if (onRestrictedAttempt && access.reason) {
        onRestrictedAttempt(access.reason);
      }
      return;
    }
    if (onNavigate) onNavigate(view);
    else if (setActiveView) setActiveView(view);
  };

  const menuSections: {
    title: string;
    items: { id: ActiveView; label: string; icon: React.FC<{ className?: string }>; badge?: number; badgeColor?: string }[];
  }[] = [
    {
      title: 'OPERATIONS',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'portal', label: 'Crew Member Portal', icon: UserCheck },
        { id: 'flights', label: 'Flight Monitoring', icon: Plane },
        { id: 'crew', label: 'Crew Database', icon: Users },
        { id: 'q400', label: 'Q400 Fleet', icon: Layers },
        { id: 'b737', label: 'B737 Fleet', icon: Plane },
      ],
    },
    {
      title: 'SCHEDULING & HOURS',
      items: [
        { id: 'scheduling', label: 'Crew Scheduling', icon: ShieldCheck },
        {
          id: 'scheduler',
          label: 'Auto Scheduler',
          icon: Cpu,
          badge: openPositionsCount > 0 ? openPositionsCount : undefined,
          badgeColor: 'bg-[#F37C1C]',
        },
        { id: 'calendar', label: 'Roster Calendar', icon: CalendarDays },
        { id: 'crewhours', label: 'Crew Hours (FD/CC)', icon: Timer },
      ],
    },
    {
      title: 'COMPLIANCE & FATIGUE',
      items: [
        { id: 'fatigue', label: 'Fatigue Monitoring', icon: Flame },
        { id: 'recency', label: 'Recency Tracker', icon: Clock },
        { id: 'linechecks', label: 'Line Check Tracker', icon: CheckSquare },
        {
          id: 'documents',
          label: 'License & Documents',
          icon: FileCheck2,
          badge: conflictsCount > 0 ? conflictsCount : undefined,
          badgeColor: 'bg-red-600',
        },
        { id: 'leave', label: 'Leave & Availability', icon: CalendarOff },
        { id: 'training', label: 'Training Tracker', icon: GraduationCap },
      ],
    },
    {
      title: 'ANALYTICS & SYSTEM',
      items: [
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
        { id: 'guide', label: 'Staff Training & Guide', icon: BookOpen },
        { id: 'users', label: 'User Access & Roles', icon: ShieldCheck },
        { id: 'assistant', label: 'AI Assistant', icon: Bot },
        { id: 'legacy', label: 'Legacy Excel Mapping', icon: FileCode2 },
        { id: 'settings', label: 'Settings & Rules', icon: Settings },
        { id: 'audit', label: 'Audit Log', icon: History },
      ],
    },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-white text-[#2E2C2B] flex-col h-screen shrink-0 border-r border-slate-200 shadow-sm select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-200/80 bg-slate-50/50">
        <ZambiaAirwaysLogo variant="dark" size="md" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {menuSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
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
                  title={isLocked ? access.reason : undefined}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#F37C1C] text-white shadow-xs'
                      : isLocked
                      ? 'text-slate-400 hover:bg-slate-50 opacity-60'
                      : 'text-[#2E2C2B] hover:bg-slate-100 hover:text-[#1F1E1D]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : isLocked ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isLocked && (
                      <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                    {item.badge !== undefined && !isLocked && (
                      <span
                        className={`px-1.5 py-0.2 text-[10px] font-mono font-bold text-white rounded-full ${
                          item.badgeColor || 'bg-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Mobile App Hub Button */}
      {onOpenMobileAppModal && (
        <div className="px-3 pb-1">
          <button
            onClick={onOpenMobileAppModal}
            className="w-full py-2 px-3 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#F37C1C] rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
          >
            <Smartphone className="w-4 h-4 text-[#F37C1C]" />
            <span>Mobile App & PWA Hub</span>
          </button>
        </div>
      )}

      {/* Zambia Airways Footer / Info Card */}
      <div className="p-3 bg-slate-50 m-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-[#F37C1C] animate-pulse" />
          <span className="text-[10px] font-bold text-[#F37C1C] uppercase tracking-wider font-mono">
            Zambia Airways OCC
          </span>
        </div>
        <p className="text-[11px] text-slate-600 font-medium leading-tight">
          Zambia Airways (2014) Limited • Crew Control Center
        </p>
      </div>
    </aside>
  );
};

