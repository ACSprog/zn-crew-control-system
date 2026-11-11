export type AircraftType = 'Q400' | 'B737';

export type CrewRole = 'Captain' | 'First Officer' | 'Senior Cabin Crew' | 'Cabin Crew';

export type CrewStatus = 'ACTIVE' | 'LEAVE' | 'TRAINING' | 'STANDBY' | 'INACTIVE';

export interface CrewMember {
  id: string;
  staffNumber: string; // Employee ID
  name: string;
  email?: string;
  phone?: string;
  companyEmail?: string;
  personalEmail?: string;
  mobileNumber?: string;
  whatsAppNumber?: string;
  preferredChannel?: 'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'ALL';
  whatsAppOptIn?: boolean;
  whatsAppConsentDate?: string;
  emailNotificationStatus?: 'ACTIVE' | 'BOUNCED' | 'UNSUBSCRIBED' | 'OPTED_OUT';
  notificationPreferences?: {
    whatsApp?: {
      operationalAlerts?: boolean;
      rosterChanges?: boolean;
      flightChanges?: boolean;
      disruptions?: boolean;
      rosterPublication?: boolean;
      dutyReminders?: boolean;
    };
    email?: {
      operationalAlerts?: boolean;
      rosterChanges?: boolean;
      flightChanges?: boolean;
      training?: boolean;
      generalCommunications?: boolean;
      rosterPublication?: boolean;
      leaveUpdates?: boolean;
      dutyReminders?: boolean;
    };
    inApp?: {
      allNotifications?: boolean;
      criticalOnly?: boolean;
    };
  };
  role: CrewRole;
  aircraft: AircraftType;
  qualifications?: string[]; // Multiple aircraft qualifications & endorsements (e.g. ['Q400', 'B737', 'TRI', 'TRE', 'SCC'])
  base: string;
  status: CrewStatus;
  seniority: number;
  passportNumber?: string;
  passportExpiry?: string; // YYYY-MM-DD
  passportStatus?: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  airportPassExpiry?: string; // YYYY-MM-DD
  airportPassStatus?: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  medicalExpiry: string; // YYYY-MM-DD
  medicalStatus?: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  licenseExpiry: string; // YYYY-MM-DD
  licenseStatus?: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  simExpiry?: string; // Simulator / Instrument Rating Validity (YYYY-MM-DD)
  simStatus?: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  septExpiry?: string; // Safety & Emergency Procedures Training Validity (YYYY-MM-DD)
  septStatus?: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  crmExpiry?: string; // Crew Resource Management Validity (YYYY-MM-DD)
  crmStatus?: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  dgrExpiry?: string; // Dangerous Goods Regulations Validity (YYYY-MM-DD)
  dgrStatus?: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  typeRating: string;
  trainingStatus: 'VALID' | 'DUE_SOON' | 'EXPIRED';
  lineCheck: string; // YYYY-MM-DD
  weeklyBlockHours?: number; // Weekly block hours (default cap 30h)
  monthlyBlockHours: number; // Monthly block hours (default cap 100h)
  annualBlockHours?: number; // Annual block hours (default cap 1,000h)
  monthlyDutyHours: number;
  daysOff: number;
  dob?: string;
  nationality?: string;
  dateJoined?: string;
  employmentStatus?: 'PERMANENT' | 'CONTRACT' | 'TEMPORARY';
  emergencyContact?: string;
  notes: string;
  nightDuties?: number;
  dutiesCount?: number;
  flightsCount?: number;
  /** Manually recorded landings (e.g. simulator / non-rostered sectors) for recency. */
  recencyManualLandings?: number;
  /** Date (YYYY-MM-DD) the manual landings above were made; they count for 90 days from it. */
  recencyManualDate?: string;
}

export interface AircraftFleet {
  aircraft: AircraftType;
  registration: string;
  status: 'SERVICEABLE' | 'MAINTENANCE' | 'AOG';
  location?: string;
  activeCount?: number;
}

export type FlightStatus = 'SCHEDULED' | 'BOARDING' | 'IN-FLIGHT' | 'COMPLETED' | 'CANCELLED' | 'DELAYED' | 'AOG';

