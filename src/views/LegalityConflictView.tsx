import React, { useState, useMemo } from 'react';
import {
  CrewMember,
  Flight,
  Assignment,
  LeaveTrainingRecord,
  LegalityRules,
  ConflictCheckResult,
} from '../types';
import { validateCrewLegality, scanRosterLegalityConflicts } from '../utils/legalityEngine';
import {
  ShieldAlert,
  AlertTriangle,
  XCircle,
  Plane,
  User,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface LegalityConflictViewProps {
  crew: CrewMember[];
  flights: Flight[];
  assignments: Assignment[];
  leaveRecords: LeaveTrainingRecord[];
  rules: LegalityRules;
}

export const LegalityConflictView: React.FC<LegalityConflictViewProps> = ({
  crew,
  flights,
  assignments,
  leaveRecords,
  rules,
}) => {
  const [selectedCrewId, setSelectedCrewId] = useState<string>(crew[0]?.id || '');
  const [selectedFlightId, setSelectedFlightId] = useState<string>(flights[0]?.id || '');

  // Live automated scan across all assignments
  const liveRosterScan = useMemo(
    () => scanRosterLegalityConflicts(flights, crew, assignments, leaveRecords, rules),
    [flights, crew, assignments, leaveRecords, rules]
  );

  const selectedCrew = crew.find((c) => c.id === selectedCrewId) || crew[0];
  const selectedFlight = flights.find((f) => f.id === selectedFlightId) || flights[0];

  const diagnosticResult: ConflictCheckResult | null =
    selectedCrew && selectedFlight
      ? validateCrewLegality(
          selectedCrew,
          selectedFlight,
          flights,
          assignments,
          leaveRecords,
          rules
        )
      : null;

  const handleSelectConflict = (crewId: string, flightId: string) => {
    if (crewId && crewId !== 'UNASSIGNED') {
      setSelectedCrewId(crewId);
    }
    if (flightId) {
      setSelectedFlightId(flightId);
    }
    // Scroll to interactive checker
    const el = document.getElementById('interactive-diagnostic-panel');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-sans">
      {/* Live Roster Conflicts Section (if any conflicts exist) */}
      {liveRosterScan.hasCriticalConflict && (
        <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-slate-950 text-white rounded-2xl p-5 md:p-6 border-2 border-rose-500 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-rose-400 animate-pulse" />
              <div>
                <h3 className="text-base font-black tracking-tight text-white font-mono">
                  ACTIVE ROSTER CONFLICTS DETECTED ({liveRosterScan.criticalConflictCount})
                </h3>
                <p className="text-xs text-rose-200/90">
                  Click any surfaced sector conflict below to immediately load into the deep-dive diagnostic engine.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-rose-500 text-white text-xs font-black font-mono rounded-full self-start sm:self-auto">
              ACTION REQUIRED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveRosterScan.conflicts.map((conf) => (
              <button
                key={conf.id}
                onClick={() => handleSelectConflict(conf.crewId, conf.flightId)}
                className="text-left p-3.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/80 hover:border-rose-400 rounded-xl transition-all cursor-pointer group shadow-sm flex flex-col justify-between space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-white flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-rose-400" />
                    {conf.flightNumber} ({conf.flightDate})
                  </span>
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-[9px] bg-rose-500/40 text-rose-100 border border-rose-400/40">
                    {conf.conflictType.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-xs text-rose-100 font-sans">
                  <span className="font-bold text-white">{conf.crewName}</span> • {conf.role}
                </div>

                <p className="text-[11px] text-rose-200/80 italic line-clamp-2 font-mono">
                  "{conf.description}"
                </p>

                <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-rose-300 group-hover:text-white border-t border-rose-800/60">
                  <span>Sector: {conf.departure} → {conf.arrival}</span>
                  <span className="flex items-center gap-1 font-bold">
                    Load Diagnostic <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mandatory Regulatory Disclaimer Banner */}
      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex items-center gap-3 text-amber-900 text-xs font-semibold shadow-xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
        <div>
          <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800 block">
            Regulatory Notice
          </span>
          "Operational limits must be configured and validated against the airline's approved FTL scheme."
        </div>
      </div>

      {/* Active Rules Snapshot Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-rose-500" />
            CURRENT CONFIGURED FTL OPERATIONAL LIMITS
          </span>
          <span className="text-slate-400 font-mono">FTL SCHEME V2.4</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 font-mono text-xs">
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400">Min Rest</div>
            <div className="text-sm font-bold text-rose-400">{rules.minRestHours} Hours</div>
          </div>
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400">Max Duty</div>
            <div className="text-sm font-bold text-slate-200">{rules.maxDutyHours} Hours</div>
          </div>
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400">Max Block/Mo</div>
            <div className="text-sm font-bold text-slate-200">{rules.maxMonthlyBlockHours} Hours</div>
          </div>
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400">Max Duty/Mo</div>
            <div className="text-sm font-bold text-slate-200">{rules.maxMonthlyDutyHours} Hours</div>
          </div>
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400">Max Consecutive</div>
            <div className="text-sm font-bold text-slate-200">{rules.maxConsecutiveDuties} Days</div>
          </div>
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400">Min Days Off</div>
            <div className="text-sm font-bold text-slate-200">{rules.minDaysOff} Days</div>
          </div>
          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400">Night Duty Limit</div>
            <div className="text-sm font-bold text-slate-200">{rules.nightDutyLimit} Duties</div>
          </div>
        </div>
      </div>

      {/* Interactive Conflict Checker Panel */}
      <div id="interactive-diagnostic-panel" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Selector Form (Left) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xl space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              Interactive Crew Legality Diagnostic
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Select any crew member and flight to run instant step-by-step FTL validation.
            </p>
          </div>

          <div className="space-y-4 text-xs font-semibold">
            {/* Crew Selector */}
            <div>
              <label className="block text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Select Crew Member
              </label>
              <select
                value={selectedCrewId}
                onChange={(e) => setSelectedCrewId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-rose-500"
              >
                {crew.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.staffNumber}) - {c.role} [{c.aircraft}]
                  </option>
                ))}
              </select>
            </div>

            {/* Flight Selector */}
            <div>
              <label className="block text-slate-700 mb-1 flex items-center gap-1.5">
                <Plane className="w-3.5 h-3.5 text-slate-500" />
                Select Target Flight
              </label>
              <select
                value={selectedFlightId}
                onChange={(e) => setSelectedFlightId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 font-mono"
              >
                {flights.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.flightNumber} ({f.date}) - {f.aircraft} [{f.departure} → {f.arrival}]
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Diagnostic Result Card (Right) */}
        <div className="lg:col-span-7">
          {diagnosticResult && selectedCrew && selectedFlight && (
            <div
              className={`bg-white rounded-2xl border-2 p-6 shadow-2xl space-y-5 relative overflow-hidden ${
                diagnosticResult.overallResult === 'PASS'
                  ? 'border-emerald-500'
                  : 'border-rose-600'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 font-mono">
                    CREW LEGALITY DIAGNOSTIC RESULT
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 font-mono">
                    Flight {selectedFlight.flightNumber} ({selectedFlight.date})
                  </h3>
                </div>

                <span
                  className={`px-4 py-1.5 text-xs font-black font-mono rounded-full border shadow-sm ${
                    diagnosticResult.overallResult === 'PASS'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                  }`}
                >
                  RESULT: {diagnosticResult.overallResult === 'PASS' ? 'ASSIGNMENT PERMITTED' : 'ASSIGNMENT BLOCKED'}
                </span>
              </div>

              {/* Exact Prompt Example Formatting */}
              <div className="bg-slate-900 text-slate-100 rounded-xl p-5 font-mono text-xs space-y-2 border border-slate-800 shadow-inner">
                <div className="text-rose-400 font-bold border-b border-slate-800 pb-2 flex justify-between">
                  <span>CREW CONFLICT REPORT</span>
                  <span>FTL ENGINE V2</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-slate-300">
                  <div>Captain / Crew: <span className="font-bold text-white">{selectedCrew.name}</span></div>
                  <div>Flight: <span className="font-bold text-white">{selectedFlight.flightNumber}</span></div>
                  <div>Aircraft: <span className="font-bold text-white">{selectedFlight.aircraft}</span></div>
                  <div>Operating Base: <span className="font-bold text-white">{selectedCrew.base}</span></div>
                </div>

                <div className="border-t border-slate-800 pt-3 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span>Aircraft Qualification:</span>
                    <span className={diagnosticResult.qualificationPass ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {diagnosticResult.qualificationPass ? 'PASS' : 'FAIL'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Availability Status:</span>
                    <span className={diagnosticResult.availabilityPass ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {diagnosticResult.availabilityPass ? 'PASS' : 'FAIL'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Leave / Training Exclusion:</span>
                    <span className={diagnosticResult.leavePass ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {diagnosticResult.leavePass ? 'PASS' : 'FAIL'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Rest Hours Compliance:</span>
                    <span className={diagnosticResult.restPass ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {diagnosticResult.restPass ? 'PASS' : 'FAIL'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Monthly Block Hours Limit:</span>
                    <span className={diagnosticResult.blockHoursPass ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {diagnosticResult.blockHoursPass ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                </div>

                {/* Rest Breakdown */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 mt-3 space-y-1 text-slate-300 text-[11px]">
                  <div className="flex justify-between">
                    <span>Previous Duty Release:</span>
                    <span className="text-white font-bold">{diagnosticResult.previousRelease}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Next Duty Report:</span>
                    <span className="text-white font-bold">{diagnosticResult.nextReport}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Required Minimum Rest:</span>
                    <span className="text-white font-bold">{rules.minRestHours}:00</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1">
                    <span>Available Rest:</span>
                    <span className={`font-bold ${diagnosticResult.restPass ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {diagnosticResult.availableRest} Hours
                    </span>
                  </div>
                </div>
              </div>

              {/* Fail Reasons List if Blocked */}
              {diagnosticResult.failReasons.length > 0 && (
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-700">
                    <XCircle className="w-4 h-4" /> REASON FOR BLOCKING:
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                    {diagnosticResult.failReasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
