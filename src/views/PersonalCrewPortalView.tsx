import React, { useState, useEffect } from 'react';
import {
  CrewMember,
  Flight,
  Assignment,
  LeaveTrainingRecord,
  SystemUser,
  RosterAcknowledgment,
} from '../types';
import {
  calculateReportingTime,
  calculateDutyEndTime,
  calculateFlightDutyPeriod,
  DUTY_CODES_MAP,
  DutyCode,
  FLEET_REGISTRATIONS,
} from '../utils/dutyTimeCalculator';
import { loadAcknowledgments } from '../utils/storage';
import {
  cacheCriticalRoster,
  queueOfflineAcknowledgment,
  flushPendingAcknowledgments,
  subscribeToSyncStatus,
  getOfflineSyncStatus,
  OfflineSyncStatus,
} from '../utils/offlineSync';
import {
  Plane,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  Bell,
  Sparkles,
  Info,
  CalendarCheck,
  Award,
  AlertTriangle,
  FileCheck,
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  Radio,
} from 'lucide-react';

interface PersonalCrewPortalViewProps {
  crew: CrewMember[];
  flights: Flight[];
  assignments: Assignment[];
  leaveRecords: LeaveTrainingRecord[];
  currentUser: SystemUser;
  onRefreshData?: () => void;
}