export interface Flight {
  id: string;
  flightNumber: string; // e.g. ZN101
  date: string; // YYYY-MM-DD
  aircraft: AircraftType;
  registration: string; // e.g. 9J-ZQA
  departure: string; // e.g. LUN
  arrival: string; // e.g. NLA
  std: string; // HH:mm (Scheduled Time of Departure)
  sta: string; // HH:mm (Scheduled Time of Arrival)
  atd?: string; // Actual Time of Departure
  ata?: string; // Actual Time of Arrival
  delayMinutes?: number;
  delayReason?: string;
  blockHours: number; // e.g. 1.5
  dutyHours?: number; // e.g. 3.0
  status: FlightStatus;
  remarks?: string;
}

export type DutyCode =
  | 'FLT'
  | 'STBY'
  | 'SBH'
  | 'RES'
  | 'OFC'
  | 'TRNG'
  | 'VAC'
  | 'SCK'
  | 'GDO'
  | 'DH'
  | 'SIM'
  | 'CHK';

export interface Assignment {
  id: string;
  flightId: string;
  dutyCode?: DutyCode;
  captainId?: string;
  firstOfficerId?: string;
  cabinCrewIds?: string[];
  assignedAt: string;
  status: 'ASSIGNED' | 'OPEN' | 'CONFLICT';
  notes?: string;
  reportTime?: string; // STD - 01:00
  dutyEndTime?: string; // STA + 00:30
  published?: boolean;
  publishedAt?: string;
  revision?: number;
  isAmended?: boolean;
  amendedReason?: string;
  amendedBy?: string;
  amendedAt?: string;
  acknowledgedCrewIds?: string[];
}

export type LeaveTrainingType =
  | 'Annual Leave'
  | 'Sick'
  | 'Simulator'
  | 'Training'
  | 'Line Check'
  | 'Medical'
  | 'Recurrent Training'
  | 'Standby'
  | 'Rest Day'
  | 'Unavailable';

export interface LeaveTrainingRecord {
  id: string;
  crewId: string;
  crewName?: string;
  /** Crew member's sign-in email (lower case), so they can read only their own records. */
  crewEmail?: string;
  type: LeaveTrainingType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  description: string;
  approved: boolean;
}

export interface RecencyRecord {
  id: string;
  crewId: string;
  crewName: string;
  staffNumber: string;
  aircraft: AircraftType;
  lastFlightNumber: string;
  lastSector: string;
  lastFlightDate: string; // YYYY-MM-DD
  takeoffs90Days: number;
  landings90Days: number;
  recencyWindowDays: number; // default 90
  daysRemaining: number;
  status: 'CURRENT' | 'EXPIRING' | 'NOT_CURRENT';
}

export interface LineCheckRecord {
  id: string;
  crewId: string;
  crewName: string;
  aircraft: AircraftType;
  role: CrewRole;
  lastLineCheckDate: string;
  nextDueLineCheckDate: string;
  daysRemaining: number;
  status: 'CURRENT' | 'DUE_SOON' | 'DUE' | 'OVERDUE';
  examinerName?: string;
  remarks?: string;
}

export interface DocumentRecord {
  id: string;
  crewId: string;
  crewName: string;
  staffNumber: string;
  documentType:
    | 'Passport'
    | 'Airport Pass'
    | 'Medical'
    | 'License'
    | 'Simulator / IR'
    | 'SEPT'
    | 'CRM'
    | 'Dangerous Goods (DGR)';
  documentNumber?: string;
  expiryDate: string;
  daysRemaining: number;
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
}

export interface TrainingRecord {
  id: string;
  crewId: string;
  crewName: string;
  type: 'Simulator' | 'Recurrent Training' | 'Line Check' | 'Safety Training' | 'CRM' | 'Dangerous Goods' | 'SEP' | 'Other';
  trainingDate: string;
  expiryDate: string;
  daysRemaining: number;
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  instructor?: string;
}

