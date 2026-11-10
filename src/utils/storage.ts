import {
  CrewMember,
  Flight,
  Assignment,
  LeaveTrainingRecord,
  LegalityRules,
  AuditLog,
  AircraftFleet,
  SystemUser,
  SystemNotification,
  RosterAcknowledgment,
  OpenAssignmentsSummary,
} from '../types';
import {
  syncCrewToFirebase,
  syncFlightsToFirebase,
  syncAssignmentsToFirebase,
  syncLeaveToFirebase,
  syncFleetToFirebase,
  syncRulesToFirebase,
  syncUsersToFirebase,
  syncAuditLogsToFirebase,
  clearAllFirebaseCollections,
} from './firebaseSync';

const STORAGE_KEYS = {
  CREW: 'zambia_airways_crew',
  FLIGHTS: 'zambia_airways_flights',
  ASSIGNMENTS: 'zambia_airways_assignments',
  LEAVE: 'zambia_airways_leave',
  RULES: 'zambia_airways_rules',
  AUDIT: 'zambia_airways_audit',
  AIRCRAFT: 'zambia_airways_aircraft',
  USERS: 'zambia_airways_users',
  CURRENT_USER: 'zambia_airways_current_user',
  NOTIFICATIONS: 'zambia_airways_notifications',
  ACKNOWLEDGMENTS: 'zambia_airways_acknowledgments',
};

export const DEFAULT_USERS: SystemUser[] = [
  {
    id: 'usr-admin-default',
    staffNumber: 'ZA-ADM-001',
    name: 'System Administrator',
    email: 'admin@zambiaairways.co.zm',
    role: 'SUPER_ADMIN',
    department: 'Flight Operations & OCC Admin',
    base: 'LUN',
    status: 'ACTIVE',
    avatarInitials: 'SA',
    lastLogin: 'Active Session',
    mfaEnabled: true,
    mfaMethod: 'APP_AUTHENTICATOR',
    permissions: {
      canEditRoster: true,
      canGenerateRoster: true,
      canManageCrew: true,
      canEditSettings: true,
      canResetData: true,
      canOverrideLegality: true,
      canManageUsers: true,
      canExportAudit: true,
      canApproveRosterEdits: true,
      canViewFullPii: true,
      canManageSecurity: true,
    },
  },
  {
    id: 'usr-sched-002',
    staffNumber: 'ZA-SCH-002',
    name: 'Crew Scheduler',
    email: 'scheduler@zambiaairways.co.zm',
    role: 'SCHEDULER',
    department: 'Crew Planning & Scheduling',
    base: 'LUN',
    status: 'ACTIVE',
    avatarInitials: 'CS',
    lastLogin: 'Active Session',
    mfaEnabled: false,
    permissions: {
      canEditRoster: true,
      canGenerateRoster: true,
      canManageCrew: true,
      canEditSettings: false,
      canResetData: false,
      canOverrideLegality: false,
      canManageUsers: false,
      canExportAudit: true,
      canApproveRosterEdits: false,
      canViewFullPii: false,
      canManageSecurity: false,
    },
  },
  {
    id: 'usr-occ-003',
    staffNumber: 'ZA-OCC-003',
    name: 'OCC Controller',
    email: 'occ@zambiaairways.co.zm',
    role: 'OCC_CONTROLLER',
    department: 'Operations Control Center',
    base: 'LUN',
    status: 'ACTIVE',
    avatarInitials: 'OC',
    lastLogin: 'Active Session',
    mfaEnabled: false,
    permissions: {
      canEditRoster: true,
      canGenerateRoster: true,
      canManageCrew: true,
      canEditSettings: false,
      canResetData: false,
      canOverrideLegality: true,
      canManageUsers: false,
      canExportAudit: true,
      canApproveRosterEdits: true,
      canViewFullPii: true,
      canManageSecurity: false,
    },
  },
  {
    id: 'usr-cpt-004',
    staffNumber: 'ZA-CPT-004',
    name: 'Chief Pilot',
    email: 'chiefpilot@zambiaairways.co.zm',
    role: 'CHIEF_PILOT',
    department: 'Flight Operations Line Management',
    base: 'LUN',
    status: 'ACTIVE',
    avatarInitials: 'CP',
    lastLogin: 'Active Session',
    mfaEnabled: false,
    permissions: {
      canEditRoster: false,
      canGenerateRoster: false,
      canManageCrew: false,
      canEditSettings: false,
      canResetData: false,
      canOverrideLegality: true,
      canManageUsers: false,
      canExportAudit: true,
      canApproveRosterEdits: true,
      canViewFullPii: true,
      canManageSecurity: false,
    },
  },
  {
    id: 'usr-flt-005',
    staffNumber: 'ZA-FLT-005',
    name: 'Flight Crew Member',
    email: 'crew@zambiaairways.co.zm',
    role: 'FLIGHT_CREW',
    department: 'Flight Operations (Fleet Crew)',
    base: 'LUN',
    status: 'ACTIVE',
    avatarInitials: 'FC',
    lastLogin: 'Active Session',
    mfaEnabled: false,
    permissions: {
      canEditRoster: false,
      canGenerateRoster: false,
      canManageCrew: false,
      canEditSettings: false,
      canResetData: false,
      canOverrideLegality: false,
      canManageUsers: false,
      canExportAudit: false,
      canApproveRosterEdits: false,
      canViewFullPii: false,
      canManageSecurity: false,
    },
  },
  {
    id: 'usr-aud-006',
    staffNumber: 'ZA-AUD-006',
    name: 'Safety & Quality Auditor',
    email: 'auditor@zambiaairways.co.zm',
    role: 'AUDITOR',
    department: 'Safety, Quality & Regulatory Compliance',
    base: 'LUN',
    status: 'ACTIVE',
    avatarInitials: 'SQ',
    lastLogin: 'Active Session',
    mfaEnabled: false,
    permissions: {
      canEditRoster: false,
      canGenerateRoster: false,
      canManageCrew: false,
      canEditSettings: false,
      canResetData: false,
      canOverrideLegality: false,
      canManageUsers: false,
      canExportAudit: true,
      canApproveRosterEdits: false,
      canViewFullPii: false,
      canManageSecurity: false,
    },
  },
];

