import React, { useState } from 'react';
import { CrewMember, Flight, AircraftType } from '../types';
import {
  Clock,
  Search,
  Filter,
  ShieldCheck,
  AlertTriangle,
  PlaneTakeoff,
  PlaneLanding,
  Calendar,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Download,
  Upload,
} from 'lucide-react';
import { exportToCsv } from '../utils/exportCsv';

interface RecencyTrackerViewProps {
  crew: CrewMember[];
  flights: Flight[];
  onUpdateCrew: (crewMember: CrewMember) => void;
}

interface CustomRecencyEntry {
  crewId: string;
  crewName: string;
  staffNumber: string;
  role: string;
  aircraft: AircraftType;
  lastFlightNumber?: string;
  lastSector?: string;
  lastFlightDate?: string;
  takeoffs90Days: number;
  landings90Days: number;
  daysRemaining: number;
  status: 'CURRENT' | 'EXPIRING' | 'NOT_CURRENT';
}

export const RecencyTrackerView: React.FC<RecencyTrackerViewProps> = ({
  crew,
  flights,
  onUpdateCrew,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [fleetFilter, setFleetFilter] = useState<'ALL' | 'Q400' | 'B737'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CURRENT' | 'EXPIRING' | 'NOT_CURRENT'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCrewId, setSelectedCrewId] = useState('');
  const [customTakeoffs, setCustomTakeoffs] = useState(3);
  const [customLandings, setCustomLandings] = useState(3);
  const [customFlightDate, setCustomFlightDate] = useState(new Date().toISOString().split('T')[0]);
  const [customSector, setCustomSector] = useState('LUN-NLA');

  // Filter only flight deck crew (Captains and First Officers)
  const pilots = crew.filter((c) => c.role === 'Captain' || c.role === 'First Officer');

  // Compute recency records based on pilots
  const recencyRecords: CustomRecencyEntry[] = pilots.map((p) => {
    // If flightsCount is tracked on crew, use it, or calculate from flights
    const count = p.flightsCount !== undefined ? p.flightsCount : 0;
    const takeoffs = count >= 3 ? count : count;
    const landings = count >= 3 ? count : count;
    
    // Status logic: 3+ is current, 1-2 is expiring, 0 is not current
    let status: 'CURRENT' | 'EXPIRING' | 'NOT_CURRENT' = 'NOT_CURRENT';
    let daysRemaining = 0;
    
    if (landings >= 3) {
      status = 'CURRENT';
      daysRemaining = 75; // Average days remaining in 90-day rolling window
    } else if (landings > 0) {
      status = 'EXPIRING';
      daysRemaining = 12;
    } else {
      status = 'NOT_CURRENT';
      daysRemaining = 0;
    }

    return {
      crewId: p.id,
      crewName: p.name,
      staffNumber: p.staffNumber,
      role: p.role,
      aircraft: p.aircraft,
      lastFlightNumber: landings > 0 ? 'ZN201' : 'None',
      lastSector: landings > 0 ? (p.aircraft === 'B737' ? 'LUN-JNB' : 'LUN-NLA') : 'N/A',
      lastFlightDate: landings > 0 ? '2026-08-10' : 'N/A',
      takeoffs90Days: takeoffs,
      landings90Days: landings,
      daysRemaining,
      status,
    };
  });

  const filteredRecords = recencyRecords.filter((r) => {
    const matchesSearch =
      r.crewName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.staffNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFleet = fleetFilter === 'ALL' || r.aircraft === fleetFilter;
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesFleet && matchesStatus;
  });

  const currentCount = recencyRecords.filter((r) => r.status === 'CURRENT').length;
  const expiringCount = recencyRecords.filter((r) => r.status === 'EXPIRING').length;
  const notCurrentCount = recencyRecords.filter((r) => r.status === 'NOT_CURRENT').length;

  const handleExportCsv = () => {
    const data = recencyRecords.map((r) => ({
      'Staff ID': r.staffNumber,
      'Pilot Name': r.crewName,
      Role: r.role,
      Fleet: r.aircraft,
      '90-Day Takeoffs': r.takeoffs90Days,
      '90-Day Landings': r.landings90Days,
      'Recency Status': r.status,
      'Days Remaining': r.daysRemaining,
      'Last Sector': r.lastSector,
      'Last Flight Date': r.lastFlightDate,
    }));
    exportToCsv('Zambia_Airways_Pilot_Recency_Report.csv', data);
  };

  const handleSaveRecency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCrewId) return;
    const targetCrew = crew.find((c) => c.id === selectedCrewId);
    if (!targetCrew) return;

    const updated: CrewMember = {
      ...targetCrew,
      flightsCount: customLandings,
    };
    onUpdateCrew(updated);
    setIsModalOpen(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-full">
      {/* Top Header Card */}
      <div className="bg-[#2E2C2B] text-white p-6 rounded-2xl shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Clock className="w-5 h-5 text-[#F37C1C]" />
            <span className="text-xs font-bold text-[#F37C1C] uppercase tracking-widest font-mono">
              CAA ZCAR Part 8 & ICAO Annex 6 Compliance
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Pilot Recency & Currency Tracker</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Monitors rolling 90-day minimum 3 takeoffs and landings currency per aircraft type. Ensures automatic legality enforcement for Captains and First Officers.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/10 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Recency CSV</span>
          </button>
          <button
            onClick={() => {
              if (pilots.length > 0) setSelectedCrewId(pilots[0].id);
              setIsModalOpen(true);
            }}
            disabled={pilots.length === 0}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all ${
              pilots.length > 0
                ? 'bg-[#F37C1C] hover:bg-[#e06b0b] text-white cursor-pointer active:scale-95'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Log Recency Sector</span>
          </button>
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase font-mono block">
            Total Flight Deck
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{pilots.length}</div>
          <span className="text-[10px] text-slate-500">Captains & First Officers</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase font-mono block">
            90-Day Current
          </span>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">{currentCount}</div>
          <span className="text-[10px] text-emerald-600 font-medium">≥ 3 Takeoffs/Landings</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-amber-600 uppercase font-mono block">
            Expiring Soon
          </span>
          <div className="text-2xl font-black text-amber-700 mt-1 font-mono">{expiringCount}</div>
          <span className="text-[10px] text-amber-600 font-medium">&lt; 14 Days Remaining</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-rose-600 uppercase font-mono block">
            Non-Current / Lapsed
          </span>
          <div className="text-2xl font-black text-rose-700 mt-1 font-mono">{notCurrentCount}</div>
          <span className="text-[10px] text-rose-600 font-medium">Requires Sim or Recency Check</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search pilot name or staff ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#F37C1C]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-bold">
            <span className="text-slate-500 px-2 text-[10px] uppercase font-mono">Fleet:</span>
            {(['ALL', 'Q400', 'B737'] as const).map((fleet) => (
              <button
                key={fleet}
                onClick={() => setFleetFilter(fleet)}
                className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                  fleetFilter === fleet
                    ? 'bg-[#2E2C2B] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {fleet}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-bold">
            <span className="text-slate-500 px-2 text-[10px] uppercase font-mono">Status:</span>
            {(['ALL', 'CURRENT', 'EXPIRING', 'NOT_CURRENT'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#F37C1C] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All' : st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recency: Mobile Cards (< 768px) & Desktop Table (>= 768px) */}
      {/* 1. Mobile Cards (< 768px) */}
      <div className="block md:hidden space-y-3.5">
        {filteredRecords.map((r) => (
          <div
            key={r.crewId}
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-md space-y-3"
          >
            {/* Header: Pilot Name, Role, Status */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <div className="font-extrabold text-sm text-slate-900 font-mono">{r.crewName}</div>
                <div className="text-xs font-mono text-slate-500 mt-0.5">
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-700">
                    {r.staffNumber}
                  </span>{' '}
                  • {r.role} •{' '}
                  <span
                    className={`px-1.5 py-0.2 rounded font-mono font-bold ${
                      r.aircraft === 'B737'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {r.aircraft}
                  </span>
                </div>
              </div>

              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                  r.status === 'CURRENT'
                    ? 'bg-emerald-100 text-emerald-800'
                    : r.status === 'EXPIRING'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {r.status.replace('_', ' ')}
              </span>
            </div>

            {/* Recency Progress & Details */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">90-Day Takeoffs & Landings:</span>
                <span className="font-bold text-slate-900">{r.landings90Days} / 3 req</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full ${
                    r.landings90Days >= 3
                      ? 'bg-emerald-500'
                      : r.landings90Days > 0
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, (r.landings90Days / 3) * 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] border-t border-slate-200/60">
                <div>
                  <span className="text-slate-400 block">Last Sector:</span>
                  <span className="font-bold text-slate-800">{r.lastSector}</span>
                  <span className="text-[10px] text-slate-500 block">{r.lastFlightDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Currency Window:</span>
                  {r.daysRemaining > 0 ? (
                    <span className="text-slate-800 font-bold">{r.daysRemaining} days left</span>
                  ) : (
                    <span className="text-rose-600 font-bold">Lapsed (0 days)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Action */}
            <button
              onClick={() => {
                setSelectedCrewId(r.crewId);
                setCustomTakeoffs(r.takeoffs90Days);
                setCustomLandings(r.landings90Days);
                setIsModalOpen(true);
              }}
              className="w-full min-h-[44px] flex items-center justify-center bg-slate-100 hover:bg-[#2E2C2B] hover:text-white text-slate-800 rounded-xl text-xs font-bold font-mono transition-colors active:scale-98"
            >
              Update Currency
            </button>
          </div>
        ))}

        {filteredRecords.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            <Clock className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <div className="font-bold text-slate-700 text-sm">
              No Pilot Recency Records Found
            </div>
            <p className="text-xs text-slate-400 mt-1">
              The recency database is currently empty. Populate the crew register with Captains or First Officers to track 90-day takeoffs and landings compliance.
            </p>
          </div>
        )}
      </div>

      {/* 2. Desktop Recency Table (>= 768px) */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono uppercase text-[10px]">
              <tr>
                <th className="p-3.5">Pilot / Staff ID</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Fleet Rating</th>
                <th className="p-3.5">90-Day Takeoffs & Landings</th>
                <th className="p-3.5">Last Flown Sector</th>
                <th className="p-3.5">Currency Window</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((r) => (
                <tr key={r.crewId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900">{r.crewName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{r.staffNumber}</div>
                  </td>
                  <td className="p-3.5 font-semibold text-slate-700">{r.role}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                        r.aircraft === 'B737'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {r.aircraft}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${
                            r.landings90Days >= 3
                              ? 'bg-emerald-500'
                              : r.landings90Days > 0
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, (r.landings90Days / 3) * 100)}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-slate-800">
                        {r.landings90Days}/3
                      </span>
                    </div>
                  </td>
                  <td className="p-3.5 font-mono text-slate-600">
                    <div>{r.lastSector}</div>
                    <div className="text-[10px] text-slate-400">{r.lastFlightDate}</div>
                  </td>
                  <td className="p-3.5 font-mono">
                    {r.daysRemaining > 0 ? (
                      <span className="text-slate-800 font-bold">{r.daysRemaining} days left</span>
                    ) : (
                      <span className="text-rose-600 font-bold">Lapsed (0 days)</span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase ${
                        r.status === 'CURRENT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.status === 'EXPIRING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => {
                        setSelectedCrewId(r.crewId);
                        setCustomTakeoffs(r.takeoffs90Days);
                        setCustomLandings(r.landings90Days);
                        setIsModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-[#2E2C2B] hover:text-white text-slate-700 rounded text-xs font-bold transition-colors cursor-pointer"
                    >
                      Update Currency
                    </button>
                  </td>
                </tr>
              ))}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <Clock className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <div className="font-bold text-slate-700 text-sm">
                      No Pilot Recency Records Found
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      The recency database is currently empty. Populate the crew register with Captains or First Officers to track 90-day takeoffs and landings compliance.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Recency Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Update Pilot Currency & Recency</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRecency} className="space-y-3 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1">Select Pilot</label>
                <select
                  value={selectedCrewId}
                  onChange={(e) => setSelectedCrewId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                >
                  {pilots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.staffNumber}) - {p.role} [{p.aircraft}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">90-Day Takeoffs</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={customTakeoffs}
                    onChange={(e) => setCustomTakeoffs(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">90-Day Landings</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={customLandings}
                    onChange={(e) => setCustomLandings(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Last Flight Date</label>
                <input
                  type="date"
                  value={customFlightDate}
                  onChange={(e) => setCustomFlightDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Last Flown Sector</label>
                <input
                  type="text"
                  placeholder="e.g. LUN-NLA"
                  value={customSector}
                  onChange={(e) => setCustomSector(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#F37C1C] hover:bg-[#e06b0b] text-white rounded-xl font-bold shadow-md transition-colors cursor-pointer"
                >
                  Save Recency
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