export interface LegalityRules {
  minRestHours: number; // default 10 (min 10h rest between duties)
  maxDutyHours: number; // default 12 (max single duty period 12h)
  maxWeeklyBlockHours: number; // default 30 (Weekly limit 30h)
  maxMonthlyBlockHours: number; // default 100 (Monthly limit 100h)
  maxAnnualBlockHours: number; // default 1000 (Annual limit 1,000h)
  maxConsecutiveDuties: number; // default 6
  minRolling7DayRestHours: number; // default 24 (min 24h continuous rest in any rolling 7-day period)
  maxLandingsPerDuty: number; // default 5 (max 5 landings per duty period)
  maxGroundTimeBetweenSectorsHours: number; // default 2.0 (ground time between sectors < 2h for linked duties)
  maxMonthlyDutyHours: number; // default 180
  minDaysOff: number; // default 8
  nightDutyLimit: number; // default 10
  recencyWindowDays: number; // default 90
  recencyMinLandings: number; // default 3
  docWarnDays90: number;
  docWarnDays60: number;
  docWarnDays30: number;
  docWarnDays7: number;
  q400CaptainCountReq: number; // default 1
  q400FoCountReq: number; // default 1
  q400CcCountReq: number; // default 2 (min 2 Cabin Crew for Q400)
  q400SccCountReq: number; // default 1 (min 1 Senior Cabin Crew for Q400)
  b737CaptainCountReq: number; // default 1
  b737FoCountReq: number; // default 1
  b737CcCountReq: number; // default 4 (min 4 Cabin Crew for B737)
  b737SccCountReq: number; // default 1 (min 1 Senior Cabin Crew for B737)
}

export interface AuditLog {
  id: string;
  user: string;
  userRole?: string;
  date: string;
  time: string;
  action?: string;
  details?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  flightNumber?: string;
  crewName?: string;
  previousAssignment?: string;
  newAssignment?: string;
  reason?: string;
  immutableSeal?: string;
  previousSeal?: string;
  /** Full ISO timestamp the seal was computed over (seal v2+). */
  timestamp?: string;
  /** 2 = SHA-256 seal that can be re-verified. Older entries have no version. */
  sealVersion?: number;
  ipAddress?: string;
  verifiedIntegrity?: boolean;
}

export interface ConflictCheckResult {
  crewId: string;
  crewName: string;
  flightId: string;
  flightNumber: string;
  aircraft: AircraftType;
  qualificationPass: boolean;
  availabilityPass: boolean;
  leavePass: boolean;
  restPass: boolean;
  blockHoursPass: boolean;
  overlapPass: boolean;
  docValidityPass: boolean;
  recencyPass: boolean;
  lineCheckPass: boolean;
  previousRelease: string;
  nextReport: string;
  requiredRest: number;
  availableRest: number;
  overallResult: 'PASS' | 'FAIL';
  failReasons: string[];
}

export interface CriticalLegalityConflict {
  id: string;
  flightId: string;
  flightNumber: string;
  flightDate: string;
  aircraft: AircraftType;
  departure: string;
  arrival: string;
  std: string;
  sta: string;
  crewId: string;
  crewName: string;
  staffNumber?: string;
  role: CrewRole;
  conflictType:
    | 'REST_VIOLATION'
    | 'LICENSE_EXPIRED'
    | 'MEDICAL_EXPIRED'
    | 'OVERLAP'
    | 'FTL_EXCEEDED'
    | 'LEAVE_CONFLICT'
    | 'QUALIFICATION_MISMATCH'
    | 'CONSECUTIVE_DAYS'
    | 'MANUAL_CONFLICT';
  severity: 'CRITICAL' | 'WARNING';
  description: string;
  failReasons: string[];
}

export interface RosterLegalityScanResult {
  totalChecked: number;
  totalAssignments: number;
  criticalConflictCount: number;
  warningCount: number;
  conflicts: CriticalLegalityConflict[];
  hasCriticalConflict: boolean;
  summaryText: string;
}

export interface LegacyMacroMapping {
  id: string;
  excelMacro: string;
  purpose: string;
  convertedFunction: string;
  status: 'CONVERTED' | 'ACTIVE';
  codeSnippet?: string;
}

export interface RosterOptimizationOptions {
  legalCompliance: boolean;
  crewHourBalance: boolean;
  minPositioning: boolean;
  minStandby: boolean;
  baseCompatibility: boolean;
  minChanges: boolean;
}

