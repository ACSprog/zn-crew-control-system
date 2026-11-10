import React from 'react';
import { ActiveView } from '../types';
import {
  LayoutDashboard,
  UserCheck,
  Plane,
  Clock,
  Menu,
  Flame,
  CalendarDays,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  onOpenMenu: () => void;
  openPositionsCount?: number;
  conflictsCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onNavigate,
  onOpenMenu,
  openPositionsCount = 0,
  conflictsCount = 0,
}) => {
  const isMoreActive =
    ![
      'dashboard',
      'portal',
      'flights',
      'recency',
      'calendar',
    ].includes(activeView);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#2E2C2B]/95 backdrop-blur-md border-t border-slate-700/60 shadow-2xl px-2 py-1.5 flex justify-around items-center select-none pb-safe">
      {/* 1. Dashboard */}
      <button
        onClick={() => onNavigate('dashboard')}
        className={`flex flex-col items-center justify-center min-h-[48px] min-w-[52px] px-2 py-1 rounded-xl transition-all cursor-pointer ${
          activeView === 'dashboard'
            ? 'text-[#F37C1C] font-black'
            : 'text-slate-400 hover:text-slate-200 font-medium'
        }`}
        aria-label="OCC Dashboard"
      >
        <LayoutDashboard className={`w-5 h-5 ${activeView === 'dashboard' ? 'stroke-[2.5px] text-[#F37C1C]' : 'stroke-2'}`} />
        <span className="text-[10px] mt-0.5 tracking-tight font-mono">OCC</span>
      </button>

      {/* 2. Crew Portal */}
      <button
        onClick={() => onNavigate('portal')}
        className={`flex flex-col items-center justify-center min-h-[48px] min-w-[52px] px-2 py-1 rounded-xl transition-all cursor-pointer relative ${
          activeView === 'portal' || activeView === 'crewportal'
            ? 'text-[#F37C1C] font-black'
            : 'text-slate-400 hover:text-slate-200 font-medium'
        }`}
        aria-label="Crew Member Portal"
      >
        <UserCheck className={`w-5 h-5 ${activeView === 'portal' || activeView === 'crewportal' ? 'stroke-[2.5px] text-[#F37C1C]' : 'stroke-2'}`} />
        <span className="text-[10px] mt-0.5 tracking-tight font-mono">Portal</span>
      </button>

      {/* 3. Flights */}
      <button
        onClick={() => onNavigate('flights')}
        className={`flex flex-col items-center justify-center min-h-[48px] min-w-[52px] px-2 py-1 rounded-xl transition-all cursor-pointer ${
          activeView === 'flights'
            ? 'text-[#F37C1C] font-black'
            : 'text-slate-400 hover:text-slate-200 font-medium'
        }`}
        aria-label="Flight Schedule & Monitoring"
      >
        <Plane className={`w-5 h-5 ${activeView === 'flights' ? 'stroke-[2.5px] text-[#F37C1C]' : 'stroke-2'}`} />
        <span className="text-[10px] mt-0.5 tracking-tight font-mono">Flights</span>
      </button>

      {/* 4. Recency & Currency */}
      <button
        onClick={() => onNavigate('recency')}
        className={`flex flex-col items-center justify-center min-h-[48px] min-w-[52px] px-2 py-1 rounded-xl transition-all cursor-pointer relative ${
          activeView === 'recency'
            ? 'text-[#F37C1C] font-black'
            : 'text-slate-400 hover:text-slate-200 font-medium'
        }`}
        aria-label="Pilot Recency & Currency"
      >
        <Clock className={`w-5 h-5 ${activeView === 'recency' ? 'stroke-[2.5px] text-[#F37C1C]' : 'stroke-2'}`} />
        <span className="text-[10px] mt-0.5 tracking-tight font-mono">Recency</span>
      </button>

      {/* 5. More / Full Menu Drawer */}
      <button
        onClick={onOpenMenu}
        className={`flex flex-col items-center justify-center min-h-[48px] min-w-[52px] px-2 py-1 rounded-xl transition-all cursor-pointer relative ${
          isMoreActive
            ? 'text-[#F37C1C] font-black'
            : 'text-slate-400 hover:text-slate-200 font-medium'
        }`}
        aria-label="Open Full Navigation Menu"
      >
        <Menu className={`w-5 h-5 ${isMoreActive ? 'stroke-[2.5px] text-[#F37C1C]' : 'stroke-2'}`} />
        <span className="text-[10px] mt-0.5 tracking-tight font-mono">Menu</span>
        {(openPositionsCount > 0 || conflictsCount > 0) && (
          <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#F37C1C] animate-ping" />
        )}
      </button>
    </nav>
  );
};
