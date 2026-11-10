import React, { useState } from 'react';
import { CrewMember, LineCheckRecord } from '../types';
import { CheckSquare, Calendar as CalendarIcon, Search, Filter, ShieldCheck, AlertTriangle, Plus, Check } from 'lucide-react';

interface LineCheckTrackerViewProps {
  crew: CrewMember[];
  onUpdateCrew: (updatedMember: CrewMember) => void;
}

export const LineCheckTrackerView: React.FC<LineCheckTrackerViewProps> = ({ crew, onUpdateCrew }) => {
  const [activeTab, setActiveTab] = useState<'table' | 'calendar'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [aircraftFilter, setAircraftFilter] = useState<'ALL' | 'Q400' | 'B737'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CURRENT' | 'DUE_SOON' | 'OVERDUE'>('ALL');

  // Renewal Modal State
  const [editingCrew, setEditingCrew] = useState<CrewMember | null>(null);
  const [newLineCheckDate, setNewLineCheckDate] = useState('');

  const now = new Date();

  const calculateLineCheckStatus = (dateStr: string) => {
    if (!dateStr) return { days: 0, status: 'OVERDUE' as const };
    const diff = new Date(dateStr).getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    if (days <= 0) return { days, status: 'OVERDUE' as const };
    if (days <= 60) return { days, status: 'DUE_SOON' as const };
    return { days, status: 'CURRENT' as const };
  };

  const lineCheckRecords = crew.map((c) => {
    const { days, status } = calculateLineCheckStatus(c.lineCheck);
    return {
      id: `lc-${c.id}`,
      crewId: c.id,
      crewName: c.name,
      staffNumber: c.staffNumber,
      role: c.role,
      aircraft: c.aircraft,
      nextDueLineCheckDate: c.lineCheck,
      daysRemaining: days,
      status,
      crewMember: c,
    };
  });

  const filteredRecords = lineCheckRecords.filter((r) => {
    const matchesSearch =
      r.crewName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.staffNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAircraft = aircraftFilter === 'ALL' || r.aircraft === aircraftFilter;
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesAircraft && matchesStatus;
  });

  const handleOpenRenew = (record: typeof lineCheckRecords[0]) => {
    setEditingCrew(record.crewMember);
    setNewLineCheckDate(record.nextDueLineCheckDate);
  };

  const handleSaveRenewal = () => {
    if (!editingCrew || !newLineCheckDate) return;
    const updated: CrewMember = {
      ...editingCrew,
      lineCheck: newLineCheckDate,
    };
    onUpdateCrew(updated);
    setEditingCrew(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-full">
      {/* Top Banner */}
      <div className="bg-[#2E2C2B] text-white p-6 rounded-xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckSquare className="w-5 h-5 text-[#F37C1C]" />
            <span className="text-xs font-bold text-[#F37C1C] uppercase tracking-widest font-mono">
              CAA Flight Operations Compliance
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Line Check Tracker & Renewal Schedule</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Recreates the Zambia Airways annual line check schedule. Tracks mandatory line evaluation expiries for Captains, First Officers, and Cabin Crew.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-lg border border-white/10 shrink-0">
          <button
            onClick={() => setActiveTab('table')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'table' ? 'bg-[#F37C1C] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'calendar' ? 'bg-[#F37C1C] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            Schedule Calendar
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Crew Monitored</span>
          <div className="text-2xl font-black text-[#2E2C2B] mt-1">{lineCheckRecords.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Line Checks Current</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {lineCheckRecords.filter((r) => r.status === 'CURRENT').length}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Within 60 Days</span>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {lineCheckRecords.filter((r) => r.status === 'DUE_SOON').length}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overdue / Blocked</span>
          <div className="text-2xl font-black text-red-600 mt-1">
            {lineCheckRecords.filter((r) => r.status === 'OVERDUE').length}
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search pilot name or staff ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#001833]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={aircraftFilter}
            onChange={(e: any) => setAircraftFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Aircraft Fleets</option>
            <option value="Q400">Dash 8-Q400</option>
            <option value="B737">Boeing 737-800</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="CURRENT">Current (&gt;60 days)</option>
            <option value="DUE_SOON">Due Soon (&lt;60 days)</option>
            <option value="OVERDUE">Overdue / Expired</option>
          </select>
        </div>
      </div>

      {/* Table View */}
      {activeTab === 'table' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-200 font-mono">
                <tr>
                  <th className="p-3.5">Staff No</th>
                  <th className="p-3.5">Crew Member</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Aircraft</th>
                  <th className="p-3.5">Next Line Check Due</th>
                  <th className="p-3.5">Days Remaining</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-600">{r.staffNumber}</td>
                    <td className="p-3.5 font-bold text-slate-900">{r.crewName}</td>
                    <td className="p-3.5">{r.role}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        r.aircraft === 'B737' ? 'bg-orange-100 text-[#F37C1C]' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {r.aircraft}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-bold">{r.nextDueLineCheckDate}</td>
                    <td className="p-3.5 font-mono">
                      {r.daysRemaining > 0 ? `${r.daysRemaining} days` : <span className="text-red-600 font-bold">0 days (Overdue)</span>}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase ${
                        r.status === 'CURRENT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.status === 'DUE_SOON'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleOpenRenew(r)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-[#2E2C2B] hover:text-white text-slate-700 rounded text-xs font-bold transition-colors cursor-pointer"
                      >
                        Update Line Check
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400 font-mono text-xs">
                      No crew line check records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm font-mono flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[#2E2C2B]" />
            Line Check Due Dates Calendar Matrix
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredRecords.map((r) => (
              <div
                key={r.id}
                className={`p-4 rounded-xl border transition-all ${
                  r.status === 'OVERDUE'
                    ? 'border-red-300 bg-red-50/30'
                    : r.status === 'DUE_SOON'
                    ? 'border-amber-300 bg-amber-50/30'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold font-mono text-slate-500">{r.staffNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                    r.status === 'CURRENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {r.daysRemaining}d Left
                  </span>
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm mb-1">{r.crewName}</h4>
                <div className="text-xs text-slate-600 mb-3 font-mono">{r.role} • {r.aircraft}</div>

                <div className="p-2.5 bg-slate-100/70 rounded-lg text-xs flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">Next Line Check:</span>
                  <span className="font-mono font-bold text-slate-900">{r.nextDueLineCheckDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Renewal Modal */}
      {editingCrew && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              Update Line Check Date — {editingCrew.name}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Line Check Completion Date</label>
                <input
                  type="date"
                  value={newLineCheckDate}
                  onChange={(e) => setNewLineCheckDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingCrew(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRenewal}
                className="px-4 py-2 bg-[#001833] text-white rounded-lg font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                Save Line Check
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