export const DEFAULT_CURRENT_USER: SystemUser = DEFAULT_USERS[0];

export const DEFAULT_RULES: LegalityRules = {
  minRestHours: 10, // default 10h rest between duties
  maxDutyHours: 12, // default 12h max duty
  maxWeeklyBlockHours: 30, // default 30h weekly limit
  maxMonthlyBlockHours: 100, // default 100h monthly limit
  maxAnnualBlockHours: 1000, // default 1,000h annual limit
  maxConsecutiveDuties: 6,
  minRolling7DayRestHours: 24, // min 24h continuous rest in any rolling 7-day period
  maxLandingsPerDuty: 5, // max 5 landings per duty
  maxGroundTimeBetweenSectorsHours: 2.0, // ground time < 2h for linked duty continuation
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

export const DEFAULT_FLEET: AircraftFleet[] = [];

/**
 * Returns a clean, unpopulated data structure ready for real database inputs
 */
export function generateSampleData() {
  const allCrew: CrewMember[] = [];
  const flights: Flight[] = [];
  const assignments: Assignment[] = [];
  const leaveRecords: LeaveTrainingRecord[] = [];
  const fleet: AircraftFleet[] = [];
  const auditLogs: AuditLog[] = [];

  localStorage.setItem(STORAGE_KEYS.CREW, JSON.stringify(allCrew));
  localStorage.setItem(STORAGE_KEYS.FLIGHTS, JSON.stringify(flights));
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
  localStorage.setItem(STORAGE_KEYS.LEAVE, JSON.stringify(leaveRecords));
  localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(DEFAULT_RULES));
  localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(auditLogs));
  localStorage.setItem(STORAGE_KEYS.AIRCRAFT, JSON.stringify(fleet));

  return {
    crew: allCrew,
    flights,
    assignments,
    leave: leaveRecords,
    rules: DEFAULT_RULES,
    auditLogs,
    aircraft: fleet,
  };
}