export interface RosterOptimizationResult {
  currentScore: number;
  optimizedScore: number;
  changesCount: number;
  affectedFlights: number;
  affectedCrew: number;
  proposedAssignments: Assignment[];
  logs: string[];
}

export type SystemUserRole =
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'OCC_CONTROLLER'
  | 'SCHEDULER'
  | 'CHIEF_PILOT'
  | 'PILOT_CABIN'
  | 'FLIGHT_CREW'
  | 'AUDITOR';

export interface SystemUserPermissions {
  canEditRoster: boolean;
  canGenerateRoster: boolean;
  canManageCrew: boolean;
  canEditSettings: boolean;
  canResetData: boolean;
  canOverrideLegality: boolean;
  canManageUsers: boolean;
  canExportAudit: boolean;
  canApproveRosterEdits?: boolean;
  canViewFullPii?: boolean;
  canManageSecurity?: boolean;
}

export interface SystemUser {
  id: string;
  staffNumber: string;
  name: string;
  email: string;
  password?: string;
  role: SystemUserRole;
  department: string;
  base: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  avatarInitials: string;
  lastLogin?: string;
  permissions: SystemUserPermissions;
  mfaEnabled?: boolean;
  mfaMethod?: 'APP_AUTHENTICATOR' | 'COMPANY_SSO' | 'SMS_OTP';
  token?: string;
  sessionExpiresAt?: string;
  lastIpAddress?: string;
}

export type ActiveView =
  | 'dashboard'
  | 'notifications'
  | 'crew'
  | 'flights'
  | 'q400'
  | 'b737'
  | 'scheduling'
  | 'scheduler'
  | 'calendar'
  | 'portal'
  | 'crewportal'
  | 'crewhours'
  | 'fatigue'
  | 'recency'
  | 'linechecks'
  | 'documents'
  | 'leave'
  | 'training'
  | 'reports'
  | 'assistant'
  | 'settings'
  | 'audit'
  | 'legacy'
  | 'guide'
  | 'users';

export * from './types/notifications';

export interface RosterAcknowledgment {
  id: string;
  crewId: string;
  staffNumber: string;
  crewName: string;
  /** Crew member's sign-in email (lower case); used by security rules. */
  crewEmail?: string;
  rosterPeriod: string; // e.g. "2026-08"
  publishedAt: string;
  acknowledgedAt?: string;
  status: 'ACKNOWLEDGED' | 'PENDING_ACK';
  revision: number;
  ipAddress?: string;
  notes?: string;
}

export interface SystemNotification {
  id: string;
  targetCrewId?: string; // Specific crew member or undefined for broadcast
  targetRole?: CrewRole | SystemUserRole;
  type: 'ROSTER_PUBLISHED' | 'ROSTER_AMENDED' | 'REASSIGNMENT' | 'STBY_ASSIGNED' | 'TRNG_ASSIGNED' | 'EXPIRY_WARNING';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  flightNumber?: string;
  dutyCode?: DutyCode;
  revision?: number;
}

export interface OpenAssignmentsSummary {
  totalOpenSectors: number;
  openCaptains: number;
  openFirstOfficers: number;
  openSeniorCabinCrew: number;
  openCabinCrew: number;
  totalOpenPositions: number;
  fullyAssignedSectors: number;
  conflictSectors: number;
}

export interface PreGenerationCrewCheck {
  crewId: string;
  staffNumber: string;
  name: string;
  role: CrewRole;
  aircraft: AircraftType;
  qualifications: string[];
  licenseValid: boolean;
  medicalValid: boolean;
  simValid: boolean;
  septValid: boolean;
  crmValid: boolean;
  dgrValid: boolean;
  recencyValid: boolean;
  lineCheckValid: boolean;
  hasLeaveOverlap: boolean;
  weeklyHoursLeft: number;
  monthlyHoursLeft: number;
  overallEligible: boolean;
  issues: string[];
}

export interface PreGenerationValidationReport {
  timestamp: string;
  totalCrewChecked: number;
  eligibleCrewCount: number;
  ineligibleCrewCount: number;
  totalFlightsToSchedule: number;
  crewChecks: PreGenerationCrewCheck[];
  hardViolations: string[];
  warnings: string[];
  readyToGenerate: boolean;
}

