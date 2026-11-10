import React, { useState } from 'react';
import {
  Flight,
  CrewMember,
  Assignment,
  LeaveTrainingRecord,
  LegalityRules,
  RosterOptimizationOptions,
  RosterOptimizationResult,
  PreGenerationValidationReport,
} from '../types';
import { runAutoScheduler, optimizeRoster } from '../utils/schedulerEngine';
import { runPreGenerationComplianceCheck } from '../utils/legalityEngine';
import {
  getOpenAssignmentsSummary,
  addSystemNotification,
  saveAcknowledgments,
  loadAcknowledgments,
} from '../utils/storage';
import {
  calculateReportingTime,
  calculateDutyEndTime,
  FLEET_REGISTRATIONS,
} from '../utils/dutyTimeCalculator';
import {
  Cpu,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Check,
  Terminal,
  FileCheck2,
  Users,
  Plane,
  Clock,
  Sparkles,
  Send,
  AlertCircle,
  Eye,
  Info,
  Calendar,
  Layers,
} from 'lucide-react';

interface AutoSchedulerViewProps {
  flights: Flight[];
  crew: CrewMember[];
  assignments: Assignment[];
  leaveRecords: LeaveTrainingRecord[];
  rules: LegalityRules;
  onApplyAssignments: (newAssignments: Assignment[], sourceLabel: string) => void;
}

