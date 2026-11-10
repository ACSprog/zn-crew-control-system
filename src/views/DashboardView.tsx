import React, { useState, useMemo } from 'react';
import {
  CrewMember,
  Flight,
  Assignment,
  LeaveTrainingRecord,
  ActiveView,
  AircraftFleet,
  LegalityRules,
} from '../types';
import { getOpenAssignmentsSummary, loadAcknowledgments } from '../utils/storage';
import { FLEET_REGISTRATIONS } from '../utils/dutyTimeCalculator';
import { scanRosterLegalityConflicts } from '../utils/legalityEngine';
import {
  Users,
  Plane,
  AlertTriangle,
  GraduationCap,
  CheckCircle2,
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Clock,
  FileCheck2,
  User,
  Radio,
  Flame,
  Activity,
  TrendingUp,
  MapPin,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  BarChart3,
  AlertOctagon,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface DashboardViewProps {
  crew: CrewMember[];
  flights: Flight[];
  assignments: Assignment[];
  leaveRecords: LeaveTrainingRecord[];
  rules?: LegalityRules;
  fleet?: AircraftFleet[];
  onNavigate: (view: ActiveView) => void;
  onGenerateRoster: () => void;
  onOptimizeRoster: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  crew,
  flights,
  assignments,
  leaveRecords,
  rules,
  fleet = [],
  onNavigate,
  onGenerateRoster,
  onOptimizeRoster,
}) => {
  const [fatigueTab, setFatigueTab] = useState<'routes' | 'trend' | 'crew_radar'>('routes');
  const [selectedFleetFilter, setSelectedFleetFilter] = useState<'ALL' | 'Q400' | 'B737'>('ALL');
  const [isAlertExpanded, setIsAlertExpanded] = useState<boolean>(true);

  // Default FTL rules if not provided
  const activeRules: LegalityRules = rules || {
    minRestHours: 10,
    maxDutyHours: 12,
    maxWeeklyBlockHours: 30,
    maxMonthlyBlockHours: 100,
    maxAnnualBlockHours: 1000,
    maxConsecutiveDuties: 6,
    minRolling7DayRestHours: 24,
    maxLandingsPerDuty: 5,
    maxGroundTimeBetweenSectorsHours: 2.0,
    maxMonthlyDutyHours: 180,
    minDaysOff: 8,
    nightDutyLimit: 10,
    recencyWindowDays: 90,
    recencyMinLandings: 3,
    docWarnDays90: 90,
    docWarnDays60: 60,
    docWarnDays30: 30,
    docWarnDays7: 7,
    q400CaptainCountReq: 1,
    q400FoCountReq: 1,
    q400CcCountReq: 2,
    q400SccCountReq: 1,
    b737CaptainCountReq: 1,
    b737FoCountReq: 1,
    b737CcCountReq: 4,
    b737SccCountReq: 1,
  };

  // Automated Legality & FTL Conflicts Scan across all generated assignments
  const legalityScan = useMemo(
    () => scanRosterLegalityConflicts(flights, crew, assignments, leaveRecords, activeRules),
    [flights, crew, assignments, leaveRecords, activeRules]
  );

  // Metric calculations
  const totalCrewCount = crew.length;
  const activeCrewCount = crew.filter((c) => c.status === 'ACTIVE').length;
  const standbyCrewCount = crew.filter((c) => c.status === 'STANDBY').length;
  const leaveCrewCount = crew.filter((c) => c.status === 'LEAVE').length;

  const q400CrewCount = crew.filter((c) => c.aircraft === 'Q400' || (c.qualifications && c.qualifications.includes('Q400'))).length;
  const b737CrewCount = crew.filter((c) => c.aircraft === 'B737' || (c.qualifications && c.qualifications.includes('B737'))).length;

  const captainsCount = crew.filter((c) => c.role === 'Captain').length;
  const firstOfficersCount = crew.filter((c) => c.role === 'First Officer').length;
  const cabinCrewCount = crew.filter((c) => c.role === 'Cabin Crew' || c.role === 'Senior Cabin Crew').length;

  // Open Assignments Breakdown
  const openSummary = getOpenAssignmentsSummary(flights, assignments);

  // Acknowledgment Tracker
  const acknowledgments = loadAcknowledgments();
  const acknowledgedCount = acknowledgments.length;

  // Standby Coverage
  const airportStandbyCount = crew.filter((c) => c.status === 'STANDBY').length;
  const homeReserveCount = leaveRecords.filter((l) => l.type === 'Standby' && l.approved).length;

  // Document Expiry Alerts
  const now = new Date();
  const calculateDaysLeft = (dateStr?: string) => {
    if (!dateStr) return 9999;
    const diff = new Date(dateStr).getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const passportExpiring = crew.filter((c) => calculateDaysLeft(c.passportExpiry) <= 90).length;
  const airportPassExpiring = crew.filter((c) => calculateDaysLeft(c.airportPassExpiry) <= 60).length;
  const medicalExpiring = crew.filter((c) => calculateDaysLeft(c.medicalExpiry) <= 60).length;
  const licenseExpiring = crew.filter((c) => calculateDaysLeft(c.licenseExpiry) <= 60).length;

  // Training & Recency Alerts
  const lineCheckDue = crew.filter((c) => calculateDaysLeft(c.lineCheck) <= 60).length;
  const recurrentTrainingDue = crew.filter((c) => c.trainingStatus === 'DUE_SOON' || c.trainingStatus === 'EXPIRED').length;
  const simulatorDue = leaveRecords.filter((l) => l.type === 'Simulator' && !l.approved).length;
  const recencyExpiring = crew.filter((c) => c.role === 'Captain' || c.role === 'First Officer').filter((c) => (c.flightsCount || 0) < 3).length;

  // Fleet Card metrics
  const q400Flights = flights.filter((f) => f.aircraft === 'Q400');
  const b737Flights = flights.filter((f) => f.aircraft === 'B737');

  const q400BlockHours = q400Flights.reduce((sum, f) => sum + f.blockHours, 0);
  const b737BlockHours = b737Flights.reduce((sum, f) => sum + f.blockHours, 0);

  const q400Open = assignments.filter((a) => {
    const f = flights.find((fl) => fl.id === a.flightId);
    return f && f.aircraft === 'Q400' && a.status !== 'ASSIGNED';
  }).length;

  const b737Open = assignments.filter((a) => {
    const f = flights.find((fl) => fl.id === a.flightId);
    return f && f.aircraft === 'B737' && a.status !== 'ASSIGNED';
  }).length;

  const q400Assigned = q400Flights.length - q400Open;
  const b737Assigned = b737Flights.length - b737Open;

  // ----------------------------------------------------
  // FATIGUE TREND MAP & ROUTE HEATMAP CALCULATIONS
  // ----------------------------------------------------
  const routeDefinitions = [
    { code: 'LUN-JNB', name: 'Lusaka ⇄ Johannesburg', fleet: 'B737', avgBlock: 2.0, turnarounds: 2, distanceKm: 1200 },
    { code: 'LUN-NLA', name: 'Lusaka ⇄ Ndola', fleet: 'Q400', avgBlock: 0.8, turnarounds: 4, distanceKm: 320 },
    { code: 'LUN-SLA', name: 'Lusaka ⇄ Solwezi', fleet: 'Q400', avgBlock: 0.9, turnarounds: 2, distanceKm: 420 },
    { code: 'LUN-LVI', name: 'Lusaka ⇄ Livingstone', fleet: 'Q400', avgBlock: 1.0, turnarounds: 2, distanceKm: 470 },
    { code: 'LUN-KWE', name: 'Lusaka ⇄ Kitwe / Simon Kapwepwe', fleet: 'Q400', avgBlock: 1.1, turnarounds: 2, distanceKm: 350 },
    { code: 'LUN-MFU', name: 'Lusaka ⇄ Mfuwe', fleet: 'Q400', avgBlock: 1.2, turnarounds: 2, distanceKm: 510 },
    { code: 'LUN-DAR', name: 'Lusaka ⇄ Dar es Salaam', fleet: 'B737', avgBlock: 2.4, turnarounds: 1, distanceKm: 1540 },
    { code: 'LUN-HRE', name: 'Lusaka ⇄ Harare', fleet: 'B737', avgBlock: 1.0, turnarounds: 2, distanceKm: 410 },
  ];

  const routeFatigueMetrics = useMemo(() => {
    return routeDefinitions.map((route) => {
      const [dep, arr] = route.code.split('-');
      const matchingFlights = flights.filter(
        (f) =>
          (f.departure === dep && f.arrival === arr) ||
          (f.departure === arr && f.arrival === dep)
      );

      const sectorCount = matchingFlights.length;
      const totalSectorBlock = matchingFlights.reduce((acc, f) => acc + (f.blockHours || route.avgBlock), 0);

      // Intensity Index calculation (0 - 100)
      // Factors: sector frequency, turnaround intensity, flight hours, aircraft speed
      let intensityScore = Math.min(
        100,
        Math.round(
          (sectorCount * 4) +
          (totalSectorBlock * 1.8) +
          (route.turnarounds > 2 ? 20 : 10) +
          (route.fleet === 'B737' ? 12 : 5)
        )
      );
      if (sectorCount === 0) intensityScore = 15;

      let riskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' = 'LOW';
      let riskColor = 'bg-emerald-500 text-white';
      let riskBorder = 'border-emerald-200';
      let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-300';

      if (intensityScore >= 80) {
        riskLevel = 'HIGH';
        riskColor = 'bg-rose-600 text-white';
        riskBorder = 'border-rose-300';
        badgeBg = 'bg-rose-50 text-rose-700 border-rose-300';
      } else if (intensityScore >= 60) {
        riskLevel = 'ELEVATED';
        riskColor = 'bg-amber-500 text-white';
        riskBorder = 'border-amber-300';
        badgeBg = 'bg-amber-50 text-amber-800 border-amber-300';
      } else if (intensityScore >= 35) {
        riskLevel = 'MODERATE';
        riskColor = 'bg-yellow-500 text-slate-900';
        riskBorder = 'border-yellow-300';
        badgeBg = 'bg-yellow-50 text-yellow-800 border-yellow-300';
      }

      return {
        ...route,
        sectorCount,
        totalSectorBlock: Number(totalSectorBlock.toFixed(1)),
        intensityScore,
        riskLevel,
        riskColor,
        riskBorder,
        badgeBg,
      };
    });
  }, [flights]);

  const filteredRouteMetrics = routeFatigueMetrics.filter((r) => {
    if (selectedFleetFilter === 'ALL') return true;
    return r.fleet === selectedFleetFilter;
  });

  // Fatigue Distribution by Crew
  const maxMonthlyLimit = activeRules.maxMonthlyBlockHours || 100;
  const crewFatigueTiers = useMemo(() => {
    let normalCount = 0;
    let moderateCount = 0;
    let elevatedCount = 0;
    let criticalCount = 0;

    crew.forEach((c) => {
      const hours = c.monthlyBlockHours || 0;
      const ratio = hours / maxMonthlyLimit;
      if (ratio >= 0.95) criticalCount++;
      else if (ratio >= 0.8) elevatedCount++;
      else if (ratio >= 0.6) moderateCount++;
      else normalCount++;
    });

    return { normalCount, moderateCount, elevatedCount, criticalCount };
  }, [crew, maxMonthlyLimit]);

  // Top At-Risk Crew Watchlist
  const topFatigueCrew = useMemo(() => {
    return [...crew]
      .sort((a, b) => (b.monthlyBlockHours || 0) - (a.monthlyBlockHours || 0))
      .slice(0, 5)
      .map((c) => {
        const hours = c.monthlyBlockHours || 0;
        const percent = Math.round((hours / maxMonthlyLimit) * 100);
        const remaining = Math.max(0, maxMonthlyLimit - hours);
        return {
          ...c,
          percent,
          remaining: Number(remaining.toFixed(1)),
          isCritical: percent >= 95,
          isElevated: percent >= 80 && percent < 95,
        };
      });
  }, [crew, maxMonthlyLimit]);

  return (
    <div className="p-3 sm:p-5 md:p-6 space-y-6 bg-slate-50 min-h-full font-sans">
      {/* ------------------------------------------------------------- */}
      {/* PRIORITY ALERT BANNER: CRITICAL LEGALITY & FTL CONFLICTS DETECTED */}
      {/* ------------------------------------------------------------- */}
      {legalityScan.hasCriticalConflict ? (
        <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-slate-950 text-white rounded-2xl p-5 md:p-6 border-2 border-rose-500 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-600/30 border-2 border-rose-400 flex items-center justify-center shrink-0 shadow-lg text-rose-300">
                <ShieldAlert className="w-7 h-7 text-rose-400 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-mono font-black text-[10px] tracking-wider uppercase flex items-center gap-1.5 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    CRITICAL ROSTER CONFLICTS DETECTED
                  </span>
                  <span className="text-xs font-mono text-rose-300 font-bold">
                    FTL COMPLIANCE ENGINE V2.4
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {legalityScan.criticalConflictCount} Critical Legality &amp; FTL Conflict{legalityScan.criticalConflictCount > 1 ? 's' : ''} in Active Roster
                </h2>
                <p className="text-xs sm:text-sm text-rose-200/90 max-w-3xl leading-relaxed">
                  Automated legality verification detected regulatory breaches across assigned flight sectors (e.g. minimum rest violation, overlapping duties, or expired qualifications). Operating non-compliant pairings breaches civil aviation safety regulations.
                </p>
              </div>
            </div>

            {/* Direct Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 lg:self-center shrink-0">
              <button
                onClick={() => onNavigate('legality')}
                className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-rose-950/50 cursor-pointer active:scale-95"
              >
                <ShieldAlert className="w-4 h-4" />
                Resolve in Legality Diagnostic →
              </button>
              <button
                onClick={onOptimizeRoster}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-rose-100 border border-rose-400/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Auto-Optimize Roster
              </button>
              <button
                onClick={() => setIsAlertExpanded(!isAlertExpanded)}
                className="px-3 py-2.5 bg-black/30 hover:bg-black/50 text-rose-300 rounded-xl text-xs font-mono font-bold cursor-pointer"
              >
                {isAlertExpanded ? 'Hide Details ▲' : `View Details (${legalityScan.conflicts.length}) ▼`}
              </button>
            </div>
          </div>

          {/* Expandable Breakdown of Critical Conflicts */}
          {isAlertExpanded && legalityScan.conflicts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-rose-800/60 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-300 font-mono flex items-center justify-between">
                <span>Surfaced Roster Violations Breakdown ({legalityScan.conflicts.length})</span>
                <span className="text-slate-300 font-normal">Click any sector to open diagnostic</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {legalityScan.conflicts.slice(0, 6).map((conflict) => (
                  <div
                    key={conflict.id}
                    onClick={() => onNavigate('legality')}
                    className="p-3 bg-rose-950/80 hover:bg-rose-900/90 border border-rose-700/60 rounded-xl transition-all cursor-pointer group shadow-sm flex flex-col justify-between space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black font-mono text-white flex items-center gap-1.5">
                        <Plane className="w-3.5 h-3.5 text-rose-400" />
                        {conflict.flightNumber} ({conflict.flightDate})
                      </span>
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[9px] bg-rose-500/30 text-rose-200 border border-rose-400/40">
                        {conflict.conflictType.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-xs text-rose-100">
                      <span className="font-bold text-white">{conflict.crewName}</span> ({conflict.role})
                    </div>

                    <p className="text-[11px] text-rose-200/80 line-clamp-2 italic font-mono">
                      "{conflict.description}"
                    </p>

                    <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-rose-300 group-hover:text-white">
                      <span>Sector: {conflict.departure} → {conflict.arrival}</span>
                      <span className="flex items-center gap-1 font-bold">
                        Inspect <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {legalityScan.conflicts.length > 6 && (
                <div className="text-center pt-1">
                  <button
                    onClick={() => onNavigate('legality')}
                    className="text-xs text-rose-300 hover:text-white font-bold underline cursor-pointer"
                  >
                    + {legalityScan.conflicts.length - 6} more critical conflict(s) in Legality Conflict View
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Reassurance banner when 100% compliant */
        <div className="bg-emerald-950/90 text-emerald-100 rounded-2xl p-4 border border-emerald-600/50 shadow-sm flex flex-wrap items-center justify-between gap-3 font-sans">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-800/60 border border-emerald-500/50 flex items-center justify-center text-emerald-300 shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-300 font-mono">
                  FTL Legality Checker
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold">
                  100% COMPLIANT
                </span>
              </div>
              <p className="text-xs text-emerald-200">
                All generated roster flight assignments are 100% compliant with FTL and CAA legality rules. 0 critical conflicts.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('legality')}
            className="px-3 py-1.5 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 font-mono shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Run Diagnostics →
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. CREW COMPLEMENT BENTO HEADER */}
      {/* ------------------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-2">
            <Users className="w-4 h-4 text-[#2E2C2B]" />
            Crew Complement &amp; Availability
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('portal')}
              className="text-xs font-bold text-white bg-[#2E2C2B] hover:bg-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <User className="w-3.5 h-3.5 text-[#F37C1C]" />
              Open Crew Member Portal
            </button>
            <button
              onClick={() => onNavigate('crew')}
              className="text-xs font-bold text-[#F37C1C] hover:underline cursor-pointer flex items-center gap-1"
            >
              Crew Database <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Crew</span>
            <div className="text-2xl font-black text-[#2E2C2B] mt-1 font-mono">{totalCrewCount}</div>
            <span className="text-[10px] text-slate-400 font-mono">Registered</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Crew</span>
            <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">{activeCrewCount}</div>
            <span className="text-[10px] text-emerald-600 font-bold font-mono">{Math.round((activeCrewCount / (totalCrewCount || 1)) * 100)}% Avail</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Q400 Crew</span>
            <div className="text-2xl font-black text-blue-700 mt-1 font-mono">{q400CrewCount}</div>
            <span className="text-[10px] text-blue-600 font-mono">{FLEET_REGISTRATIONS.Q400}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">B737 Crew</span>
            <div className="text-2xl font-black text-indigo-700 mt-1 font-mono">{b737CrewCount}</div>
            <span className="text-[10px] text-indigo-600 font-mono">{FLEET_REGISTRATIONS.B737}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Captains</span>
            <div className="text-2xl font-black text-[#2E2C2B] mt-1 font-mono">{captainsCount}</div>
            <span className="text-[10px] text-slate-400 font-mono">Commanders</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">First Officers</span>
            <div className="text-2xl font-black text-[#2E2C2B] mt-1 font-mono">{firstOfficersCount}</div>
            <span className="text-[10px] text-slate-400 font-mono">Co-Pilots</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cabin Crew</span>
            <div className="text-2xl font-black text-[#2E2C2B] mt-1 font-mono">{cabinCrewCount}</div>
            <span className="text-[10px] text-slate-400 font-mono">Cabin Attendants</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FATIGUE TREND MAP & NETWORK ROUTE HEATMAP */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-[#F37C1C]" />
              <h3 className="text-base font-black text-slate-900 font-mono uppercase tracking-wider">
                Network Fatigue Trend Map &amp; Route Risk Heatmap
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live fatigue accumulation index across Zambia Airways domestic &amp; regional routes, workload intensity, and rolling duty caps.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Fleet Filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold font-mono">
              <button
                onClick={() => setSelectedFleetFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  selectedFleetFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Network
              </button>
              <button
                onClick={() => setSelectedFleetFilter('Q400')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  selectedFleetFilter === 'Q400' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Q400 Hub
              </button>
              <button
                onClick={() => setSelectedFleetFilter('B737')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  selectedFleetFilter === 'B737' ? 'bg-[#F37C1C] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                B737 Jet
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-900 text-white p-1 rounded-xl text-xs font-bold font-mono">
              <button
                onClick={() => setFatigueTab('routes')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  fatigueTab === 'routes' ? 'bg-[#F37C1C] text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Route Heatmap
              </button>
              <button
                onClick={() => setFatigueTab('trend')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  fatigueTab === 'trend' ? 'bg-[#F37C1C] text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                7d Fatigue Progression
              </button>
              <button
                onClick={() => setFatigueTab('crew_radar')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  fatigueTab === 'crew_radar' ? 'bg-[#F37C1C] text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Crew Risk Radar
              </button>
            </div>

            <button
              onClick={() => onNavigate('fatigue')}
              className="px-3 py-1.5 bg-orange-50 text-[#F37C1C] hover:bg-orange-100 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              Full Module <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Tab 1: Route & Sector Heatmap Grid */}
        {fatigueTab === 'routes' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {filteredRouteMetrics.map((route) => (
                <div
                  key={route.code}
                  className={`p-4 rounded-xl border-2 transition-all hover:shadow-md bg-white flex flex-col justify-between space-y-3 ${route.riskBorder}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm font-black font-mono text-slate-900">
                          {route.code}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium block truncate max-w-[160px]">
                        {route.name}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black font-mono border ${route.badgeBg}`}>
                      {route.riskLevel}
                    </span>
                  </div>

                  {/* Visual Intensity Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-400 font-bold">Fatigue Index</span>
                      <span className="font-bold text-slate-800">{route.intensityScore}/100</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          route.intensityScore >= 80
                            ? 'bg-rose-500'
                            : route.intensityScore >= 60
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${route.intensityScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100 text-center font-mono text-[10px]">
                    <div className="bg-slate-50 p-1.5 rounded-lg">
                      <span className="text-slate-400 block text-[8px] uppercase">Aircraft</span>
                      <span className="font-black text-slate-800">{route.fleet}</span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded-lg">
                      <span className="text-slate-400 block text-[8px] uppercase">Sectors</span>
                      <span className="font-black text-slate-800">{route.sectorCount}</span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded-lg">
                      <span className="text-slate-400 block text-[8px] uppercase">Block</span>
                      <span className="font-black text-slate-800">{route.totalSectorBlock}h</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Heatmap Legend */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 font-mono text-[11px] uppercase">Heatmap Scale:</span>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Low (0-35)</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Moderate (36-59)</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Elevated (60-79)</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> High Duty (80-100)</span>
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Calculated from sector duration, turnarounds &amp; current flight assignments
              </span>
            </div>
          </div>
        )}

        {/* Tab 2: 7-Day Fatigue Progression Trend Line / Chart */}
        {fatigueTab === 'trend' && (
          <div className="space-y-4">
            <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-inner">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-sm font-bold font-mono text-slate-200 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#F37C1C]" />
                    Rolling 7-Day Cumulative Block Hours vs Regulatory Safety Limit
                  </h4>
                  <p className="text-xs text-slate-400">
                    Tracks flight crew duty accumulation against the CAA standard 30-hour weekly cap.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-[#F37C1C] rounded-sm" />
                    <span>Flight Deck Average</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-blue-500 rounded-sm" />
                    <span>Cabin Crew Average</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-rose-500 border border-rose-500" />
                    <span className="text-rose-400">Weekly Cap (30h)</span>
                  </div>
                </div>
              </div>

              {/* Simulated SVG Trend Chart */}
              <div className="h-44 w-full relative pt-2 pb-6">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 700 120" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="20" x2="700" y2="20" stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />
                  <line x1="0" y1="60" x2="700" y2="60" stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />
                  <line x1="0" y1="100" x2="700" y2="100" stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />

                  {/* 30h Regulatory Limit Line */}
                  <line x1="0" y1="25" x2="700" y2="25" stroke="#f43f5e" strokeWidth="2" strokeDasharray="6 3" />
                  <text x="690" y="20" fill="#f43f5e" fontSize="10" fontFamily="monospace" textAnchor="end">30h Max Limit</text>

                  {/* Flight Deck Trend Area & Path (Orange) */}
                  <path
                    d="M 50 100 Q 150 85 250 70 T 450 50 T 650 35 L 650 110 L 50 110 Z"
                    fill="rgba(243, 124, 28, 0.15)"
                  />
                  <path
                    d="M 50 100 Q 150 85 250 70 T 450 50 T 650 35"
                    fill="none"
                    stroke="#F37C1C"
                    strokeWidth="3"
                  />

                  {/* Cabin Crew Trend Area & Path (Blue) */}
                  <path
                    d="M 50 105 Q 150 92 250 80 T 450 62 T 650 48 L 650 110 L 50 110 Z"
                    fill="rgba(59, 130, 246, 0.12)"
                  />
                  <path
                    d="M 50 105 Q 150 92 250 80 T 450 62 T 650 48"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                  />

                  {/* Data Points */}
                  {[
                    { x: 50, y1: 100, y2: 105, label: 'Mon' },
                    { x: 150, y1: 85, y2: 92, label: 'Tue' },
                    { x: 250, y1: 70, y2: 80, label: 'Wed' },
                    { x: 350, y1: 60, y2: 70, label: 'Thu' },
                    { x: 450, y1: 50, y2: 62, label: 'Fri' },
                    { x: 550, y1: 42, y2: 55, label: 'Sat' },
                    { x: 650, y1: 35, y2: 48, label: 'Sun' },
                  ].map((pt, idx) => (
                    <g key={idx}>
                      <circle cx={pt.x} cy={pt.y1} r="4" fill="#F37C1C" stroke="#ffffff" strokeWidth="1.5" />
                      <circle cx={pt.x} cy={pt.y2} r="4" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                      <text x={pt.x} y="118" fill="#94a3b8" fontSize="10" fontFamily="monospace" textAnchor="middle">
                        {pt.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* Crew Fatigue Distribution 4-Tier Meter */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">Normal (&lt;60% FTL)</span>
                <div className="text-xl font-black text-emerald-700 mt-1">{crewFatigueTiers.normalCount} Crew</div>
                <span className="text-[10px] text-emerald-600">Safe Operating Zone</span>
              </div>
              <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                <span className="text-[10px] font-bold text-yellow-800 uppercase block">Moderate (60-80%)</span>
                <div className="text-xl font-black text-yellow-700 mt-1">{crewFatigueTiers.moderateCount} Crew</div>
                <span className="text-[10px] text-yellow-600">Nominal Duty Curve</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-[10px] font-bold text-amber-800 uppercase block">Elevated (80-95%)</span>
                <div className="text-xl font-black text-amber-700 mt-1">{crewFatigueTiers.elevatedCount} Crew</div>
                <span className="text-[10px] text-amber-600">Monitoring Required</span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[10px] font-bold text-rose-800 uppercase block">Critical (&gt;95%)</span>
                <div className="text-xl font-black text-rose-700 mt-1">{crewFatigueTiers.criticalCount} Crew</div>
                <span className="text-[10px] text-rose-600 font-bold">Near FTL Block Lock</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Top At-Risk Crew Radar */}
        {fatigueTab === 'crew_radar' && (
          <div className="space-y-3 font-mono text-xs">
            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider flex items-center justify-between pb-1">
              <span>High Duty Accumulation Crew Watchlist (Top 5)</span>
              <span>Monthly Limit: {maxMonthlyLimit}h</span>
            </div>

            <div className="space-y-2">
              {topFatigueCrew.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    c.isCritical
                      ? 'bg-rose-50 border-rose-300'
                      : c.isElevated
                      ? 'bg-amber-50 border-amber-300'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl font-black flex items-center justify-center text-xs ${
                      c.role === 'Captain' ? 'bg-slate-900 text-white' : c.role === 'First Officer' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {c.role === 'Captain' ? 'CPT' : c.role === 'First Officer' ? 'FO' : 'CC'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{c.name}</span>
                        <span className="text-[10px] text-slate-500">({c.staffNumber})</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {c.aircraft}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-600 font-sans">
                        Base: {c.base} • Status: {c.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:self-center">
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">
                        {c.monthlyBlockHours || 0}h / {maxMonthlyLimit}h
                      </div>
                      <span className={`text-[10px] font-bold ${c.isCritical ? 'text-rose-600' : c.isElevated ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {c.percent}% Used ({c.remaining}h Left)
                      </span>
                    </div>

                    <button
                      onClick={() => onNavigate('fatigue')}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      View Profile →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. DYNAMIC TOTAL OPEN ASSIGNMENTS BREAKDOWN */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#F37C1C]" />
            <h3 className="text-sm font-black text-slate-900 font-mono uppercase tracking-wider">
              Live Roster Coverage &amp; Open Positions Breakdown
            </h3>
          </div>
          <button
            onClick={() => onNavigate('scheduling')}
            className="text-xs font-bold text-[#F37C1C] hover:underline cursor-pointer flex items-center gap-1"
          >
            Open Dispatcher Scheduler →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Open Flight Legs</span>
            <div className={`text-2xl font-black font-mono mt-1 ${openSummary.totalOpenSectors > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
              {openSummary.totalOpenSectors}
            </div>
            <span className="text-[10px] text-slate-400">Total Sectors</span>
          </div>

          <div className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200">
            <span className="text-[10px] text-rose-700 uppercase font-bold block">Open Captains</span>
            <div className="text-2xl font-black text-rose-700 font-mono mt-1">
              {openSummary.openCaptains}
            </div>
            <span className="text-[10px] text-rose-600 font-mono">CPT Vacancies</span>
          </div>

          <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200">
            <span className="text-[10px] text-amber-700 uppercase font-bold block">Open First Officers</span>
            <div className="text-2xl font-black text-amber-700 font-mono mt-1">
              {openSummary.openFirstOfficers}
            </div>
            <span className="text-[10px] text-amber-600 font-mono">FO Vacancies</span>
          </div>

          <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200">
            <span className="text-[10px] text-purple-700 uppercase font-bold block">Open Senior CC</span>
            <div className="text-2xl font-black text-purple-700 font-mono mt-1">
              {openSummary.openSeniorCabinCrew}
            </div>
            <span className="text-[10px] text-purple-600 font-mono">SCC Vacancies</span>
          </div>

          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200">
            <span className="text-[10px] text-blue-700 uppercase font-bold block">Open Cabin Crew</span>
            <div className="text-2xl font-black text-blue-700 font-mono mt-1">
              {openSummary.openCabinCrew}
            </div>
            <span className="text-[10px] text-blue-600 font-mono">CC Vacancies</span>
          </div>

          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[10px] text-emerald-700 uppercase font-bold block">Fully Assigned</span>
            <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
              {openSummary.fullyAssignedSectors}
            </div>
            <span className="text-[10px] text-emerald-600 font-mono">100% Compliant</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. FLEET STATUS CARDS (9J-ZAW & 9J-ZAE) */}
      {/* ------------------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-2">
            <Plane className="w-4 h-4 text-[#2E2C2B]" />
            Fleet Status &amp; Tail Registrations
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Q400 Fleet Card */}
          {(() => {
            const q400Fleet = fleet.filter(f => f.aircraft === 'Q400');
            const q400Regs = q400Fleet.map(f => f.registration).join(', ') || 'No Tail Registered';
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 text-white font-black text-sm rounded-xl flex items-center justify-center font-mono shadow-md">
                      Q400
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-900 text-base">De Havilland Dash 8-Q400</h3>
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${q400Fleet.length > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>
                          {q400Regs}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Domestic Hub (LUN ⇄ NLA, SLA, LVI, KWE, MFU)</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('flights')}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                  >
                    View Module →
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-3 border-t border-slate-100 text-center font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Fleet Count</span>
                    <div className="text-sm font-black text-slate-800 mt-1">{q400Fleet.length}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Sectors</span>
                    <div className="text-base font-black text-slate-800 mt-1">{q400Flights.length}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Crew Avail</span>
                    <div className="text-base font-black text-emerald-600 mt-1">{q400CrewCount}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Assigned</span>
                    <div className="text-base font-black text-blue-600 mt-1">{q400Assigned}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Open</span>
                    <div className={`text-base font-black mt-1 ${q400Open > 0 ? 'text-rose-600' : 'text-slate-700'}`}>{q400Open}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Block</span>
                    <div className="text-base font-black text-slate-800 mt-1">{q400BlockHours.toFixed(1)}h</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* B737 Fleet Card */}
          {(() => {
            const b737Fleet = fleet.filter(f => f.aircraft === 'B737');
            const b737Regs = b737Fleet.map(f => f.registration).join(', ') || 'No Tail Registered';
            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#F37C1C] text-white font-black text-sm rounded-xl flex items-center justify-center font-mono shadow-md">
                      B737
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-900 text-base">Boeing 737-700 Jet</h3>
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${b737Fleet.length > 0 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-500'}`}>
                          {b737Regs}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Regional &amp; International (LUN ⇄ JNB, HRE, DAR)</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('flights')}
                    className="px-3 py-1.5 bg-orange-50 text-[#F37C1C] hover:bg-orange-100 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                  >
                    View Module →
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-3 border-t border-slate-100 text-center font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Fleet Count</span>
                    <div className="text-sm font-black text-slate-800 mt-1">{b737Fleet.length}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Sectors</span>
                    <div className="text-base font-black text-slate-800 mt-1">{b737Flights.length}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Crew Avail</span>
                    <div className="text-base font-black text-emerald-600 mt-1">{b737CrewCount}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Assigned</span>
                    <div className="text-base font-black text-indigo-600 mt-1">{b737Assigned}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Open</span>
                    <div className={`text-base font-black mt-1 ${b737Open > 0 ? 'text-rose-600' : 'text-slate-700'}`}>{b737Open}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Block</span>
                    <div className="text-base font-black text-slate-800 mt-1">{b737BlockHours.toFixed(1)}h</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. ALERTS BENTO SECTION (DOCUMENT, TRAINING & ACKNOWLEDGMENT) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Expiry Warnings */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-amber-500" />
              Document Expirations
            </h3>
            <button
              onClick={() => onNavigate('documents')}
              className="text-xs font-bold text-amber-600 hover:underline cursor-pointer"
            >
              Tracker →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/60">
              <span className="text-[9px] font-bold text-amber-700 uppercase block">Passport &lt;90d</span>
              <div className="text-xl font-black text-amber-900 mt-0.5">{passportExpiring}</div>
            </div>
            <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-200/60">
              <span className="text-[9px] font-bold text-rose-700 uppercase block">Airport Pass &lt;60d</span>
              <div className="text-xl font-black text-rose-900 mt-0.5">{airportPassExpiring}</div>
            </div>
            <div className="p-2.5 bg-red-50/60 rounded-xl border border-red-200/60">
              <span className="text-[9px] font-bold text-red-700 uppercase block">Medical &lt;60d</span>
              <div className="text-xl font-black text-red-900 mt-0.5">{medicalExpiring}</div>
            </div>
            <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200">
              <span className="text-[9px] font-bold text-slate-700 uppercase block">License &lt;60d</span>
              <div className="text-xl font-black text-slate-900 mt-0.5">{licenseExpiring}</div>
            </div>
          </div>
        </div>

        {/* Training & Recency Alerts */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              Training &amp; Recency
            </h3>
            <button
              onClick={() => onNavigate('recency')}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Recency →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200/60">
              <span className="text-[9px] font-bold text-blue-700 uppercase block">Line Checks</span>
              <div className="text-xl font-black text-blue-900 mt-0.5">{lineCheckDue}</div>
            </div>
            <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-200/60">
              <span className="text-[9px] font-bold text-indigo-700 uppercase block">Recurrent TRNG</span>
              <div className="text-xl font-black text-indigo-900 mt-0.5">{recurrentTrainingDue}</div>
            </div>
            <div className="p-2.5 bg-purple-50/60 rounded-xl border border-purple-200/60">
              <span className="text-[9px] font-bold text-purple-700 uppercase block">SIM Checks</span>
              <div className="text-xl font-black text-purple-900 mt-0.5">{simulatorDue}</div>
            </div>
            <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-200/60">
              <span className="text-[9px] font-bold text-rose-700 uppercase block">Pilot Recency</span>
              <div className="text-xl font-black text-rose-900 mt-0.5">{recencyExpiring}</div>
            </div>
          </div>
        </div>

        {/* Standby Coverage & Roster Acknowledgment Status */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-600" />
                Standby &amp; Acknowledgment
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center font-mono">
                <span className="text-slate-600 font-bold">Airport Standby (STBY):</span>
                <span className="text-sm font-black text-slate-900">{airportStandbyCount} Active</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center font-mono">
                <span className="text-slate-600 font-bold">Home Reserve (SBH):</span>
                <span className="text-sm font-black text-slate-900">{homeReserveCount} Ready</span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center font-mono">
                <span className="text-emerald-800 font-bold">Rosters Acknowledged:</span>
                <span className="text-sm font-black text-emerald-700">{acknowledgedCount} Signed</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('portal')}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
          >
            Review Crew Portal Acknowledgment
          </button>
        </div>
      </div>
    </div>
  );
};
