import React, { useState } from 'react';
import { Flight, Assignment, CrewMember, AircraftType } from '../types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
} from 'lucide-react';

interface RosterCalendarViewProps {
  flights: Flight[];
  assignments: Assignment[];
  crew: CrewMember[];
  onUpdateAssignment: (assignment: Assignment) => void;
}

export const RosterCalendarView: React.FC<RosterCalendarViewProps> = ({
  flights,
  assignments,
  crew,
  onUpdateAssignment,
}) => {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date('2026-08-10'));
  const [aircraftFilter, setAircraftFilter] = useState<AircraftType | 'ALL'>('ALL');
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);

  // Assignment edit state inside flight detail modal
  const [modalCaptainId, setModalCaptainId] = useState<string>('');
  const [modalFOId, setModalFOId] = useState<string>('');
  const [modalSeniorCCId, setModalSeniorCCId] = useState<string>('');
  const [modalCabinCrewIds, setModalCabinCrewIds] = useState<string[]>([]);

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  // Filter flights by aircraft
  const filteredFlights = flights.filter((f) => {
    if (aircraftFilter !== 'ALL' && f.aircraft !== aircraftFilter) return false;
    return true;
  });

  // Month Grid Calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthDays: (string | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    monthDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    monthDays.push(dStr);
  }

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const handleOpenFlightModal = (flight: Flight) => {
    setSelectedFlight(flight);
    const asg = assignments.find((a) => a.flightId === flight.id);
    setModalCaptainId(asg?.captainId || '');
    setModalFOId(asg?.firstOfficerId || '');
    
    // Check senior cabin crew vs cabin crew
    const allCcIds = asg?.cabinCrewIds || [];
    const seniorMember = crew.find((c) => allCcIds.includes(c.id) && (c.role === 'Senior Cabin Crew' || c.qualifications.includes('SCC')));
    const regularCcIds = allCcIds.filter((id) => id !== seniorMember?.id);

    setModalSeniorCCId(seniorMember?.id || (allCcIds.length > 0 ? allCcIds[0] : ''));
    setModalCabinCrewIds(seniorMember ? regularCcIds : allCcIds.slice(1));
  };

  const handleSaveModalAssignment = () => {
    if (!selectedFlight) return;
    const existing = assignments.find((a) => a.flightId === selectedFlight.id);

    const combinedCcIds = [modalSeniorCCId, ...modalCabinCrewIds].filter(Boolean);
    const isFullyAssigned = Boolean(modalCaptainId && modalFOId && combinedCcIds.length > 0);
    const updated: Assignment = {
      id: existing?.id || `asg-${selectedFlight.id}`,
      flightId: selectedFlight.id,
      captainId: modalCaptainId || undefined,
      firstOfficerId: modalFOId || undefined,
      cabinCrewIds: combinedCcIds,
      assignedAt: new Date().toISOString(),
      status: isFullyAssigned ? 'ASSIGNED' : modalCaptainId || modalFOId || combinedCcIds.length > 0 ? 'OPEN' : 'CONFLICT',
    };

    onUpdateAssignment(updated);
    setSelectedFlight(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Calendar Control Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        {/* Navigation & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => navigateDate('prev')}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date('2026-08-10'))}
              className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => navigateDate('next')}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors shadow-xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 font-mono">
            {monthNames[month]} {year}
          </h2>
        </div>

        {/* View Switcher & Aircraft Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Aircraft Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
            <button
              onClick={() => setAircraftFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                aircraftFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ALL FLEET
            </button>
            <button
              onClick={() => setAircraftFilter('Q400')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                aircraftFilter === 'Q400'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Q400
            </button>
            <button
              onClick={() => setAircraftFilter('B737')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                aircraftFilter === 'B737'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              B737
            </button>
          </div>

          {/* View Mode */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === 'month'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === 'week'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded-lg transition-all ${
                viewMode === 'day'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day
            </button>
          </div>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700">
        <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 font-mono">
          Assignment Status Colors:
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>GREEN = Fully Assigned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span>AMBER = Partially Assigned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-600" />
          <span>RED = Open / Unassigned Position</span>
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <>
          {/* 1. Mobile Agenda View (< 768px) */}
          <div className="block md:hidden space-y-4">
            {monthDays
              .filter((d): d is string => Boolean(d))
              .map((dateStr) => {
                const dayNum = parseInt(dateStr.split('-')[2]);
                const dayDate = new Date(dateStr);
                const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                const dayFlights = filteredFlights.filter((f) => f.date === dateStr);

                if (dayFlights.length === 0) return null;

                return (
                  <div
                    key={`mobile-day-${dateStr}`}
                    className="bg-white rounded-2xl border border-slate-200 shadow-md p-4 space-y-3"
                  >
                    {/* Day Date Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-[#2E2C2B] text-white flex items-center justify-center font-mono font-black text-sm">
                          {dayNum}
                        </span>
                        <div>
                          <span className="font-extrabold text-slate-900 font-mono text-xs uppercase">
                            {dayName}, {dateStr}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-mono font-bold">
                        {dayFlights.length} {dayFlights.length === 1 ? 'Flight' : 'Flights'}
                      </span>
                    </div>

                    {/* Flight Cards for this day */}
                    <div className="space-y-2.5">
                      {dayFlights.map((flight) => {
                        const asg = assignments.find((a) => a.flightId === flight.id);
                        const cpt = crew.find((c) => c.id === asg?.captainId);
                        const fo = crew.find((c) => c.id === asg?.firstOfficerId);

                        const isFullyAssigned = Boolean(cpt && fo);
                        const isPartial = Boolean(cpt || fo) && !isFullyAssigned;

                        let cardBorder = 'border-rose-300 bg-rose-50/40 text-rose-950';
                        let statusText = 'OPEN / UNASSIGNED';
                        let statusBadge = 'bg-rose-100 text-rose-800 border-rose-200';

                        if (isFullyAssigned) {
                          cardBorder = 'border-emerald-300 bg-emerald-50/40 text-emerald-950';
                          statusText = 'FULLY ASSIGNED';
                          statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                        } else if (isPartial) {
                          cardBorder = 'border-amber-300 bg-amber-50/40 text-amber-950';
                          statusText = 'PARTIALLY ASSIGNED';
                          statusBadge = 'bg-amber-100 text-amber-800 border-amber-200';
                        }

                        return (
                          <div
                            key={flight.id}
                            onClick={() => handleOpenFlightModal(flight)}
                            className={`p-3.5 rounded-xl border ${cardBorder} shadow-2xs space-y-2.5 cursor-pointer active:scale-[0.98] transition-all`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm font-mono text-slate-900">
                                  {flight.flightNumber}
                                </span>
                                <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-mono font-bold">
                                  {flight.aircraft}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-xs text-slate-700">
                                STD {flight.std}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs font-mono text-slate-600">
                              <div>
                                Route: <span className="font-bold text-slate-900">{flight.departure} → {flight.arrival}</span>
                              </div>
                              <div>
                                Block: <span className="font-bold text-slate-900">{flight.blockHours}h</span>
                              </div>
                            </div>

                            {/* Crew Assignment Details */}
                            <div className="bg-white/90 rounded-lg p-2.5 border border-slate-200/80 space-y-1 text-xs font-mono">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 font-semibold">Captain:</span>
                                <span className={`font-bold ${cpt ? 'text-slate-900' : 'text-rose-600'}`}>
                                  {cpt ? cpt.name : 'UNASSIGNED'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 font-semibold">First Officer:</span>
                                <span className={`font-bold ${fo ? 'text-slate-900' : 'text-rose-600'}`}>
                                  {fo ? fo.name : 'UNASSIGNED'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${statusBadge}`}>
                                {statusText}
                              </span>
                              <span className="text-[11px] font-mono font-bold text-[#F37C1C]">
                                Tap to Assign Crew →
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

            {filteredFlights.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                <p className="text-sm font-bold text-slate-800 font-mono">No Flights Scheduled</p>
                <p className="text-xs text-slate-500">
                  No flights match the current month or filter settings.
                </p>
              </div>
            )}
          </div>

          {/* 2. Desktop 7-Column Grid (>= 768px) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            {/* Day Names Header */}
            <div className="grid grid-cols-7 text-center font-mono font-bold text-xs text-slate-500 bg-slate-100 border-b border-slate-200 py-2.5">
              <div>SUN</div>
              <div>MON</div>
              <div>TUE</div>
              <div>WED</div>
              <div>THU</div>
              <div>FRI</div>
              <div>SAT</div>
            </div>

            {/* Month Days Grid */}
            <div className="grid grid-cols-7 border-b border-slate-200 auto-rows-fr">
              {monthDays.map((dateStr, idx) => {
                if (!dateStr) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-[130px] bg-slate-50/50 border-r border-b border-slate-100"
                    />
                  );
                }

                const dayNum = parseInt(dateStr.split('-')[2]);
                const dayFlights = filteredFlights.filter((f) => f.date === dateStr);

                return (
                  <div
                    key={dateStr}
                    className="min-h-[130px] p-1.5 border-r border-b border-slate-200 bg-white hover:bg-slate-50/50 transition-colors flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between font-mono text-xs mb-1 px-1">
                      <span className="font-bold text-slate-900">{dayNum}</span>
                      <span className="text-[10px] text-slate-400">
                        {dayFlights.length} flt
                      </span>
                    </div>

                    <div className="space-y-1 overflow-y-auto max-h-[110px] pr-0.5">
                      {dayFlights.map((flight) => {
                        const asg = assignments.find((a) => a.flightId === flight.id);
                        const cpt = crew.find((c) => c.id === asg?.captainId);
                        const fo = crew.find((c) => c.id === asg?.firstOfficerId);

                        const isFullyAssigned = Boolean(cpt && fo);
                        const isPartial = Boolean(cpt || fo) && !isFullyAssigned;

                        let colorBg = 'bg-rose-50 border-rose-300 text-rose-900';
                        if (isFullyAssigned) colorBg = 'bg-emerald-50 border-emerald-300 text-emerald-950';
                        else if (isPartial) colorBg = 'bg-amber-50 border-amber-300 text-amber-950';

                        return (
                          <div
                            key={flight.id}
                            onClick={() => handleOpenFlightModal(flight)}
                            className={`p-1.5 rounded-lg border text-[11px] cursor-pointer hover:scale-[1.02] transition-all shadow-2xs ${colorBg}`}
                          >
                            <div className="flex items-center justify-between font-bold font-mono">
                              <span>{flight.flightNumber} ({flight.aircraft})</span>
                              <span>{flight.std}</span>
                            </div>
                            <div className="text-[10px] opacity-80 font-mono">
                              {flight.departure} → {flight.arrival}
                            </div>
                            <div className="text-[10px] mt-0.5 truncate font-medium">
                              CPT: {cpt ? cpt.name.split(' ')[1] || cpt.name : 'OPEN'}
                            </div>
                            <div className="text-[10px] truncate font-medium">
                              FO: {fo ? fo.name.split(' ')[1] || fo.name : 'OPEN'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* WEEK / DAY VIEW */}
      {(viewMode === 'week' || viewMode === 'day') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 font-mono">
            Flights Schedule for {currentDate.toISOString().split('T')[0]}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFlights
              .filter((f) => f.date === currentDate.toISOString().split('T')[0])
              .map((flight) => {
                const asg = assignments.find((a) => a.flightId === flight.id);
                const cpt = crew.find((c) => c.id === asg?.captainId);
                const fo = crew.find((c) => c.id === asg?.firstOfficerId);

                const isFullyAssigned = Boolean(cpt && fo);
                const isPartial = Boolean(cpt || fo) && !isFullyAssigned;

                let cardBorder = 'border-rose-500 bg-rose-50/30';
                if (isFullyAssigned) cardBorder = 'border-emerald-500 bg-emerald-50/30';
                else if (isPartial) cardBorder = 'border-amber-500 bg-amber-50/30';

                return (
                  <div
                    key={flight.id}
                    onClick={() => handleOpenFlightModal(flight)}
                    className={`p-4 rounded-xl border-2 ${cardBorder} shadow-sm space-y-3 cursor-pointer hover:shadow-md transition-all`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-extrabold text-base text-slate-900 font-mono">
                        {flight.flightNumber}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-xs font-mono font-bold">
                        {flight.aircraft} ({flight.registration})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-slate-500">Route:</span>{' '}
                        <span className="font-bold">{flight.departure} → {flight.arrival}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">STD:</span>{' '}
                        <span className="font-bold">{flight.std}</span>
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Captain (CPT):</span>
                        <span className={`font-bold ${cpt ? 'text-slate-900' : 'text-rose-600'}`}>
                          {cpt ? cpt.name : 'UNASSIGNED'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">First Officer (FO):</span>
                        <span className={`font-bold ${fo ? 'text-slate-900' : 'text-rose-600'}`}>
                          {fo ? fo.name : 'UNASSIGNED'}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-slate-100 pt-1">
                        <span className="text-slate-500">Cabin Crew Compl.:</span>
                        <span className={`font-bold ${(asg?.cabinCrewIds && asg.cabinCrewIds.length > 0) ? 'text-slate-900' : 'text-amber-600'}`}>
                          {asg?.cabinCrewIds && asg.cabinCrewIds.length > 0 
                            ? `${asg.cabinCrewIds.length} Assigned (${crew.filter(c => asg.cabinCrewIds.includes(c.id)).map(c => c.name.split(' ')[0]).join(', ')})`
                            : 'UNASSIGNED'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Flight Crew Assignment Detail Modal */}
      {selectedFlight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-rose-600 font-mono">
                  {selectedFlight.date} • {selectedFlight.std} STD
                </span>
                <h3 className="text-xl font-black text-slate-900 font-mono">
                  Flight {selectedFlight.flightNumber} ({selectedFlight.aircraft})
                </h3>
                <p className="text-xs text-slate-500">
                  Route: {selectedFlight.departure} → {selectedFlight.arrival} ({selectedFlight.blockHours}h Block) • Reg: {selectedFlight.registration}
                </p>
              </div>
              <button
                onClick={() => setSelectedFlight(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                ✕
              </button>
            </div>

            {/* Captain Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Assigned Captain (CPT)
              </label>
              <select
                value={modalCaptainId}
                onChange={(e) => setModalCaptainId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">-- Select Captain --</option>
                {crew
                  .filter((c) => c.role === 'Captain' && c.aircraft === selectedFlight.aircraft)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.staffNumber}) - {c.base} Base ({c.monthlyBlockHours}h)
                    </option>
                  ))}
              </select>
            </div>

            {/* First Officer Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Assigned First Officer (FO)
              </label>
              <select
                value={modalFOId}
                onChange={(e) => setModalFOId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">-- Select First Officer --</option>
                {crew
                  .filter((c) => c.role === 'First Officer' && c.aircraft === selectedFlight.aircraft)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.staffNumber}) - {c.base} Base ({c.monthlyBlockHours}h)
                    </option>
                  ))}
              </select>
            </div>

            {/* Senior Cabin Crew Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Senior Cabin Crew / In-Flight Lead (SCC)
              </label>
              <select
                value={modalSeniorCCId}
                onChange={(e) => setModalSeniorCCId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">-- Select Senior Cabin Crew --</option>
                {crew
                  .filter((c) => c.role === 'Senior Cabin Crew' || c.qualifications.includes('SCC') || c.role === 'Cabin Crew')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.staffNumber}) - {c.role} [{c.qualifications.join(', ')}]
                    </option>
                  ))}
              </select>
            </div>

            {/* Cabin Crew Complement Selector */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cabin Crew ({selectedFlight.aircraft === 'Q400' ? 'Min 1 CC' : 'Min 2-3 CC'})
                </label>
                <span className="text-[11px] font-mono text-slate-500">
                  {modalCabinCrewIds.length} Selected
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1.5 text-xs">
                {crew
                  .filter((c) => (c.role === 'Cabin Crew' || c.role === 'Senior Cabin Crew') && c.id !== modalSeniorCCId)
                  .map((c) => {
                    const isChecked = modalCabinCrewIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                          isChecked ? 'bg-rose-100 text-rose-900 font-bold' : 'hover:bg-slate-200/60 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setModalCabinCrewIds([...modalCabinCrewIds, c.id]);
                            } else {
                              setModalCabinCrewIds(modalCabinCrewIds.filter((id) => id !== c.id));
                            }
                          }}
                          className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                        />
                        <span>{c.name} ({c.staffNumber})</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-auto">
                          {c.monthlyBlockHours}h
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedFlight(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModalAssignment}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                Save Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