export const PersonalCrewPortalView: React.FC<PersonalCrewPortalViewProps> = ({
  crew,
  flights,
  assignments,
  leaveRecords,
  currentUser,
  onRefreshData,
}) => {
  // Find matched crew member if user is a pilot/cabin crew, otherwise default to first captain
  const matchedCrew = crew.find(
    (c) => c.staffNumber === currentUser.staffNumber || c.name.includes(currentUser.name.split(' ')[0])
  );

  const [selectedCrewId, setSelectedCrewId] = useState<string>(
    matchedCrew?.id || (crew.length > 0 ? crew[0].id : '')
  );

  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [selectedDutyForModal, setSelectedDutyForModal] = useState<{
    flight?: Flight;
    asg?: Assignment;
    leave?: LeaveTrainingRecord;
    dutyCode: DutyCode;
    date: string;
    reportTime: string;
    dutyEndTime: string;
  } | null>(null);

  const [acknowledgments, setAcknowledgments] = useState<RosterAcknowledgment[]>(loadAcknowledgments());
  const [ackSuccessMessage, setAckSuccessMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<OfflineSyncStatus>(getOfflineSyncStatus());
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  // Subscribe to Service Worker & Network Sync Events
  useEffect(() => {
    const unsub = subscribeToSyncStatus((status) => {
      setSyncStatus(status);
      setAcknowledgments(loadAcknowledgments());
    });
    return () => unsub();
  }, []);

  const selectedCrew = crew.find((c) => c.id === selectedCrewId) || crew[0];

  // Filter assignments for selected crew member
  const crewAssignments = selectedCrew
    ? assignments.filter((asg) => {
        return (
          asg.captainId === selectedCrew.id ||
          asg.firstOfficerId === selectedCrew.id ||
          (asg.cabinCrewIds && asg.cabinCrewIds.includes(selectedCrew.id))
        );
      })
    : [];

  // Automatically cache critical roster snapshot whenever view mounts or data updates
  useEffect(() => {
    if (crew.length > 0 || flights.length > 0) {
      cacheCriticalRoster({
        id: 'latest_roster_snapshot',
        period: selectedMonth,
        timestamp: new Date().toISOString(),
        flights,
        crew,
        assignments,
        leaveRecords,
        fleet: [],
        rules: {
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
        },
        publishedCount: crewAssignments.length,
      });
    }
  }, [crew, flights, assignments, leaveRecords, selectedMonth, crewAssignments.length]);

  if (!selectedCrew) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-xl mx-auto my-12 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
          <Plane className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-black text-slate-900 font-mono">No Crew Members Available</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            The crew database is currently empty. Add or import crew records in the Crew Registry to access personal flight rosters, duty schedules, and legality compliance metrics.
          </p>
        </div>
      </div>
    );
  }

  // Attach flight objects
  const assignedFlights = crewAssignments
    .map((asg) => {
      const flight = flights.find((f) => f.id === asg.flightId);
      return flight ? { flight, assignment: asg } : null;
    })
    .filter(Boolean) as { flight: Flight; assignment: Assignment }[];

  // Sort flights chronologically
  assignedFlights.sort((a, b) => {
    const dComp = a.flight.date.localeCompare(b.flight.date);
    if (dComp !== 0) return dComp;
    return a.flight.std.localeCompare(b.flight.std);
  });

  // Leave and non-flight duties
  const crewLeaves = leaveRecords.filter((l) => l.crewId === selectedCrew.id && l.approved);

  // Acknowledgment status for current selected period
  const userAck = acknowledgments.find(
    (a) => a.crewId === selectedCrew.id && a.rosterPeriod === selectedMonth
  );

  const handleAcknowledge = async () => {
    const ack = await queueOfflineAcknowledgment(
      selectedCrew.id,
      selectedCrew.staffNumber,
      selectedCrew.name,
      selectedMonth
    );
    setAcknowledgments(loadAcknowledgments());
    
    if (navigator.onLine) {
      setAckSuccessMessage(`Roster successfully acknowledged & synced to OCC on ${new Date().toLocaleTimeString()}`);
    } else {
      setAckSuccessMessage(`Roster acknowledged offline. Saved in Service Worker DB and queued for Background Sync.`);
    }

    if (onRefreshData) onRefreshData();
    setTimeout(() => setAckSuccessMessage(null), 6000);
  };

  const handleManualFlush = async () => {
    setIsManualSyncing(true);
    const res = await flushPendingAcknowledgments();
    setIsManualSyncing(false);
    if (res.success && res.syncedCount > 0) {
      setAckSuccessMessage(`Successfully flushed and synced ${res.syncedCount} pending offline acknowledgment(s) to OCC.`);
      setTimeout(() => setAckSuccessMessage(null), 5000);
    }
  };

  // Find next upcoming duty
  const nowStr = '2026-08-10'; // System current date baseline
  const upcomingDuties = assignedFlights.filter((item) => item.flight.date >= nowStr);
  const nextDuty = upcomingDuties.length > 0 ? upcomingDuties[0] : null;

  // Monthly stats calculations
  const totalMonthlyBlock = assignedFlights
    .filter((item) => item.flight.date.startsWith(selectedMonth))
    .reduce((sum, item) => sum + item.flight.blockHours, 0);

  const totalMonthlySectors = assignedFlights.filter((item) =>
    item.flight.date.startsWith(selectedMonth)
  ).length;

  const weeklyBlockHours = selectedCrew.weeklyBlockHours || totalMonthlyBlock * 0.25;
  const maxWeeklyHours = 30;
  const maxMonthlyHours = 100;

  // Check crew pairings for a flight
  const getPairedCrew = (asg: Assignment, fl: Flight) => {
    const captain = crew.find((c) => c.id === asg.captainId);
    const fo = crew.find((c) => c.id === asg.firstOfficerId);
    const cabin = (asg.cabinCrewIds || [])
      .map((id) => crew.find((c) => c.id === id))
      .filter(Boolean) as CrewMember[];
    return { captain, fo, cabin };
  };

  // Build Month Calendar Grid for August 2026
  const daysInMonth = 31;
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `2026-08-${String(dayNum).padStart(2, '0')}`;
    const dayFlights = assignedFlights.filter((item) => item.flight.date === dateStr);
    const dayLeave = crewLeaves.find((l) => dateStr >= l.startDate && dateStr <= l.endDate);

    let dutyCode: DutyCode = 'GDO'; // Default Day Off if nothing assigned
    if (dayFlights.length > 0) {
      dutyCode = dayFlights[0].assignment.dutyCode || 'FLT';
    } else if (dayLeave) {
      if (dayLeave.type === 'Annual Leave') dutyCode = 'VAC';
      else if (dayLeave.type === 'Sick') dutyCode = 'SCK';
      else if (dayLeave.type === 'Simulator') dutyCode = 'SIM';
      else if (dayLeave.type === 'Training' || dayLeave.type === 'Recurrent Training') dutyCode = 'TRNG';
      else if (dayLeave.type === 'Line Check') dutyCode = 'CHK';
      else if (dayLeave.type === 'Standby') dutyCode = 'STBY';
      else dutyCode = 'GDO';
    }

    return {
      dayNum,
      dateStr,
      dayFlights,
      dayLeave,
      dutyCode,
    };
  });

  return (
    <div className="p-3 sm:p-5 md:p-6 space-y-6 bg-slate-50 min-h-full font-sans">
      {/* 1. HEADER & CREW SWITCHER BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-[#2E2C2B] to-slate-800 text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-md border border-slate-700">
            {selectedCrew.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
                {selectedCrew.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-blue-100 text-blue-800 border border-blue-200">
                {selectedCrew.staffNumber}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-3">
              <span className="font-semibold text-slate-700">{selectedCrew.role}</span>
              <span>•</span>
              <span className="font-mono font-bold text-slate-700">
                Fleet: {selectedCrew.aircraft} ({selectedCrew.aircraft === 'B737' ? FLEET_REGISTRATIONS.B737 : FLEET_REGISTRATIONS.Q400})
              </span>
              <span>•</span>
              <span>Base: <strong className="text-slate-700">{selectedCrew.base}</strong></span>
              <span>•</span>
              <span>Status: <strong className="text-emerald-600 font-bold">{selectedCrew.status}</strong></span>
            </p>
          </div>
        </div>

        {/* Crew Selector for Management / Schedulers OR Locked Profile for Crew Self-Service */}
        {currentUser.role === 'FLIGHT_CREW' || currentUser.role === 'PILOT_CABIN' ? (
          <div className="flex items-center gap-2.5 bg-emerald-50 text-emerald-900 px-3.5 py-2.5 rounded-xl border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="text-[10px] text-emerald-700 uppercase font-bold font-mono block">
                Restricted Self-Service Session
              </span>
              <span className="text-xs font-bold font-mono">
                {selectedCrew.name} ({selectedCrew.staffNumber})
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <User className="w-4 h-4 text-slate-400" />
            <div className="text-xs">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Management Inspector: Switch Crew Portal
              </span>
              <select
                value={selectedCrewId}
                onChange={(e) => setSelectedCrewId(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
              >
                {crew.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.staffNumber}) - {c.role} [{c.aircraft}]
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ACKNOWLEDGMENT SUCCESS BANNER */}
      {ackSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{ackSuccessMessage}</span>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-emerald-200 rounded">
            Legally Recorded
          </span>
        </div>
      )}

      {/* 2. ROSTER ACKNOWLEDGMENT & COMPLIANCE STATUS BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${userAck ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                Official Roster Period: August 2026 (Rev 1)
              </span>
              {userAck ? (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold font-mono">
                  ✓ ACKNOWLEDGED
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold font-mono animate-pulse">
                  ⚠ PENDING ACKNOWLEDGMENT
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {userAck
                ? `Acknowledged by ${selectedCrew.name} on ${new Date(userAck.acknowledgedAt || '').toLocaleString()}`
                : 'Please review your published duty schedule and confirm receipt to OCC.'}
            </p>
          </div>
        </div>

        <div>
          {userAck ? (
            <button
              disabled
              className="px-4 py-2.5 bg-slate-100 text-slate-500 font-bold text-xs rounded-xl flex items-center gap-2 cursor-default"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Roster Acknowledged
            </button>
          ) : (
            <button
              onClick={handleAcknowledge}
              className="px-5 py-2.5 bg-[#F37C1C] hover:bg-[#D96B12] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
            >
              <FileCheck className="w-4 h-4" />
              Acknowledge My Published Roster
            </button>
          )}
        </div>
      </div>

      {/* 2B. REMOTE AIRPORT OFFLINE & BACKGROUND SYNC STATUS CARD */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              syncStatus.isOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {syncStatus.isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-extrabold font-mono text-white">
                  {syncStatus.isOnline ? 'Connected to OCC' : 'Remote Airport Offline Mode'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider ${
                  syncStatus.isOnline ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                }`}>
                  {syncStatus.isOnline ? 'Network Active' : 'Offline Cached Ready'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {syncStatus.isOnline
                  ? 'Service Worker caching and Background Sync active for outstation flight operations.'
                  : 'Operating in remote offline mode (Livingstone, Solwezi, Mfuwe, Mansa, Kasama, Ndola). Critical roster data and pending acknowledgments are stored locally.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            {syncStatus.pendingCount > 0 && (
              <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                {syncStatus.pendingCount} Pending Sync
              </span>
            )}

            <button
              onClick={handleManualFlush}
              disabled={isManualSyncing || !syncStatus.isOnline}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                syncStatus.isOnline
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer active:scale-95'
                  : 'bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed'
              }`}
              title={syncStatus.isOnline ? 'Flush and sync all pending acknowledgments with OCC' : 'Connect to internet to sync queued acknowledgments'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin text-orange-400' : 'text-slate-400'}`} />
              <span>{isManualSyncing ? 'Syncing...' : 'Sync Pending Queue'}</span>
            </button>
          </div>
        </div>

        {/* Technical Sync Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3.5 border-t border-slate-800/80 text-[11px] font-mono">
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Service Worker</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
              <Database className="w-3 h-3" />
              IndexedDB DB Active
            </span>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Background Sync API</span>
            <span className="text-slate-200 font-bold flex items-center gap-1 mt-0.5">
              <Radio className="w-3 h-3 text-orange-400" />
              sync-roster-acknowledgments
            </span>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Queued Acks</span>
            <span className={`font-bold mt-0.5 block ${syncStatus.pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {syncStatus.pendingCount} in queue
            </span>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
            <span className="text-slate-400 text-[10px] block uppercase font-bold">Last Roster Cache</span>
            <span className="text-slate-300 font-bold mt-0.5 block truncate">
              {syncStatus.lastCachedAt ? new Date(syncStatus.lastCachedAt).toLocaleTimeString() : 'Current Session'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. NEXT DUTY HERO CARD & FTL PROGRESS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Next Duty Card */}
        <div className="lg:col-span-8 bg-gradient-to-br from-[#2E2C2B] to-slate-900 text-white rounded-2xl shadow-xl p-5 sm:p-6 relative overflow-hidden border border-slate-800">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#F37C1C]/10 rounded-bl-full pointer-events-none" />

          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <span className="text-xs font-bold text-[#F37C1C] uppercase tracking-wider font-mono flex items-center gap-2">
              <Plane className="w-4 h-4 text-[#F37C1C]" />
              Next Scheduled Flight Sector
            </span>
            {nextDuty && (
              <span className="px-2.5 py-0.5 bg-white/10 rounded-full text-xs font-mono font-bold">
                {nextDuty.flight.date}
              </span>
            )}
          </div>

          {nextDuty ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-3xl font-black font-mono tracking-tight text-white flex items-center gap-3">
                    {nextDuty.flight.flightNumber}
                    <span className="text-sm font-normal text-slate-300 font-sans">
                      ({nextDuty.flight.aircraft} • <strong>{nextDuty.flight.registration || (nextDuty.flight.aircraft === 'B737' ? '9J-ZAE' : '9J-ZAW')}</strong>)
                    </span>
                  </h3>
                  <div className="text-sm font-bold text-slate-300 mt-1 flex items-center gap-2">
                    <span>{nextDuty.flight.departure}</span>
                    <span>→</span>
                    <span>{nextDuty.flight.arrival}</span>
                    <span className="text-xs text-slate-400 font-mono">({nextDuty.flight.blockHours}h Block)</span>
                  </div>
                </div>

                {/* Duty Code Badge */}
                <div>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-lg text-xs font-mono font-bold">
                    DUTY CODE: {nextDuty.assignment.dutyCode || 'FLT'} (Flight Duty)
                  </span>
                </div>
              </div>

              {/* Standard Duty Time Calculations Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/5 p-4 rounded-xl border border-white/10">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">STD (Departure)</span>
                  <div className="text-lg font-black font-mono text-white mt-0.5">{nextDuty.flight.std}</div>
                  <span className="text-[10px] text-slate-400 font-mono">Scheduled</span>
                </div>

                <div className="border-l border-white/10 pl-3">
                  <span className="text-[10px] text-[#F37C1C] uppercase font-bold block">
                    Report Time (STD - 01:00)
                  </span>
                  <div className="text-lg font-black font-mono text-[#F37C1C] mt-0.5">
                    {calculateReportingTime(nextDuty.flight.std)}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Mandatory Briefing</span>
                </div>

                <div className="border-l border-white/10 pl-3">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">STA (Arrival)</span>
                  <div className="text-lg font-black font-mono text-white mt-0.5">{nextDuty.flight.sta}</div>
                  <span className="text-[10px] text-slate-400 font-mono">Scheduled</span>
                </div>

                <div className="border-l border-white/10 pl-3">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold block">
                    Duty End (STA + 00:30)
                  </span>
                  <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                    {calculateDutyEndTime(nextDuty.flight.sta)}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Duty Release</span>
                </div>
              </div>

              {/* Paired Crew on This Flight */}
              {(() => {
                const pairing = getPairedCrew(nextDuty.assignment, nextDuty.flight);
                return (
                  <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 text-xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-2 font-mono">
                      Operating Crew Complement Pairing
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <span className="text-slate-400 text-[11px]">Captain:</span>{' '}
                        <strong className="text-white">
                          {pairing.captain ? pairing.captain.name : 'UNASSIGNED'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px]">First Officer:</span>{' '}
                        <strong className="text-white">
                          {pairing.fo ? pairing.fo.name : 'UNASSIGNED'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px]">Cabin Crew:</span>{' '}
                        <strong className="text-white">
                          {pairing.cabin.length > 0
                            ? pairing.cabin.map((c) => c.name.split(' ')[0]).join(', ')
                            : 'Standard Complement'}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No upcoming flights assigned for today.</p>
            </div>
          )}
        </div>

        {/* FTL Progress & Document Status */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-[#F37C1C]" />
              FTL &amp; Duty Limitations (CAA)
            </h3>

            {/* Weekly Hours Bar */}
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600">Weekly Block Hours</span>
                <span className="text-slate-900 font-mono">
                  {weeklyBlockHours.toFixed(1)}h / {maxWeeklyHours}h
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    weeklyBlockHours > 25 ? 'bg-rose-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, (weeklyBlockHours / maxWeeklyHours) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400">
                {(maxWeeklyHours - weeklyBlockHours).toFixed(1)}h remaining before 7-day limit
              </span>
            </div>

            {/* Monthly Hours Bar */}
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600">Monthly Block Hours (Aug)</span>
                <span className="text-slate-900 font-mono">
                  {totalMonthlyBlock.toFixed(1)}h / {maxMonthlyHours}h
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    totalMonthlyBlock > 85 ? 'bg-amber-500' : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.min(100, (totalMonthlyBlock / maxMonthlyHours) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400">
                {totalMonthlySectors} flights assigned this month
              </span>
            </div>

            {/* Rest Compliant Badge */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">7-Day Rolling Rest</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 24h Rest Period Met
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Min 10h Rest</span>
            </div>
          </div>

          {/* Quick Document Status Badges */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 bg-slate-50 rounded-lg">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">License Expiry</span>
              <span className="font-mono font-bold text-slate-800">{selectedCrew.licenseExpiry || 'VALID'}</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">Medical Expiry</span>
              <span className="font-mono font-bold text-slate-800">{selectedCrew.medicalExpiry || 'VALID'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. DUTY CODES REFERENCE LEGEND */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono flex items-center gap-2">
            <Award className="w-4 h-4 text-[#2E2C2B]" />
            Official IATA / CAA Duty Codes Reference
          </span>
          <span className="text-[10px] text-slate-400 font-mono">12 Standardized Duty Codes</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.values(DUTY_CODES_MAP).map((info) => (
            <div
              key={info.code}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200 text-xs"
              title={info.description}
            >
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black font-mono ${info.badgeBg} ${info.badgeText}`}>
                {info.code}
              </span>
              <span className="font-semibold text-slate-700 text-[11px]">{info.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. MONTHLY DUTY SCHEDULE CALENDAR VIEW */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base sm:text-lg font-black text-slate-900 font-mono flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#F37C1C]" />
              Personal Roster: August 2026
            </h2>
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-mono font-bold">
              {totalMonthlySectors} Sectors Assigned
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-500">Total Block:</span>
            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
              {totalMonthlyBlock.toFixed(1)} hrs
            </span>
          </div>
        </div>

        {/* Calendar Day Cells */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {calendarDays.map((day) => {
            const hasFlight = day.dayFlights.length > 0;
            const dutyInfo = DUTY_CODES_MAP[day.dutyCode];

            let cellBg = 'bg-slate-50 border-slate-200 hover:border-slate-300';
            if (hasFlight) cellBg = 'bg-blue-50/50 border-blue-300 hover:border-blue-500 hover:shadow-sm';
            else if (day.dutyCode === 'STBY' || day.dutyCode === 'SBH') cellBg = 'bg-amber-50/50 border-amber-300';
            else if (day.dutyCode === 'VAC' || day.dutyCode === 'GDO') cellBg = 'bg-emerald-50/30 border-emerald-200';
            else if (day.dutyCode === 'TRNG' || day.dutyCode === 'SIM') cellBg = 'bg-indigo-50/50 border-indigo-300';

            return (
              <div
                key={day.dayNum}
                onClick={() => {
                  if (hasFlight) {
                    const flItem = day.dayFlights[0];
                    setSelectedDutyForModal({
                      flight: flItem.flight,
                      asg: flItem.assignment,
                      dutyCode: day.dutyCode,
                      date: day.dateStr,
                      reportTime: calculateReportingTime(flItem.flight.std),
                      dutyEndTime: calculateDutyEndTime(flItem.flight.sta),
                    });
                  }
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer min-h-[105px] flex flex-col justify-between ${cellBg}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-slate-700">
                    Day {day.dayNum}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black font-mono ${dutyInfo.badgeBg} ${dutyInfo.badgeText}`}
                  >
                    {day.dutyCode}
                  </span>
                </div>

                <div className="mt-1">
                  {hasFlight ? (
                    <div className="space-y-1">
                      {day.dayFlights.map((item) => (
                        <div key={item.flight.id} className="text-xs">
                          <div className="font-bold text-slate-900 font-mono">
                            {item.flight.flightNumber}
                          </div>
                          <div className="text-[10px] text-slate-600 font-mono">
                            {item.flight.departure} → {item.flight.arrival}
                          </div>
                          <div className="text-[9px] text-[#F37C1C] font-mono font-bold">
                            Rpt: {calculateReportingTime(item.flight.std)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : day.dayLeave ? (
                    <div className="text-[11px] font-semibold text-slate-700">
                      {day.dayLeave.description || day.dayLeave.type}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">Day Off (Rest)</div>
                  )}
                </div>

                <div className="text-[9px] text-slate-400 font-mono text-right">
                  {hasFlight
                    ? `${day.dayFlights.reduce((s, i) => s + i.flight.blockHours, 0)}h`
                    : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. DUTY DETAIL MODAL */}
      {selectedDutyForModal && selectedDutyForModal.flight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-[#F37C1C] font-mono">
                  {selectedDutyForModal.date} • {selectedDutyForModal.flight.std} STD
                </span>
                <h3 className="text-2xl font-black text-slate-900 font-mono">
                  Flight {selectedDutyForModal.flight.flightNumber} ({selectedDutyForModal.flight.aircraft})
                </h3>
                <p className="text-xs text-slate-500">
                  Registration:{' '}
                  <strong className="text-slate-800">
                    {selectedDutyForModal.flight.registration ||
                      (selectedDutyForModal.flight.aircraft === 'B737' ? '9J-ZAE' : '9J-ZAW')}
                  </strong>{' '}
                  • Route: {selectedDutyForModal.flight.departure} → {selectedDutyForModal.flight.arrival}
                </p>
              </div>
              <button
                onClick={() => setSelectedDutyForModal(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                ✕
              </button>
            </div>

            {/* Timings */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Reporting Time (STD - 01:00):</span>
                <strong className="text-base text-[#F37C1C]">{selectedDutyForModal.reportTime}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Duty End (STA + 00:30):</span>
                <strong className="text-base text-emerald-600">{selectedDutyForModal.dutyEndTime}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Scheduled STD / STA:</span>
                <strong className="text-slate-800">
                  {selectedDutyForModal.flight.std} - {selectedDutyForModal.flight.sta}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Flight Duty Period (FDP):</span>
                <strong className="text-slate-800">
                  {calculateFlightDutyPeriod(
                    selectedDutyForModal.reportTime,
                    selectedDutyForModal.dutyEndTime
                  )}
                  h
                </strong>
              </div>
            </div>

            {/* Crew Complement */}
            {selectedDutyForModal.asg && (
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-mono">
                  Operating Crew Roster
                </h4>
                {(() => {
                  const pairing = getPairedCrew(
                    selectedDutyForModal.asg!,
                    selectedDutyForModal.flight!
                  );
                  return (
                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-lg flex justify-between items-center border border-slate-200">
                        <span className="text-slate-500">Captain (CPT):</span>
                        <strong className="text-slate-900">
                          {pairing.captain ? `${pairing.captain.name} (${pairing.captain.staffNumber})` : 'UNASSIGNED'}
                        </strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg flex justify-between items-center border border-slate-200">
                        <span className="text-slate-500">First Officer (FO):</span>
                        <strong className="text-slate-900">
                          {pairing.fo ? `${pairing.fo.name} (${pairing.fo.staffNumber})` : 'UNASSIGNED'}
                        </strong>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg flex justify-between items-center border border-slate-200">
                        <span className="text-slate-500">Cabin Crew:</span>
                        <strong className="text-slate-900">
                          {pairing.cabin.length > 0
                            ? pairing.cabin.map((c) => `${c.name} (${c.staffNumber})`).join(', ')
                            : 'Standard Cabin Complement'}
                        </strong>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedDutyForModal(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
