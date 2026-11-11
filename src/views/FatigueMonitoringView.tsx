import React, { useState } from 'react';
import { CrewMember, Flight, Assignment, LegalityRules } from '../types';
import { ShieldAlert, AlertTriangle, CheckCircle2, Filter, Activity, Users, Flame } from 'lucide-react';

interface FatigueMonitoringViewProps {
  crew: CrewMember[];
  flights: Flight[];
  assignments: Assignment[];
  rules: LegalityRules;
}

export const FatigueMonitoringView: React.FC<FatigueMonitoringViewProps> = ({
  crew,
  flights,
  assignments,
  rules,
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'pilots_summary' | 'cc_summary'>('matrix');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'PILOTS' | 'CABIN_CREW'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'GREEN' | 'AMBER' | 'RED'>('ALL');

  const calculateFatigueMetrics = (crewId: string) => {
    const now = new Date();
    let block7 = 0;
    let block14 = 0;
    let block30 = 0;
    let flightsCount = 0;
    let dutiesCount = 0;

    const crewAssignments = assignments.filter((a) => {
      if (a.captainId === crewId || a.firstOfficerId === crewId) return true;
      if (a.cabinCrewIds && a.cabinCrewIds.includes(crewId)) return true;
      return false;
    });

    crewAssignments.forEach((a) => {
      const flight = flights.find((f) => f.id === a.flightId);
      if (!flight) return;

      const flightDate = new Date(flight.date);
      const diffDays = (now.getTime() - flightDate.getTime()) / (1000 * 3600 * 24);

      if (diffDays >= 0 && diffDays <= 7) block7 += flight.blockHours || 0;
      if (diffDays >= 0 && diffDays <= 14) block14 += flight.blockHours || 0;
      if (diffDays >= 0 && diffDays <= 30) block30 += flight.blockHours || 0;

      flightsCount++;
      dutiesCount++;
    });

    // Determine status relative to configured rules
    // Default threshold: 30-day block hours limit (e.g. 90h)
    const maxLimit = rules.maxMonthlyBlockHours || 90;
    const amberThreshold = maxLimit * 0.85; // 85% of limit

    let status: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
    if (block30 >= maxLimit) status = 'RED';
    else if (block30 >= amberThreshold) status = 'AMBER';

    return {
      block7: Number(block7.toFixed(1)),
      block14: Number(block14.toFixed(1)),
      block30: Number(block30.toFixed(1)),
      flightsCount,
      dutiesCount,
      status,
      utilizationPercent: Math.round((block30 / maxLimit) * 100),
    };
  };

  const fatigueData = crew.map((c) => ({
    crewMember: c,
    metrics: calculateFatigueMetrics(c.id),
  }));

  const filteredData = fatigueData.filter(({ crewMember: c, metrics }) => {
    let matchesRole = true;
    if (roleFilter === 'PILOTS') matchesRole = c.role === 'Captain' || c.role === 'First Officer';
    if (roleFilter === 'CABIN_CREW') matchesRole = c.role === 'Senior Cabin Crew' || c.role === 'Cabin Crew';

    const matchesStatus = statusFilter === 'ALL' || metrics.status === statusFilter;
    return matchesRole && matchesStatus;
  });

  const greenCount = fatigueData.filter((d) => d.metrics.status === 'GREEN').length;
  const amberCount = fatigueData.filter((d) => d.metrics.status === 'AMBER').length;
  const redCount = fatigueData.filter((d) => d.metrics.status === 'RED').length;

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-full">
      {/* Header Banner */}
      <div className="bg-[#2E2C2B] text-white p-6 rounded-xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-5 h-5 text-[#F37C1C]" />
            <span className="text-xs font-bold text-[#F37C1C] uppercase tracking-widest font-mono">
              Source Workbook: "Fatigue Monitoring" Sheets
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Crew Fatigue Risk & Duty Hours Dashboard</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Centralized fatigue monitoring for Flight Deck & Cabin Crew across Q400 and B737 multi-crew positions. Evaluates rolling duty windows (7d, 14d, 30d) against configurable operational planning limits.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-lg border border-white/10 shrink-0">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'matrix' ? 'bg-[#F37C1C] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            Fatigue Matrix
          </button>
          <button
            onClick={() => setActiveTab('pilots_summary')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'pilots_summary' ? 'bg-[#F37C1C] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            Fatigue Summary - Pilots
          </button>
          <button
            onClick={() => setActiveTab('cc_summary')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'cc_summary' ? 'bg-[#F37C1C] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            Fatigue Summary - CC
          </button>
        </div>
      </div>

      {/* Status Indicators KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Active Crew</span>
          <div className="text-2xl font-black text-[#2E2C2B] mt-1">{fatigueData.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Green (Normal)</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{greenCount}</div>
          <span className="text-[10px] text-slate-400 font-mono">&lt;85% of monthly limit</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Amber (Approaching)</span>
          <div className="text-2xl font-black text-amber-600 mt-1">{amberCount}</div>
          <span className="text-[10px] text-amber-600 font-mono font-bold">85% - 99% threshold</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Red (Limit Reached)</span>
          <div className="text-2xl font-black text-red-600 mt-1">{redCount}</div>
          <span className="text-[10px] text-red-600 font-mono font-bold">≥100% of planning limit</span>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500 font-mono uppercase">Crew Type:</span>
          <select
            value={roleFilter}
            onChange={(e: any) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
          >
            <option value="ALL">All Crew Categories</option>
            <option value="PILOTS">Pilots (Flight Deck)</option>
            <option value="CABIN_CREW">Cabin Crew Only</option>
          </select>

          <span className="text-xs font-bold text-slate-500 font-mono uppercase ml-4">Fatigue Status:</span>
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="GREEN">Green Only</option>
            <option value="AMBER">Amber Only</option>
            <option value="RED">Red Only</option>
          </select>
        </div>

        <span className="text-[11px] text-slate-400 font-mono italic">
          Planning Limit: {rules.maxMonthlyBlockHours || 90} hrs/month
        </span>
      </div>

      {/* Main Fatigue Matrix Table */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-200 font-mono">
                <tr>
                  <th className="p-3.5">Staff No</th>
                  <th className="p-3.5">Crew Member</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">A/C</th>
                  <th className="p-3.5">Last 7d Block</th>
                  <th className="p-3.5">Last 14d Block</th>
                  <th className="p-3.5">Last 30d Block</th>
                  <th className="p-3.5">Utilization %</th>
                  <th className="p-3.5">Fatigue Indicator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredData.map(({ crewMember: c, metrics }) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-500">{c.staffNumber}</td>
                    <td className="p-3.5 font-bold text-slate-900">{c.name}</td>
                    <td className="p-3.5 text-slate-600">{c.role}</td>
                    <td className="p-3.5 font-mono font-bold">{c.aircraft}</td>
                    <td className="p-3.5 font-mono font-bold text-blue-700">{metrics.block7} hrs</td>
                    <td className="p-3.5 font-mono font-bold text-blue-900">{metrics.block14} hrs</td>
                    <td className="p-3.5 font-mono font-bold text-indigo-900">{metrics.block30} hrs</td>

                    <td className="p-3.5 font-mono">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              metrics.status === 'RED'
                                ? 'bg-red-600'
                                : metrics.status === 'AMBER'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, metrics.utilizationPercent)}%` }}
                          />
                        </div>
                        <span className="font-bold">{metrics.utilizationPercent}%</span>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase ${
                        metrics.status === 'GREEN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : metrics.status === 'AMBER'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {metrics.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400 font-mono text-xs">
                      No crew members monitored for fatigue. The crew database is currently empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fatigue Summary - Pilots */}
      {activeTab === 'pilots_summary' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
            Fatigue Summary — Pilots
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredData
              .filter(({ crewMember: c }) => c.role === 'Captain' || c.role === 'First Officer')
              .map(({ crewMember: c, metrics }) => (
                <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-slate-500">{c.staffNumber}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                      metrics.status === 'GREEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {metrics.status}
                    </span>
                  </div>
                  <h3 className="font-black text-slate-900 text-base mb-1">{c.name}</h3>
                  <p className="text-xs text-slate-500 mb-3 font-mono">{c.role} • {c.aircraft}</p>

                  <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-slate-100">
                    <div className="p-2 bg-slate-50 rounded">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">7-Day Duty</span>
                      <span className="text-sm font-black text-slate-800 font-mono">{metrics.block7} hrs</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">30-Day Duty</span>
                      <span className="text-sm font-black text-slate-800 font-mono">{metrics.block30} hrs</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Fatigue Summary - Cabin Crew */}
      {activeTab === 'cc_summary' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
            Fatigue Summary — Cabin Crew
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredData
              .filter(({ crewMember: c }) => c.role === 'Senior Cabin Crew' || c.role === 'Cabin Crew')
              .map(({ crewMember: c, metrics }) => (
                <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-slate-500">{c.staffNumber}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                      metrics.status === 'GREEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {metrics.status}
                    </span>
                  </div>
                  <h3 className="font-black text-slate-900 text-base mb-1">{c.name}</h3>
                  <p className="text-xs text-slate-500 mb-3 font-mono">{c.role} • {c.aircraft}</p>

                  <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-slate-100">
                    <div className="p-2 bg-slate-50 rounded">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">7-Day Duty</span>
                      <span className="text-sm font-black text-slate-800 font-mono">{metrics.block7} hrs</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">30-Day Duty</span>
                      <span className="text-sm font-black text-slate-800 font-mono">{metrics.block30} hrs</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