export const AutoSchedulerView: React.FC<AutoSchedulerViewProps> = ({
  flights,
  crew,
  assignments,
  leaveRecords,
  rules,
  onApplyAssignments,
}) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'optimize'>('generate');

  // Generator State
  const [generatorLogs, setGeneratorLogs] = useState<string[]>([]);
  const [generatorResult, setGeneratorResult] = useState<{
    updatedAssignments: Assignment[];
    assignedCount: number;
    openCount: number;
    conflictCount: number;
    compositionWarnings: string[];
  } | null>(null);

  // Pre-Generation Compliance Inspector Modal State
  const [showPreCheckModal, setShowPreCheckModal] = useState<boolean>(false);
  const [preCheckReport, setPreCheckReport] = useState<PreGenerationValidationReport | null>(null);

  // Publish Modal State
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [publishPeriod, setPublishPeriod] = useState<string>('August 2026');
  const [publishNotes, setPublishNotes] = useState<string>('Official Monthly Flight Operations Roster');

  // Optimizer State & Options
  const [optOptions, setOptOptions] = useState<RosterOptimizationOptions>({
    legalCompliance: true,
    crewHourBalance: true,
    minPositioning: true,
    minStandby: true,
    baseCompatibility: true,
    minChanges: true,
  });

  const [optResult, setOptResult] = useState<RosterOptimizationResult | null>(null);

  // Dynamic Open Assignments Summary
  const openSummary = getOpenAssignmentsSummary(flights, assignments, rules);

  // Run Pre-Generation Compliance Check
  const handleOpenPreCheckModal = () => {
    const report = runPreGenerationComplianceCheck(crew, flights, leaveRecords, rules);
    setPreCheckReport(report);
    setShowPreCheckModal(true);
  };

  const handleRunGenerator = () => {
    setShowPreCheckModal(false);
    const res = runAutoScheduler(flights, crew, assignments, leaveRecords, rules);
    setGeneratorLogs(res.logs);
    setGeneratorResult({
      updatedAssignments: res.updatedAssignments,
      assignedCount: res.assignedCount,
      openCount: res.openCount,
      conflictCount: res.conflictCount,
      compositionWarnings: res.compositionWarnings || [],
    });
  };

  const handleRunOptimizer = () => {
    const res = optimizeRoster(flights, crew, assignments, leaveRecords, rules, optOptions);
    setOptResult(res);
  };

  const handleConfirmPublish = () => {
    if (!generatorResult) return;

    // Stamp published flag on all generated assignments
    const publishedAssignments = generatorResult.updatedAssignments.map((a) => ({
      ...a,
      published: true,
      publishedAt: new Date().toISOString(),
      revision: 1,
    }));

    // Dispatch broadcast notification to all crew members
    addSystemNotification({
      type: 'ROSTER_PUBLISHED',
      title: `${publishPeriod} Flight Roster Published`,
      message: `The official roster for ${publishPeriod} has been published by OCC with ${generatorResult.assignedCount} fully assigned sectors. Please review and acknowledge your duties in the Crew Portal.`,
      revision: 1,
    });

    onApplyAssignments(
      publishedAssignments,
      `Official Publication: ${publishPeriod} Roster (Rev 1)`
    );

    setShowPublishModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-sans">
      {/* 1. DYNAMIC SUMMARY: TOTAL OPEN ASSIGNMENTS PRIOR TO PUBLICATION */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#F37C1C]" />
            <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider font-mono">
              Pre-Publication Summary: Total Open Assignments
            </h2>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            Total Target Flights: {flights.length} Sectors
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Open Sectors
            </span>
            <div className={`text-xl font-black font-mono mt-1 ${openSummary.totalOpenSectors > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
              {openSummary.totalOpenSectors}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Need Crew</span>
          </div>

          <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
              Open Captains
            </span>
            <div className="text-xl font-black font-mono text-rose-700 mt-1">
              {openSummary.openCaptains}
            </div>
            <span className="text-[10px] text-rose-600 font-mono">CPT Required</span>
          </div>

          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
              Open First Officers
            </span>
            <div className="text-xl font-black font-mono text-amber-700 mt-1">
              {openSummary.openFirstOfficers}
            </div>
            <span className="text-[10px] text-amber-600 font-mono">FO Required</span>
          </div>

          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
              Open Senior CC
            </span>
            <div className="text-xl font-black font-mono text-purple-700 mt-1">
              {openSummary.openSeniorCabinCrew}
            </div>
            <span className="text-[10px] text-purple-600 font-mono">SCC Lead</span>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
              Open Cabin Crew
            </span>
            <div className="text-xl font-black font-mono text-blue-700 mt-1">
              {openSummary.openCabinCrew}
            </div>
            <span className="text-[10px] text-blue-600 font-mono">Attendants</span>
          </div>

          <div className="p-3 bg-slate-100 rounded-xl border border-slate-300">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
              Total Open Slots
            </span>
            <div className="text-xl font-black font-mono text-slate-900 mt-1">
              {openSummary.totalOpenPositions}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Individual Positions</span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              Fully Crewed
            </span>
            <div className="text-xl font-black font-mono text-emerald-700 mt-1">
              {openSummary.fullyAssignedSectors}
            </div>
            <span className="text-[10px] text-emerald-600 font-mono">100% Paired</span>
          </div>
        </div>
      </div>

      {/* Sub-Header Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 max-w-md">
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'generate'
              ? 'bg-[#F37C1C] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Auto-Roster Generator
        </button>

        <button
          onClick={() => setActiveTab('optimize')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'optimize'
              ? 'bg-[#2E2C2B] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4 text-[#F37C1C]" />
          Roster Optimizer
        </button>
      </div>

      {/* GENERATE TAB */}
      {activeTab === 'generate' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 font-mono">
                  Deterministic Zambia Airways Roster Engine
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Enforces complete crew pairing (Captain, FO, Senior CC, Cabin Crew), binds exact tail registrations (B737: <strong className="text-slate-800">9J-ZAE</strong>, Q400: <strong className="text-slate-800">9J-ZAW</strong>), and calculates standardized Report Time (STD - 01:00) and Duty End Time (STA + 00:30).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleOpenPreCheckModal}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-300"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>PRE-CHECK COMPLIANCE</span>
                </button>

                <button
                  onClick={handleRunGenerator}
                  className="flex items-center gap-2 px-6 py-3 bg-[#F37C1C] hover:bg-[#D96B12] text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Cpu className="w-4 h-4" />
                  <span>GENERATE FULL ROSTER NOW</span>
                </button>
              </div>
            </div>

            {/* Results Overview */}
            {generatorResult && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                    <div className="flex justify-between items-center text-emerald-800 text-xs font-bold font-mono">
                      <span>FULLY CREWED SECTORS</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-black text-emerald-700 font-mono">
                      {generatorResult.assignedCount} Flights
                    </div>
                    <div className="text-[10px] text-emerald-700 font-medium">
                      100% CPT + FO + Full Cabin Paired
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                    <div className="flex justify-between items-center text-amber-800 text-xs font-bold font-mono">
                      <span>PARTIALLY OPEN</span>
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div className="text-2xl font-black text-amber-700 font-mono">
                      {generatorResult.openCount} Flights
                    </div>
                    <div className="text-[10px] text-amber-700 font-medium">
                      Requires Dispatcher Manual Fill
                    </div>
                  </div>

                  <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 space-y-1">
                    <div className="flex justify-between items-center text-rose-800 text-xs font-bold font-mono">
                      <span>UNASSIGNED / CONFLICT</span>
                      <XCircle className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="text-2xl font-black text-rose-700 font-mono">
                      {generatorResult.conflictCount} Flights
                    </div>
                    <div className="text-[10px] text-rose-700 font-medium">
                      No Qualified Available Crew
                    </div>
                  </div>
                </div>

                {/* Composition Warnings Banner */}
                {generatorResult.compositionWarnings.length > 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center gap-2 font-bold text-amber-900 font-mono">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>{generatorResult.compositionWarnings.length} Crew Composition Warnings Flagged</span>
                    </div>
                    <ul className="list-disc list-inside text-amber-800 text-[11px] space-y-0.5 max-h-32 overflow-y-auto pl-1">
                      {generatorResult.compositionWarnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Apply Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    Calculated standardized duty times for all {generatorResult.updatedAssignments.length} legs.
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowPublishModal(true)}
                      className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>PUBLISH OFFICIAL ROSTER &amp; NOTIFY CREW</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Engine Execution Terminal Log */}
          {generatorLogs.length > 0 && (
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl text-slate-200 font-mono text-xs space-y-2">
              <div className="flex items-center gap-2 text-[#F37C1C] font-bold border-b border-slate-800 pb-2">
                <Terminal className="w-4 h-4" />
                OPERATIONAL LOG EXECUTION TRACE
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto pr-2">
                {generatorLogs.map((log, idx) => (
                  <div key={idx} className="text-slate-300">
                    <span className="text-slate-500 mr-2">[{idx + 1}]</span>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* OPTIMIZE TAB */}
      {activeTab === 'optimize' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 font-mono">
                Multi-Factor Roster Optimization Configuration
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Adjust optimization weights to balance monthly flight hours, minimize deadhead positioning, and maximize standby readiness.
              </p>
            </div>

            {/* Criteria Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'legalCompliance', label: '100% FTL Legal Compliance', desc: 'Strict zero-violation enforcement' },
                { key: 'crewHourBalance', label: 'Crew Flying Hour Balance', desc: 'Equalize monthly block hours across crew' },
                { key: 'minPositioning', label: 'Minimize Deadhead / Positioning', desc: 'Reduce unpaid positioning travel' },
                { key: 'minStandby', label: 'Optimize Reserve / Standby', desc: 'Maintain ideal standby buffer ratio' },
                { key: 'baseCompatibility', label: 'Base Compatibility Preference', desc: 'Assign crew residing at operating hub (LUN)' },
                { key: 'minChanges', label: 'Minimize Roster Re-assignments', desc: 'Reduce disruption to pre-published duties' },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={(optOptions as any)[opt.key]}
                    onChange={(e) =>
                      setOptOptions({ ...optOptions, [opt.key]: e.target.checked })
                    }
                    className="mt-0.5 w-4 h-4 text-[#F37C1C] rounded focus:ring-[#F37C1C]"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                    <div className="text-[11px] text-slate-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={handleRunOptimizer}
                className="flex items-center gap-2 px-6 py-3 bg-[#2E2C2B] hover:bg-black text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-[#F37C1C]" />
                <span>EXECUTE OPTIMIZATION ALGORITHM</span>
              </button>
            </div>

            {/* Optimizer Result */}
            {optResult && (
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-emerald-900 font-mono">
                      OPTIMIZATION COMPLETE (SCORE: {optResult.currentScore} → {optResult.optimizedScore})
                    </div>
                    <div className="text-xs text-emerald-700 mt-0.5">
                      Proposed {optResult.changesCount} duty swaps across {optResult.affectedFlights} flights affecting {optResult.affectedCrew} crew members.
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      onApplyAssignments(
                        optResult.proposedAssignments,
                        'Roster Optimization Algorithm'
                      )
                    }
                    className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 cursor-pointer shadow-xs"
                  >
                    Apply Optimized Plan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRE-GENERATION COMPLIANCE INSPECTOR MODAL */}
      {showPreCheckModal && preCheckReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-emerald-600 font-mono uppercase tracking-wider">
                  Pre-Generation Validation Engine
                </span>
                <h3 className="text-xl font-black text-slate-900 font-mono">
                  Crew Compliance &amp; Qualification Audit
                </h3>
                <p className="text-xs text-slate-500">
                  Audit of all {preCheckReport.totalCrewChecked} registered flight crew before generating flight pairing rosters.
                </p>
              </div>
              <button
                onClick={() => setShowPreCheckModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Summary Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Crew Checked</span>
                <strong className="text-lg text-slate-900">{preCheckReport.totalCrewChecked}</strong>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-emerald-700 block text-[10px] uppercase font-bold">Eligible &amp; Active</span>
                <strong className="text-lg text-emerald-700">{preCheckReport.eligibleCrewCount}</strong>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-rose-700 block text-[10px] uppercase font-bold">Hard Exclusions</span>
                <strong className="text-lg text-rose-700">{preCheckReport.ineligibleCrewCount}</strong>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-amber-700 block text-[10px] uppercase font-bold">Warnings / Near Caps</span>
                <strong className="text-lg text-amber-700">{preCheckReport.warnings.length}</strong>
              </div>
            </div>

            {/* Hard Violations Banner */}
            {preCheckReport.hardViolations.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs space-y-1">
                <span className="font-bold text-rose-900 font-mono block">
                  ⚠ Hard Guardrail Violations ({preCheckReport.hardViolations.length})
                </span>
                <div className="text-rose-700 text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
                  {preCheckReport.hardViolations.map((h, i) => (
                    <div key={i}>• {h}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Crew Details Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Staff No / Name</th>
                    <th className="p-2.5">Role / Fleet</th>
                    <th className="p-2.5 text-center">License</th>
                    <th className="p-2.5 text-center">Medical</th>
                    <th className="p-2.5 text-center">4 Currencies</th>
                    <th className="p-2.5 text-center">Recency</th>
                    <th className="p-2.5 text-center">Weekly Avail</th>
                    <th className="p-2.5 text-center">Eligibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preCheckReport.crewChecks.map((item) => (
                    <tr key={item.crewId} className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold text-slate-900">
                        {item.name}
                        <span className="block text-[10px] text-slate-400">{item.staffNumber}</span>
                      </td>
                      <td className="p-2.5 text-slate-600">
                        {item.role}
                        <span className="block text-[10px] text-blue-600 font-bold">{item.aircraft}</span>
                      </td>
                      <td className="p-2.5 text-center">
                        {item.licenseValid ? (
                          <span className="text-emerald-600 font-bold">✓ Valid</span>
                        ) : (
                          <span className="text-rose-600 font-bold">✕ Expired</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {item.medicalValid ? (
                          <span className="text-emerald-600 font-bold">✓ Valid</span>
                        ) : (
                          <span className="text-rose-600 font-bold">✕ Expired</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {item.simValid && item.septValid && item.crmValid && item.dgrValid ? (
                          <span className="text-emerald-600 font-bold">✓ 4/4</span>
                        ) : (
                          <span className="text-amber-600 font-bold">⚠ Review</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {item.recencyValid ? (
                          <span className="text-emerald-600 font-bold">✓ 3/90d</span>
                        ) : (
                          <span className="text-rose-600 font-bold">✕ Lacking</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-700">
                        {item.weeklyHoursLeft.toFixed(1)}h
                      </td>
                      <td className="p-2.5 text-center">
                        {item.overallEligible ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                            ELIGIBLE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                            EXCLUDED
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Guardrail Status: {preCheckReport.hardViolations.length === 0 ? '✓ Ready to generate' : '⚠ Caution advised'}
              </span>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPreCheckModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Close Audit
                </button>
                <button
                  onClick={handleRunGenerator}
                  className="px-5 py-2 bg-[#F37C1C] hover:bg-[#D96B12] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Proceed to Generate Roster →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ROSTER PUBLISH CONFIRMATION MODAL */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-emerald-600 uppercase font-mono">
                Official Roster Release
              </span>
              <h3 className="text-xl font-black text-slate-900 font-mono mt-0.5">
                Publish Live Flight Roster
              </h3>
              <p className="text-xs text-slate-500">
                Publishing locks this roster version (Rev 1) and immediately transmits digital notifications to all assigned flight and cabin crew members.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase font-mono block mb-1">
                  Roster Period
                </label>
                <input
                  type="text"
                  value={publishPeriod}
                  onChange={(e) => setPublishPeriod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase font-mono block mb-1">
                  Publication Notes / Directive
                </label>
                <textarea
                  rows={3}
                  value={publishNotes}
                  onChange={(e) => setPublishNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1 text-blue-900">
                <span className="font-bold flex items-center gap-1">
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  Push Alerts Enabled
                </span>
                <p className="text-[11px] text-blue-800">
                  Crew members will receive real-time notifications and can acknowledge duties directly in their Crew Portal.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPublish}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Confirm &amp; Broadcast Publication
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