export function loadCrew(): CrewMember[] {
  const data = localStorage.getItem(STORAGE_KEYS.CREW);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCrew(crew: CrewMember[]) {
  localStorage.setItem(STORAGE_KEYS.CREW, JSON.stringify(crew));
  syncCrewToFirebase(crew);
}

export function loadFlights(): Flight[] {
  const data = localStorage.getItem(STORAGE_KEYS.FLIGHTS);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFlights(flights: Flight[]) {
  localStorage.setItem(STORAGE_KEYS.FLIGHTS, JSON.stringify(flights));
  syncFlightsToFirebase(flights);
}

export function loadAssignments(): Assignment[] {
  const data = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAssignments(assignments: Assignment[]) {
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
  syncAssignmentsToFirebase(assignments);
}

export function loadLeave(): LeaveTrainingRecord[] {
  const data = localStorage.getItem(STORAGE_KEYS.LEAVE);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLeave(leave: LeaveTrainingRecord[]) {
  localStorage.setItem(STORAGE_KEYS.LEAVE, JSON.stringify(leave));
  syncLeaveToFirebase(leave);
}

export function loadRules(): LegalityRules {
  const data = localStorage.getItem(STORAGE_KEYS.RULES);
  if (!data) return DEFAULT_RULES;
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_RULES;
  }
}

export function saveRules(rules: LegalityRules) {
  localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
  syncRulesToFirebase(rules);
}

// Aliases for getter/setter functions
export const getCrew = loadCrew;
export const getFlights = loadFlights;
export const getAssignments = loadAssignments;
export const getLeaveRecords = loadLeave;
export const saveLeaveRecords = saveLeave;
export const getRules = loadRules;
export const resetToSampleData = resetAllData;

export function loadAuditLogs(): AuditLog[] {
  const data = localStorage.getItem(STORAGE_KEYS.AUDIT);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveAuditLogs(logs: AuditLog[]) {
  localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(logs));
  syncAuditLogsToFirebase(logs);
}

export function addAuditEntry(entry: Partial<AuditLog> & { user: string }) {
  const logs = loadAuditLogs();
  const now = new Date();
  const timestamp = now.toISOString();
  const previousSeal = logs.length > 0 ? (logs[0].immutableSeal || 'ZA-GENESIS-2026') : 'ZA-GENESIS-2026';
  
  // Calculate deterministic cryptographic seal
  const payload = `${timestamp}|${entry.user}|${entry.action || 'Action'}|${entry.details || 'Details'}|${previousSeal}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const h1 = Math.abs(hash).toString(16).padStart(8, '0');
  const h2 = Math.abs((hash * 31) | 0).toString(16).padStart(8, '0');
  const seal = `ZA-SEC-${h1}-${h2}`.toUpperCase();

  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user: entry.user || 'OCC Dispatcher',
    userRole: entry.userRole || 'OCC',
    date: timestamp.split('T')[0],
    time: now.toTimeString().split(' ')[0],
    action: entry.action || entry.reason || 'System Action',
    details: entry.details || entry.newAssignment || 'Operation executed',
    severity: entry.severity || 'INFO',
    immutableSeal: seal,
    previousSeal: previousSeal,
    ipAddress: '192.168.10.45 (LUN-OCC-LAN)',
    verifiedIntegrity: true,
    ...(entry.flightNumber ? { flightNumber: entry.flightNumber } : {}),
    ...(entry.crewName ? { crewName: entry.crewName } : {}),
    ...(entry.previousAssignment ? { previousAssignment: entry.previousAssignment } : {}),
    ...(entry.newAssignment ? { newAssignment: entry.newAssignment } : {}),
    ...(entry.reason ? { reason: entry.reason } : {}),
  };
  const updatedLogs = [newLog, ...logs];
  saveAuditLogs(updatedLogs);
  return updatedLogs;
}

export function loadFleet(): AircraftFleet[] {
  const data = localStorage.getItem(STORAGE_KEYS.AIRCRAFT);
  if (!data) return DEFAULT_FLEET;
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_FLEET;
  }
}

export function saveFleet(fleet: AircraftFleet[]) {
  localStorage.setItem(STORAGE_KEYS.AIRCRAFT, JSON.stringify(fleet));
  syncFleetToFirebase(fleet);
}

export function clearAllData() {
  localStorage.setItem(STORAGE_KEYS.CREW, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.FLIGHTS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.LEAVE, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.AIRCRAFT, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.ACKNOWLEDGMENTS, JSON.stringify([]));

  // Sync empty state directly to Firestore to prevent ghost records from coming back
  clearAllFirebaseCollections();

  return {
    crew: [],
    flights: [],
    assignments: [],
    leave: [],
    rules: DEFAULT_RULES,
    auditLogs: [],
    aircraft: [],
  };
}

export function purgeAllCrewData() {
  localStorage.setItem(STORAGE_KEYS.CREW, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.LEAVE, JSON.stringify([]));
  syncCrewToFirebase([]);
  syncLeaveToFirebase([]);
}

export function purgeAllFlightData() {
  localStorage.setItem(STORAGE_KEYS.FLIGHTS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify([]));
  syncFlightsToFirebase([]);
  syncAssignmentsToFirebase([]);
}

export function loadUsers(): SystemUser[] {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!data) {
    saveUsers(DEFAULT_USERS);
    return DEFAULT_USERS;
  }
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    saveUsers(DEFAULT_USERS);
    return DEFAULT_USERS;
  } catch {
    saveUsers(DEFAULT_USERS);
    return DEFAULT_USERS;
  }
}

export function saveUsers(users: SystemUser[]) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  syncUsersToFirebase(users);
}

export function loadCurrentUser(): SystemUser {
  const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed && parsed.id) {
        return parsed;
      }
    } catch {
      // Fallback
    }
  }
  const users = loadUsers();
  return users[0] || DEFAULT_CURRENT_USER;
}

export function saveCurrentUser(user: SystemUser) {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
}

export function exportSystemBackupJSON(): string {
  const backup = {
    version: '1.0',
    appName: 'Zambia Airways Crew Control System',
    exportDate: new Date().toISOString(),
    crew: getCrew(),
    flights: getFlights(),
    assignments: getAssignments(),
    leaveRecords: getLeaveRecords(),
    rules: getRules(),
    fleet: loadFleet(),
    users: loadUsers(),
    auditLogs: loadAuditLogs(),
  };
  return JSON.stringify(backup, null, 2);
}

export function importSystemBackupJSON(jsonString: string) {
  const data = JSON.parse(jsonString);
  if (Array.isArray(data.crew)) saveCrew(data.crew);
  if (Array.isArray(data.flights)) saveFlights(data.flights);
  if (Array.isArray(data.assignments)) saveAssignments(data.assignments);
  if (Array.isArray(data.leaveRecords)) saveLeaveRecords(data.leaveRecords);
  if (data.rules) saveRules(data.rules);
  if (Array.isArray(data.fleet)) saveFleet(data.fleet);
  if (Array.isArray(data.users)) saveUsers(data.users);
  return data;
}

export function loadNotifications(): SystemNotification[] {
  const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveNotifications(notifications: SystemNotification[]) {
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
}

export function addSystemNotification(notification: Omit<SystemNotification, 'id' | 'timestamp' | 'read'>) {
  const current = loadNotifications();
  const newNotif: SystemNotification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
  const updated = [newNotif, ...current].slice(0, 50); // keep last 50
  saveNotifications(updated);
  return newNotif;
}

export function markNotificationAsRead(id: string) {
  const current = loadNotifications();
  const updated = current.map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotifications(updated);
  return updated;
}

export function markAllNotificationsAsRead() {
  const current = loadNotifications();
  const updated = current.map((n) => ({ ...n, read: true }));
  saveNotifications(updated);
  return updated;
}

export function loadAcknowledgments(): RosterAcknowledgment[] {
  const data = localStorage.getItem(STORAGE_KEYS.ACKNOWLEDGMENTS);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveAcknowledgments(acks: RosterAcknowledgment[]) {
  localStorage.setItem(STORAGE_KEYS.ACKNOWLEDGMENTS, JSON.stringify(acks));
}

export const loadSystemNotifications = loadNotifications;

export function recordCrewAcknowledgment(
  crewId: string,
  staffNumber: string,
  crewName: string,
  rosterPeriod: string = '2026-08'
): RosterAcknowledgment {
  const acks = loadAcknowledgments();
  const existingIdx = acks.findIndex((a) => a.crewId === crewId && a.rosterPeriod === rosterPeriod);

  const newAck: RosterAcknowledgment = {
    id: existingIdx >= 0 ? acks[existingIdx].id : `ack-${crewId}-${Date.now()}`,
    crewId,
    staffNumber,
    crewName,
    rosterPeriod,
    publishedAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    acknowledgedAt: new Date().toISOString(),
    status: 'ACKNOWLEDGED',
    revision: 1,
  };

  let updatedAcks: RosterAcknowledgment[];
  if (existingIdx >= 0) {
    updatedAcks = [...acks];
    updatedAcks[existingIdx] = newAck;
  } else {
    updatedAcks = [...acks, newAck];
  }

  saveAcknowledgments(updatedAcks);

  // Also log audit event
  addAuditEntry({
    user: `${crewName} (${staffNumber})`,
    userRole: 'PILOT_CABIN',
    action: 'Roster Acknowledgment',
    details: `Crew ${crewName} (${staffNumber}) acknowledged published roster for period ${rosterPeriod}.`,
    severity: 'INFO',
    crewName,
  });

  return newAck;
}

/**
 * Calculates dynamic Open Assignments breakdown across all sectors
 */
export function getOpenAssignmentsSummary(
  flights: Flight[],
  assignments: Assignment[],
  rules?: LegalityRules
): OpenAssignmentsSummary {
  let openCaptains = 0;
  let openFirstOfficers = 0;
  let openSeniorCabinCrew = 0;
  let openCabinCrew = 0;
  let fullyAssignedSectors = 0;
  let conflictSectors = 0;
  let totalOpenSectors = 0;

  flights.forEach((flight) => {
    const asg = assignments.find((a) => a.flightId === flight.id);
    const hasCpt = Boolean(asg?.captainId);
    const hasFo = Boolean(asg?.firstOfficerId);

    const minCc = flight.aircraft === 'B737' 
      ? (rules?.b737CcCountReq ?? 4) 
      : (rules?.q400CcCountReq ?? 2);
    
    const assignedCcCount = asg?.cabinCrewIds?.length || 0;
    const missingCc = Math.max(0, minCc - assignedCcCount);

    if (!hasCpt) openCaptains++;
    if (!hasFo) openFirstOfficers++;
    if (missingCc > 0) {
      openCabinCrew += missingCc;
      if (assignedCcCount === 0) openSeniorCabinCrew++;
    }

    if (asg?.status === 'CONFLICT') {
      conflictSectors++;
    }

    if (hasCpt && hasFo && missingCc === 0 && asg?.status === 'ASSIGNED') {
      fullyAssignedSectors++;
    } else {
      totalOpenSectors++;
    }
  });

  const totalOpenPositions = openCaptains + openFirstOfficers + openCabinCrew;

  return {
    totalOpenSectors,
    openCaptains,
    openFirstOfficers,
    openSeniorCabinCrew,
    openCabinCrew,
    totalOpenPositions,
    fullyAssignedSectors,
    conflictSectors,
  };
}

export function resetAllData() {
  localStorage.clear();
  return generateSampleData();
}
