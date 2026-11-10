import React, { useState } from 'react';
import { CrewMember, Flight, Assignment } from '../types';
import { Clock, Users, Calendar, Filter, Download, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface CrewHoursViewProps {
  crew: CrewMember[];
  flights: Flight[];
  assignments: Assignment[];
}

export const CrewHoursView: React.FC<CrewHoursViewProps> = ({ crew, flights, assignments }) => {
  const [activeTab, setActiveTab] = useState<'fd' | 'cc' | 'pilot_summary' | 'cc_summary'>('fd');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'Captain' | 'First Officer'>('ALL');
  const [aircraftFilter, setAircraftFilter] = useState<'ALL' | 'Q400' | 'B737'>('ALL');

  // Helper to calculate crew hours for a given time window
  const calculateCrewHours = (crewId: string, daysBack?: number) => {
    const now = new Date();
    let totalBlock = 0;
    let totalFlight = 0;
    let flightsCount = 0;

    // Filter assignments for this crew member
    const crewAssignments = assignments.filter((a) => {
      if (a.captainId === crewId || a.firstOfficerId === crewId) return true;
      if (a.cabinCrewIds && a.cabinCrewIds.includes(crewId)) return true;
      return false;
    });

    crewAssignments.forEach((a) => {
      const flight = flights.find((f) => f.id === a.flightId);
      if (!flight) return;

      if (daysBack) {
        const flightDate = new Date(flight.date);
        const diffDays = (now.getTime() - flightDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays < 0 || diffDays > daysBack) return;
      }

      totalBlock += flight.blockHours || 1.5;
      totalFlight += Math.max(0.5, (flight.blockHours || 1.5) - 0.2); // Flight Time calculation
      flightsCount++;
    });

    return {
      blockHours: Number(totalBlock.toFixed(1)),
      flightHours: Number(totalFlight.toFixed(1)),
      flightsCount,
    };
  };

  // Monthly breakdown calculation
  const getMonthlyHours = (crewId: string, monthIndex: number) => {
    let monthBlock = 0;
    const crewAssignments = assignments.filter((a) => {
      if (a.captainId === crewId || a.firstOfficerId === crewId) return true;
      if (a.cabinCrewIds && a.cabinCrewIds.includes(crewId)) return true;
      return false;
    });

    crewAssignments.forEach((a) => {
      const flight = flights.find((f) => f.id === a.flightId);
      if (!flight) return;
      const d = new Date(flight.date);
      if (d.getMonth() === monthIndex) {
        monthBlock += flight.blockHours || 1.5;
      }
    });

    return Number(monthBlock.toFixed(1));
  };

  const pilots = crew.filter((c) => c.role === 'Captain' || c.role === 'First Officer');
  const cabinCrew = crew.filter((c) => c.role === 'Senior Cabin Crew' || c.role === 'Cabin Crew');

  const filteredPilots = pilots.filter((p) => {
    const matchesRole = roleFilter === 'ALL' || p.role === roleFilter;
    const matchesAircraft = aircraftFilter === 'ALL' || p.aircraft === aircraftFilter;
    return matchesRole && matchesAircraft;
  });

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-full">
      {/* Top Banner */}
      <div className="bg-[#2E2C2B] text-white p-6 rounded-xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-[#F37C1C]" />
            <span className="text-xs font-bold text-[#F37C1C] uppercase tracking-widest font-mono">
              Source Workbook: "Crew Hour Monitoring FD and CC.xlsm"
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Crew Daily Flight Hours & Monthly Summaries</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Recreates FD & CC Daily Flight Hour sheets and Pilot/Cabin Crew Summaries. Tracks rolling 7-day, 14-day, 30-day, monthly, and YTD flight deck & cabin crew cumulative block hours.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-lg border border-white/10 shrink-0">
          <button
            onClick={() => setActiveTab('fd')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'fd' ? 'bg-[#F37C1C] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            FD Flight Hours
          </button>
          <button
            onClick={() => setActiveTab('cc')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'cc' ? 'bg-[#F37C1C] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            CC Flight Hours
          </button>
          <button
            onClick={() => setActiveTab('pilot_summary')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'pilot_summary' ? 'bg-[#F37C1C] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            Pilot Summary
          </button>
          <button
            onClick={() => setActiveTab('cc_summary')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'cc_summary' ? 'bg-[#F37C1C] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            Cabin Crew Summary
          </button>
        </div>
      </div>

      {/* Filter Controls for FD/CC */}
      {(activeTab === 'fd' || activeTab === 'pilot_summary') && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 font-mono uppercase">Role:</span>
            <select
              value={roleFilter}
              onChange={(e: any) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
            >
              <option value="ALL">All Flight Deck Roles</option>
              <option value="Captain">Captains Only</option>
              <option value="First Officer">First Officers Only</option>
            </select>

            <span className="text-xs font-bold text-slate-500 font-mono uppercase ml-4">Aircraft:</span>
            <select
              value={aircraftFilter}
              onChange={(e: any) => setAircraftFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
            >
              <option value="ALL">All Fleets</option>
              <option value="Q400">Dash 8-Q400</option>
              <option value="B737">Boeing 737-800</option>
            </select>
          </div>

          <button className="px-3 py-1.5 bg-[#2E2C2B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-black cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
        </div>
      )}

      {/* FD Daily Flight Hours: Mobile Cards (< 768px) & Desktop Table (>= 768px) */}
      {activeTab === 'fd' && (
        <>
          {/* 1. Mobile Cards (< 768px) */}
          <div className="block md:hidden space-y-3.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                FD Flight Deck Hour Monitor
              </h2>
              <span className="text-xs font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                {filteredPilots.length} Pilots
              </span>
            </div>

            {filteredPilots.map((p) => {
              const h7 = calculateCrewHours(p.id, 7);
              const h14 = calculateCrewHours(p.id, 14);
              const h30 = calculateCrewHours(p.id, 30);
              const ytd = calculateCrewHours(p.id);

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-md space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900 font-mono">{p.name}</div>
                      <div className="text-xs font-mono text-slate-500">
                        {p.staffNumber} • {p.role} • {p.aircraft}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-700 block font-mono font-bold uppercase">YTD Block</span>
                      <span className="text-sm font-black text-emerald-800 font-mono">{ytd.blockHours} hrs</span>
                    </div>
                  </div>

                  {/* Rolling Windows Badges */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="p-2 bg-blue-50/70 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-blue-700 block font-bold uppercase">Last 7d</span>
                      <span className="text-sm font-black text-blue-900">{h7.blockHours}h</span>
                    </div>
                    <div className="p-2 bg-blue-50/70 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-blue-700 block font-bold uppercase">Last 14d</span>
                      <span className="text-sm font-black text-blue-900">{h14.blockHours}h</span>
                    </div>
                    <div className="p-2 bg-indigo-50/70 rounded-xl border border-indigo-100">
                      <span className="text-[10px] text-indigo-700 block font-bold uppercase">Last 30d</span>
                      <span className="text-sm font-black text-indigo-900">{h30.blockHours}h</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredPilots.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 font-mono text-xs">
                No pilot records found in the database.
              </div>
            )}
          </div>

          {/* 2. Desktop Table (>= 768px) */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-4">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
                Flight Deck (FD) Monthly & Rolling Hour Monitor
              </h2>
              <span className="text-xs font-mono text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded">
                {filteredPilots.length} Pilots Monitored
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-200 font-mono">
                  <tr>
                    <th className="p-3">Staff No</th>
                    <th className="p-3">Pilot Name</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">A/C</th>
                    <th className="p-3 font-black text-[#2E2C2B]">Last 7d</th>
                    <th className="p-3 font-black text-[#2E2C2B]">Last 14d</th>
                    <th className="p-3 font-black text-[#2E2C2B]">Last 30d</th>
                    {MONTH_NAMES.map((m) => (
                      <th key={m} className="p-2 text-center text-slate-400 font-mono">
                        {m}
                      </th>
                    ))}
                    <th className="p-3 text-right font-black text-emerald-700">YTD Block</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredPilots.map((p) => {
                    const h7 = calculateCrewHours(p.id, 7);
                    const h14 = calculateCrewHours(p.id, 14);
                    const h30 = calculateCrewHours(p.id, 30);
                    const ytd = calculateCrewHours(p.id);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-bold text-slate-500">{p.staffNumber}</td>
                        <td className="p-3 font-bold text-slate-900 font-sans">{p.name}</td>
                        <td className="p-3 font-sans text-slate-600">{p.role}</td>
                        <td className="p-3 font-bold">{p.aircraft}</td>
                        <td className="p-3 font-bold text-blue-700 bg-blue-50/40">{h7.blockHours}h</td>
                        <td className="p-3 font-bold text-blue-800 bg-blue-50/40">{h14.blockHours}h</td>
                        <td className="p-3 font-bold text-indigo-900 bg-indigo-50/40">{h30.blockHours}h</td>

                        {MONTH_NAMES.map((_, idx) => {
                          const mVal = getMonthlyHours(p.id, idx);
                          return (
                            <td key={idx} className="p-2 text-center font-sans text-slate-600">
                              {mVal > 0 ? `${mVal}h` : '-'}
                            </td>
                          );
                        })}

                        <td className="p-3 text-right font-bold text-emerald-700 bg-emerald-50/40 font-sans">
                          {ytd.blockHours} hrs
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPilots.length === 0 && (
                    <tr>
                      <td colSpan={17} className="p-12 text-center text-slate-400 font-sans text-xs">
                        No pilot records in the database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* CC Daily Flight Hours: Mobile Cards (< 768px) & Desktop Table (>= 768px) */}
      {activeTab === 'cc' && (
        <>
          {/* 1. Mobile Cards (< 768px) */}
          <div className="block md:hidden space-y-3.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                CC Cabin Crew Hour Monitor
              </h2>
              <span className="text-xs font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                {cabinCrew.length} Cabin Crew
              </span>
            </div>

            {cabinCrew.map((c) => {
              const h7 = calculateCrewHours(c.id, 7);
              const h14 = calculateCrewHours(c.id, 14);
              const h30 = calculateCrewHours(c.id, 30);
              const ytd = calculateCrewHours(c.id);

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-md space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900 font-mono">{c.name}</div>
                      <div className="text-xs font-mono text-slate-500">
                        {c.staffNumber} • {c.role} • {c.aircraft}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-700 block font-mono font-bold uppercase">YTD Block</span>
                      <span className="text-sm font-black text-emerald-800 font-mono">{ytd.blockHours} hrs</span>
                    </div>
                  </div>

                  {/* Rolling Windows Badges */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="p-2 bg-blue-50/70 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-blue-700 block font-bold uppercase">Last 7d</span>
                      <span className="text-sm font-black text-blue-900">{h7.blockHours}h</span>
                    </div>
                    <div className="p-2 bg-blue-50/70 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-blue-700 block font-bold uppercase">Last 14d</span>
                      <span className="text-sm font-black text-blue-900">{h14.blockHours}h</span>
                    </div>
                    <div className="p-2 bg-indigo-50/70 rounded-xl border border-indigo-100">
                      <span className="text-[10px] text-indigo-700 block font-bold uppercase">Last 30d</span>
                      <span className="text-sm font-black text-indigo-900">{h30.blockHours}h</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {cabinCrew.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 font-mono text-xs">
                No cabin crew records in the database.
              </div>
            )}
          </div>

          {/* 2. Desktop Table (>= 768px) */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-4">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
                Cabin Crew (CC) Monthly & Rolling Hour Monitor
              </h2>
              <span className="text-xs font-mono text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded">
                {cabinCrew.length} Cabin Crew Monitored
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-200 font-mono">
                  <tr>
                    <th className="p-3">Staff No</th>
                    <th className="p-3">Crew Name</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">A/C</th>
                    <th className="p-3 font-black text-[#001833]">Last 7d</th>
                    <th className="p-3 font-black text-[#001833]">Last 14d</th>
                    <th className="p-3 font-black text-[#001833]">Last 30d</th>
                    {MONTH_NAMES.map((m) => (
                      <th key={m} className="p-2 text-center text-slate-400 font-mono">
                        {m}
                      </th>
                    ))}
                    <th className="p-3 text-right font-black text-emerald-700">YTD Block</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {cabinCrew.map((c) => {
                    const h7 = calculateCrewHours(c.id, 7);
                    const h14 = calculateCrewHours(c.id, 14);
                    const h30 = calculateCrewHours(c.id, 30);
                    const ytd = calculateCrewHours(c.id);

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-bold text-slate-500">{c.staffNumber}</td>
                        <td className="p-3 font-bold text-slate-900 font-sans">{c.name}</td>
                        <td className="p-3 font-sans text-slate-600">{c.role}</td>
                        <td className="p-3 font-bold">{c.aircraft}</td>
                        <td className="p-3 font-bold text-blue-700 bg-blue-50/40">{h7.blockHours}h</td>
                        <td className="p-3 font-bold text-blue-800 bg-blue-50/40">{h14.blockHours}h</td>
                        <td className="p-3 font-bold text-indigo-900 bg-indigo-50/40">{h30.blockHours}h</td>

                        {MONTH_NAMES.map((_, idx) => {
                          const mVal = getMonthlyHours(c.id, idx);
                          return (
                            <td key={idx} className="p-2 text-center font-sans text-slate-600">
                              {mVal > 0 ? `${mVal}h` : '-'}
                            </td>
                          );
                        })}

                        <td className="p-3 text-right font-bold text-emerald-700 bg-emerald-50/40 font-sans">
                          {ytd.blockHours} hrs
                        </td>
                      </tr>
                    );
                  })}
                  {cabinCrew.length === 0 && (
                    <tr>
                      <td colSpan={17} className="p-12 text-center text-slate-400 font-sans text-xs">
                        No cabin crew records in the database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Pilot Summary Sheet View */}
      {activeTab === 'pilot_summary' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-2">
              <Users className="w-4 h-4 text-[#001833]" />
              Recreated XLSM "Pilot Summary"
            </h2>
            <span className="text-xs text-slate-400 font-mono">Calculated directly from Zambia Airways Flight Database</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPilots.map((p) => {
              const h7 = calculateCrewHours(p.id, 7);
              const h30 = calculateCrewHours(p.id, 30);
              const ytd = calculateCrewHours(p.id);

              return (
                <div key={p.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-slate-500">{p.staffNumber}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-100 text-blue-800">
                      {p.role} • {p.aircraft}
                    </span>
                  </div>
                  <h3 className="font-black text-slate-900 text-base mb-3">{p.name}</h3>

                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100">
                    <div className="p-2 bg-slate-50 rounded">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Last 7 Days</span>
                      <span className="text-sm font-black text-blue-700 font-mono">{h7.blockHours} hrs</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Last 30 Days</span>
                      <span className="text-sm font-black text-indigo-900 font-mono">{h30.blockHours} hrs</span>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded">
                      <span className="text-[10px] text-emerald-700 block font-bold uppercase">YTD Block</span>
                      <span className="text-sm font-black text-emerald-800 font-mono">{ytd.blockHours} hrs</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cabin Crew Summary View */}
      {activeTab === 'cc_summary' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-2">
              <Users className="w-4 h-4 text-[#E31B23]" />
              Recreated XLSM "Cabin Crew Summary"
            </h2>
            <span className="text-xs text-slate-400 font-mono">Calculated directly from Zambia Airways Flight Database</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cabinCrew.map((c) => {
              const h7 = calculateCrewHours(c.id, 7);
              const h30 = calculateCrewHours(c.id, 30);
              const ytd = calculateCrewHours(c.id);

              return (
                <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-slate-500">{c.staffNumber}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-100 text-rose-800">
                      {c.role} • {c.aircraft}
                    </span>
                  </div>
                  <h3 className="font-black text-slate-900 text-base mb-3">{c.name}</h3>

                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100">
                    <div className="p-2 bg-slate-50 rounded">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Last 7 Days</span>
                      <span className="text-sm font-black text-blue-700 font-mono">{h7.blockHours} hrs</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Last 30 Days</span>
                      <span className="text-sm font-black text-indigo-900 font-mono">{h30.blockHours} hrs</span>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded">
                      <span className="text-[10px] text-emerald-700 block font-bold uppercase">YTD Block</span>
                      <span className="text-sm font-black text-emerald-800 font-mono">{ytd.blockHours} hrs</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
