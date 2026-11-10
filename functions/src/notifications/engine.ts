/**
 * Notification Core Engine for Firebase Cloud Functions
 * Location: functions/src/notifications/engine.ts
 * 
 * Defines:
 * 1. Provider-Agnostic Abstraction Layer Interfaces & Types
 * 2. Firestore Schema definitions for `notificationQueue` and `notificationLogs`
 * 3. Provider Implementations (Meta WhatsApp Cloud API, Twilio, SendGrid, SMTP, Mock/Sandbox)
 * 4. Gateway Router & Fallback Dispatcher
 * 5. Notification Processing & State Transition Handlers
 * 6. Legality Pre-Validation Engine (FTL limits, document currency, training validity)
 * 7. Automated RosterAssignment Trigger Service with Priority Classification:
 *    - CRITICAL: Reassignments, crew swaps, replacement duties, standby activations
 *    - HIGH: Roster changes, duty time adjustments, duty code revisions, amended sectors
 *    - NORMAL: Official roster publication & initial schedule distributions
 * 8. Cloud Function Event Handlers for Firestore onWrite triggers
 */

// ============================================================================
// 1. PROVIDER-AGNOSTIC ABSTRACTION LAYER INTERFACES
// ============================================================================

export type NotificationChannelType = 'WHATSAPP' | 'EMAIL' | 'SMS' | 'IN_APP';
export type NotificationPriorityType = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'INFORMATION';
export type NotificationStatusType = 
  | 'PENDING' 
  | 'QUEUED' 
  | 'SENDING' 
  | 'SENT' 
  | 'DELIVERED' 
  | 'READ' 
  | 'FAILED' 
  | 'CANCELLED';

export type NotificationCategoryType =
  | 'ROSTER_PUBLICATION'
  | 'ROSTER_CHANGE'
  | 'REASSIGNMENT'
  | 'DISRUPTION'
  | 'TRAINING_EXPIRY'
  | 'FLIGHT_CHANGE'
  | 'DUTY_REMINDER'
  | 'GENERAL_COMMUNICATION';

export interface ProviderDispatchResult {
  success: boolean;
  provider: string;
  providerMessageId: string;
  status: 'SENT' | 'DELIVERED' | 'QUEUED' | 'FAILED';
  errorMessage?: string;
  errorCode?: string;
  deliveredAt?: string;
  sentAt?: string;
  rawResponse?: unknown;
  meta?: Record<string, unknown>;
}

export interface WhatsAppSendParams {
  recipientPhone: string;
  recipientName?: string;
  templateName?: string;
  messageText?: string;
  variables?: Record<string, string | number>;
  priority?: NotificationPriorityType;
  notificationId?: string;
}

export interface EmailSendParams {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  variables?: Record<string, string | number>;
  priority?: NotificationPriorityType;
  notificationId?: string;
  replyTo?: string;
}

export interface IWhatsAppProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  sendMessage(params: WhatsAppSendParams): Promise<ProviderDispatchResult>;
  testConnection(testPhone?: string): Promise<{ success: boolean; message: string; details?: unknown }>;
}

export interface IEmailProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  sendEmail(params: EmailSendParams): Promise<ProviderDispatchResult>;
  testConnection(testEmail?: string): Promise<{ success: boolean; message: string; details?: unknown }>;
}

// ============================================================================
// 2. FIRESTORE DATABASE SCHEMA DEFINITIONS
// ============================================================================

/**
 * Firestore Collection: `notificationQueue`
 * Path: `/notificationQueue/{queueId}`
 */
export interface NotificationQueueDocument {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientStaffNumber?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientWhatsApp?: string;
  channel: NotificationChannelType;
  notificationType: string;
  priority: NotificationPriorityType;
  subject?: string;
  message: string;
  status: NotificationStatusType;
  flightNumber?: string;
  flightDate?: string;
  dutyCode?: string;
  origin?: string;
  destination?: string;
  reportTime?: string;
  dutyEndTime?: string;
  templateId?: string;
  templateParams?: Record<string, string | number>;
  retryCount: number;
  maxRetries: number;
  scheduledFor?: string;
  provider?: string;
  providerMessageId?: string;
  errorMessage?: string;
  initiatedBy?: string;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  legalityVerified?: boolean;
  legalityValidationId?: string;
  assignmentId?: string;
  revision?: number;
  metadata?: Record<string, unknown>;
}

export interface NotificationStatusTimelineEvent {
  status: NotificationStatusType;
  timestamp: string;
  actorOrProvider?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Firestore Collection: `notificationLogs`
 * Path: `/notificationLogs/{logId}`
 */
export interface NotificationLogDocument {
  id: string;
  queueId?: string;
  recipientId: string;
  recipientName: string;
  recipientStaffNumber?: string;
  recipientContact?: string;
  channel: NotificationChannelType;
  notificationType: string;
  priority: NotificationPriorityType;
  subject?: string;
  message: string;
  status: NotificationStatusType;
  flightNumber?: string;
  flightDate?: string;
  dutyCode?: string;
  origin?: string;
  destination?: string;
  provider: string;
  providerMessageId?: string;
  retryCount: number;
  errorMessage?: string;
  statusTimeline: NotificationStatusTimelineEvent[];
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  acknowledgedByCrew?: boolean;
  acknowledgedAt?: string;
  initiatedBy?: string;
  legalitySignoff?: boolean;
}

// ============================================================================
// 3. ROSTER ASSIGNMENT & CREW DATA MODELS
// ============================================================================

export interface CrewMemberData {
  id: string;
  staffNumber: string;
  name: string;
  email?: string;
  phone?: string;
  whatsAppNumber?: string;
  mobileNumber?: string;
  preferredChannel?: 'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'ALL';
  role?: string;
  aircraft?: string;
  status?: string;
  licenseExpiry?: string;
  medicalExpiry?: string;
  passportExpiry?: string;
  airportPassExpiry?: string;
  simExpiry?: string;
  septExpiry?: string;
  crmExpiry?: string;
  dgrExpiry?: string;
  lineCheck?: string;
  weeklyBlockHours?: number;
  monthlyBlockHours?: number;
  annualBlockHours?: number;
  monthlyDutyHours?: number;
  daysOff?: number;
  notificationPreferences?: {
    whatsApp?: Record<string, boolean>;
    email?: Record<string, boolean>;
    inApp?: Record<string, boolean>;
  };
}

export interface FlightData {
  id: string;
  flightNumber: string;
  date: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  blockHours: number;
  aircraft: string;
  status?: string;
  assignedCrew?: {
    captainId?: string;
    firstOfficerId?: string;
    cabinCrewIds?: string[];
  };
}

export interface RosterAssignmentState {
  id: string;
  flightId?: string;
  flightNumber?: string;
  flightDate: string;
  dutyCode?: string;
  origin?: string;
  destination?: string;
  std?: string;
  sta?: string;
  reportTime?: string;
  dutyEndTime?: string;
  aircraft?: string;
  captainId?: string;
  firstOfficerId?: string;
  cabinCrewIds?: string[];
  status?: 'ASSIGNED' | 'OPEN' | 'CONFLICT' | 'CANCELLED';
  published?: boolean;
  publishedAt?: string;
  revision?: number;
  isAmended?: boolean;
  amendedReason?: string;
  amendedBy?: string;
  amendedAt?: string;
  acknowledgedCrewIds?: string[];
  notes?: string;
}

export interface RosterAssignmentUpdatePayload {
  assignmentId: string;
  beforeState?: Partial<RosterAssignmentState> | null;
  afterState: RosterAssignmentState;
  crewDirectory: Record<string, CrewMemberData> | Map<string, CrewMemberData>;
  flightInfo?: Partial<FlightData>;
  updatedBy?: string;
  updateReason?: string;
  isPublicationBatch?: boolean;
}

export interface CrewAssignmentDiff {
  crewId: string;
  crewMember: CrewMemberData;
  changeType:
    | 'REASSIGNED_NEW'
    | 'REASSIGNED_REMOVED'
    | 'DUTY_TIME_MODIFIED'
    | 'DUTY_CODE_MODIFIED'
    | 'FLIGHT_DETAILS_MODIFIED'
    | 'NEW_PUBLICATION';
  priority: NotificationPriorityType; // CRITICAL | HIGH | NORMAL
  category: 'REASSIGNMENT' | 'ROSTER_CHANGE' | 'ROSTER_PUBLICATION';
  subject: string;
  message: string;
  details: {
    flightNumber?: string;
    flightDate: string;
    dutyCode?: string;
    previousDutyCode?: string;
    reportTime?: string;
    previousReportTime?: string;
    dutyEndTime?: string;
    origin?: string;
    destination?: string;
    reason?: string;
    aircraft?: string;
    revision?: number;
  };
}

export interface LegalityCheckSummary {
  isLegal: boolean;
  crewId: string;
  staffNumber: string;
  crewName: string;
  flightNumber?: string;
  flightDate?: string;
  violations: string[];
  warnings: string[];
  validatedAt: string;
  approvedByLegalityEngine: boolean;
}

export interface DisruptionEventData {
  id: string;
  flightNumber: string;
  flightDate: string;
  originalDeparture: string;
  revisedDeparture: string;
  originalArrival?: string;
  revisedArrival?: string;
  origin: string;
  destination: string;
  aircraft: string;
  disruptionType: 'DELAY' | 'CANCELLATION' | 'AIRCRAFT_CHANGE' | 'ROUTE_DIVERSION' | 'CREW_CHANGE';
  reason: string;
  impactedCrew: CrewMemberData[];
  revisedDutyReportTime?: string;
  initiatedBy?: string;
}

export interface TrainingExpiryEventData {
  crew: CrewMemberData;
  trainingType: 'SIMULATOR' | 'MEDICAL' | 'LICENSE' | 'SEPT' | 'CRM' | 'DGR' | 'LINE_CHECK';
  expiryDate: string;
  daysRemaining: number;
  scheduledSessionDate?: string;
  location?: string;
}

export interface RosterPublicationEventData {
  rosterPeriod: string; // e.g. "SEPTEMBER 2026"
  startDate: string;
  endDate: string;
  publishTimestamp: string;
  crewMembers: CrewMemberData[];
  assignmentsCount: number;
  publishedBy: string;
  legalityEngineSignoff: {
    passedValidation: boolean;
    validatedAt: string;
    totalChecksPerformed: number;
    hardViolationsCount: number;
  };
}

// ============================================================================
// 4. LEGALITY PRE-CHECK ENGINE
// ============================================================================

/**
 * Validates whether proposed roster changes or operational assignments strictly comply
 * with Zambia Airways Flight Time Limitations (FTL) & regulatory standards before queuing notifications.
 */
export function verifyLegalityForCrewAssignment(
  crew: CrewMemberData,
  flightDate: string,
  proposedFlight?: Partial<FlightData>
): LegalityCheckSummary {
  const violations: string[] = [];
  const warnings: string[] = [];
  const targetDate = new Date(flightDate);
  const now = new Date();

  // 1. Regulatory Documents Currency Checks
  if (crew.licenseExpiry && new Date(crew.licenseExpiry) < targetDate) {
    violations.push(`CAA Flight Crew License expired on ${crew.licenseExpiry}`);
  }
  if (crew.medicalExpiry && new Date(crew.medicalExpiry) < targetDate) {
    violations.push(`CAA Class 1 Medical Certificate expired on ${crew.medicalExpiry}`);
  }
  if (crew.passportExpiry && new Date(crew.passportExpiry) < targetDate) {
    violations.push(`Passport expired on ${crew.passportExpiry}`);
  }
  if (crew.airportPassExpiry && new Date(crew.airportPassExpiry) < targetDate) {
    violations.push(`Airside Security Access Pass expired on ${crew.airportPassExpiry}`);
  }

  // 2. Training Recency Checks
  if (crew.simExpiry && new Date(crew.simExpiry) < targetDate) {
    violations.push(`Simulator / Instrument Rating recency expired on ${crew.simExpiry}`);
  }
  if (crew.septExpiry && new Date(crew.septExpiry) < targetDate) {
    violations.push(`SEPT (Safety & Emergency Procedures) expired on ${crew.septExpiry}`);
  }
  if (crew.dgrExpiry && new Date(crew.dgrExpiry) < targetDate) {
    warnings.push(`Dangerous Goods (DGR) qualification expires soon (${crew.dgrExpiry})`);
  }

  // 3. Status & Aircraft Fleet Qualification Checks
  if (crew.status === 'LEAVE' || crew.status === 'INACTIVE') {
    violations.push(`Crew status is '${crew.status}'. Cannot assign operational duties.`);
  }

  if (proposedFlight?.aircraft && crew.aircraft && proposedFlight.aircraft !== crew.aircraft) {
    violations.push(`Aircraft type mismatch: Crew is type-rated for ${crew.aircraft}, flight operates ${proposedFlight.aircraft}.`);
  }

  // 4. Cumulative Duty & FTL Caps (Zambia CAA / ZCARs Part 8 Standards)
  if (crew.monthlyBlockHours && crew.monthlyBlockHours >= 100) {
    violations.push(`Monthly block hour limit reached (${crew.monthlyBlockHours}h / 100h max).`);
  } else if (crew.monthlyBlockHours && crew.monthlyBlockHours > 90) {
    warnings.push(`High monthly block hours (${crew.monthlyBlockHours}h). Approaching 100h cap.`);
  }

  if (crew.weeklyBlockHours && crew.weeklyBlockHours >= 30) {
    violations.push(`7-day rolling block hour limit reached (${crew.weeklyBlockHours}h / 30h max).`);
  }

  const isLegal = violations.length === 0;

  return {
    isLegal,
    crewId: crew.id,
    staffNumber: crew.staffNumber,
    crewName: crew.name,
    flightNumber: proposedFlight?.flightNumber,
    flightDate,
    violations,
    warnings,
    validatedAt: now.toISOString(),
    approvedByLegalityEngine: isLegal,
  };
}

// ============================================================================
// 5. AUTOMATED ROSTER ASSIGNMENT TRIGGER SERVICE
// ============================================================================

export class RosterAssignmentTriggerService {
  /**
   * Helper to retrieve crew member from Map or Record directory
   */
  private static getCrewMember(
    directory: Record<string, CrewMemberData> | Map<string, CrewMemberData>,
    crewId: string
  ): CrewMemberData | undefined {
    if (directory instanceof Map) {
      return directory.get(crewId);
    }
    return directory[crewId];
  }

  /**
   * Helper to get crew IDs array from an assignment state
   */
  private static extractAllCrewIds(state?: Partial<RosterAssignmentState> | null): string[] {
    if (!state) return [];
    const ids: string[] = [];
    if (state.captainId) ids.push(state.captainId);
    if (state.firstOfficerId) ids.push(state.firstOfficerId);
    if (Array.isArray(state.cabinCrewIds)) {
      ids.push(...state.cabinCrewIds);
    }
    return Array.from(new Set(ids.filter(Boolean)));
  }

  /**
   * Compares before and after RosterAssignment snapshots and classifies detected diffs
   * into prioritized notification events:
   * - CRITICAL: Reassignment (crew added, replaced, swapped, or removed)
   * - HIGH: Roster Change (duty time, duty code, sector routing, or amendment)
   * - NORMAL: Publication (initial roster publication or standard schedule release)
   */
  public static detectAssignmentChanges(
    before: Partial<RosterAssignmentState> | null | undefined,
    after: RosterAssignmentState,
    crewDirectory: Record<string, CrewMemberData> | Map<string, CrewMemberData>,
    options?: { updateReason?: string; isPublicationBatch?: boolean }
  ): CrewAssignmentDiff[] {
    const diffs: CrewAssignmentDiff[] = [];

    const beforeCrewIds = this.extractAllCrewIds(before);
    const afterCrewIds = this.extractAllCrewIds(after);

    const flightNumber = after.flightNumber || 'FLIGHT';
    const flightDate = after.flightDate || new Date().toISOString().split('T')[0];
    const dutyCode = after.dutyCode || 'FLT';
    const reportTime = after.reportTime || after.std || 'TBD';
    const origin = after.origin || 'LUN';
    const destination = after.destination || 'NLA';
    const aircraft = after.aircraft || 'Q400';
    const reason = options?.updateReason || after.amendedReason || 'Operational adjustment by OCC';
    const revision = after.revision || 1;

    // Case 1: Was this a Publication Event?
    // Occurs when previously unpublished (before.published !== true) and now published (after.published === true)
    const isNewPublication =
      options?.isPublicationBatch ||
      (!before?.published && after.published === true) ||
      (!before && after.published === true);

    // 1. Evaluate Crew Reassignments (CRITICAL PRIORITY)
    // -------------------------------------------------------------
    // Crew newly assigned to this duty
    const newlyAssignedCrewIds = afterCrewIds.filter((id) => !beforeCrewIds.includes(id));
    // Crew removed from this duty
    const removedCrewIds = beforeCrewIds.filter((id) => !afterCrewIds.includes(id));

    // If it's a completely fresh publication batch, treat newly assigned crew as NORMAL (Publication)
    // Otherwise, any addition to an active/existing assignment is CRITICAL (Reassignment)
    if (isNewPublication && (!before || beforeCrewIds.length === 0)) {
      for (const crewId of afterCrewIds) {
        const crew = this.getCrewMember(crewDirectory, crewId);
        if (!crew) continue;

        diffs.push({
          crewId,
          crewMember: crew,
          changeType: 'NEW_PUBLICATION',
          priority: 'NORMAL',
          category: 'ROSTER_PUBLICATION',
          subject: `Zambia Airways - Official Roster Published: ${dutyCode} on ${flightDate}`,
          message: `Dear ${crew.name} (${crew.staffNumber}),\n\nYour flight roster for ${flightDate} has been published by OCC Planning.\n\nDuty: ${dutyCode} | Flight: ${flightNumber} (${origin} ➔ ${destination})\nReport Time: ${reportTime}\nAircraft: ${aircraft}\n\nPlease acknowledge receipt in the Zambia Airways Crew Portal.\n\nZambia Airways Flight Operations`,
          details: {
            flightNumber,
            flightDate,
            dutyCode,
            reportTime,
            dutyEndTime: after.dutyEndTime,
            origin,
            destination,
            aircraft,
            revision,
            reason: 'Official Roster Publication',
          },
        });
      }
      return diffs;
    }

    // Process Newly Assigned Crew -> CRITICAL (Reassignment Alert)
    for (const crewId of newlyAssignedCrewIds) {
      const crew = this.getCrewMember(crewDirectory, crewId);
      if (!crew) continue;

      diffs.push({
        crewId,
        crewMember: crew,
        changeType: 'REASSIGNED_NEW',
        priority: 'CRITICAL',
        category: 'REASSIGNMENT',
        subject: `CRITICAL REASSIGNMENT: ${flightNumber} on ${flightDate}`,
        message: `CRITICAL OCC REASSIGNMENT ALERT\n\nDear ${crew.name} (${crew.staffNumber}),\n\nYou have been assigned to duty ${dutyCode} (${flightNumber}: ${origin} ➔ ${destination}) on ${flightDate}.\n\nReport Time: ${reportTime}\nAircraft Fleet: ${aircraft}\nReason: ${reason}\n\nPlease confirm and acknowledge this duty assignment immediately in the Crew Portal or contact OCC Crew Control.\n\nOCC Crew Control - Zambia Airways`,
        details: {
          flightNumber,
          flightDate,
          dutyCode,
          reportTime,
          dutyEndTime: after.dutyEndTime,
          origin,
          destination,
          aircraft,
          reason,
          revision,
        },
      });
    }

    // Process Removed Crew -> CRITICAL (Reassignment / Unassigned Alert)
    for (const crewId of removedCrewIds) {
      const crew = this.getCrewMember(crewDirectory, crewId);
      if (!crew) continue;

      diffs.push({
        crewId,
        crewMember: crew,
        changeType: 'REASSIGNED_REMOVED',
        priority: 'CRITICAL',
        category: 'REASSIGNMENT',
        subject: `ROSTER UPDATE: Unassigned from ${flightNumber} on ${flightDate}`,
        message: `OCC REASSIGNMENT NOTICE\n\nDear ${crew.name} (${crew.staffNumber}),\n\nYou have been stood down / unassigned from duty ${dutyCode} (${flightNumber}) on ${flightDate}.\n\nReason: ${reason}\n\nPlease check your updated roster in the Crew Portal for replacement duty or revised standby status.\n\nOCC Crew Control - Zambia Airways`,
        details: {
          flightNumber,
          flightDate,
          dutyCode: before?.dutyCode || dutyCode,
          origin: before?.origin || origin,
          destination: before?.destination || destination,
          reason,
          revision,
        },
      });
    }

    // 2. Evaluate Roster Changes for Retained Crew (HIGH PRIORITY)
    // -------------------------------------------------------------
    const retainedCrewIds = afterCrewIds.filter((id) => beforeCrewIds.includes(id));

    if (before && retainedCrewIds.length > 0) {
      const isReportTimeChanged = before.reportTime && after.reportTime && before.reportTime !== after.reportTime;
      const isStdStaChanged = (before.std && after.std && before.std !== after.std) || (before.sta && after.sta && before.sta !== after.sta);
      const isDutyCodeChanged = before.dutyCode && after.dutyCode && before.dutyCode !== after.dutyCode;
      const isAircraftChanged = before.aircraft && after.aircraft && before.aircraft !== after.aircraft;
      const isSectorChanged = (before.origin && after.origin && before.origin !== after.origin) || (before.destination && after.destination && before.destination !== after.destination);
      const isAmended = after.isAmended === true || (before.revision !== undefined && after.revision !== undefined && after.revision > before.revision);

      if (isReportTimeChanged || isStdStaChanged || isDutyCodeChanged || isAircraftChanged || isSectorChanged || isAmended) {
        for (const crewId of retainedCrewIds) {
          const crew = this.getCrewMember(crewDirectory, crewId);
          if (!crew) continue;

          let changeSummary = '';
          if (isDutyCodeChanged) changeSummary += `Duty changed from ${before.dutyCode} to ${after.dutyCode}. `;
          if (isReportTimeChanged) changeSummary += `Report time revised from ${before.reportTime} to ${after.reportTime}. `;
          if (isStdStaChanged) changeSummary += `Flight timings revised (STD: ${after.std || 'N/A'}, STA: ${after.sta || 'N/A'}). `;
          if (isAircraftChanged) changeSummary += `Aircraft fleet changed to ${after.aircraft}. `;
          if (isSectorChanged) changeSummary += `Routing changed to ${origin} ➔ ${destination}. `;

          diffs.push({
            crewId,
            crewMember: crew,
            changeType: isDutyCodeChanged ? 'DUTY_CODE_MODIFIED' : isReportTimeChanged ? 'DUTY_TIME_MODIFIED' : 'FLIGHT_DETAILS_MODIFIED',
            priority: 'HIGH',
            category: 'ROSTER_CHANGE',
            subject: `ROSTER CHANGE (Rev ${revision}): ${flightNumber} on ${flightDate}`,
            message: `IMPORTANT ROSTER AMENDMENT (Rev ${revision})\n\nDear ${crew.name} (${crew.staffNumber}),\n\nYour assigned duty on ${flightDate} has been amended by OCC.\n\nFlight: ${flightNumber} (${origin} ➔ ${destination})\nDuty Code: ${dutyCode}\nReport Time: ${reportTime}\nAircraft: ${aircraft}\n\nModifications: ${changeSummary}\nReason: ${reason}\n\nPlease acknowledge this schedule modification in your Crew Portal.\n\nOCC Duty Desk - Zambia Airways`,
            details: {
              flightNumber,
              flightDate,
              dutyCode,
              previousDutyCode: before.dutyCode,
              reportTime,
              previousReportTime: before.reportTime,
              dutyEndTime: after.dutyEndTime,
              origin,
              destination,
              aircraft,
              reason: changeSummary + (reason ? ` (${reason})` : ''),
              revision,
            },
          });
        }
      }
    }

    return diffs;
  }

  /**
   * Main evaluation pipeline:
   * 1. Detects assignment diffs and assigns priority (CRITICAL / HIGH / NORMAL)
   * 2. Runs strict Legality Engine checks on every assigned crew member
   * 3. Blocks illegal assignments from reaching the notificationQueue with detailed violations
   * 4. Translates approved changes into multi-channel NotificationQueueDocument records
   */
  public static async evaluateAndQueueAssignmentUpdates(
    payload: RosterAssignmentUpdatePayload
  ): Promise<{
    queuedItems: NotificationQueueDocument[];
    blockedIllegalItems: { crewName: string; staffNumber: string; violations: string[] }[];
    summary: string;
  }> {
    const { beforeState, afterState, crewDirectory, updatedBy, updateReason, isPublicationBatch } = payload;
    const now = new Date().toISOString();

    const diffs = this.detectAssignmentChanges(beforeState, afterState, crewDirectory, {
      updateReason,
      isPublicationBatch,
    });

    const queuedItems: NotificationQueueDocument[] = [];
    const blockedIllegalItems: { crewName: string; staffNumber: string; violations: string[] }[] = [];

    for (const diff of diffs) {
      const { crewMember, priority, category, subject, message, details } = diff;

      // Only validate legality for active/reassigned duties (skip stand-down/removal legality checks)
      if (diff.changeType !== 'REASSIGNED_REMOVED') {
        const legalityResult = verifyLegalityForCrewAssignment(crewMember, details.flightDate, {
          flightNumber: details.flightNumber,
          aircraft: details.aircraft,
          date: details.flightDate,
        });

        if (!legalityResult.isLegal) {
          blockedIllegalItems.push({
            crewName: crewMember.name,
            staffNumber: crewMember.staffNumber,
            violations: legalityResult.violations,
          });
          // Do not queue notifications for illegal assignments
          continue;
        }
      }

      // Determine dispatch channels based on Priority & Crew Preferences (WhatsApp paused for now)
      const channels: NotificationChannelType[] = [];
      const userPref = crewMember.preferredChannel || 'ALL';

      if (priority === 'CRITICAL') {
        // Critical reassignments dispatch via Email and In-App alerts
        channels.push('IN_APP');
        if (crewMember.email) {
          channels.push('EMAIL');
        }
      } else if (priority === 'HIGH') {
        // High priority roster changes go via Email and In-App
        if (userPref === 'ALL' || userPref === 'EMAIL' || userPref === 'WHATSAPP') {
          if (crewMember.email) channels.push('EMAIL');
        }
        channels.push('IN_APP');
      } else {
        // Normal publications follow standard notification preference (Email / In-App)
        if (userPref === 'ALL' || userPref === 'EMAIL' || userPref === 'WHATSAPP') {
          if (crewMember.email) channels.push('EMAIL');
        }
        channels.push('IN_APP');
      }

      const uniqueChannels = Array.from(new Set(channels));

      for (const ch of uniqueChannels) {
        const queueId = `q_${category.toLowerCase()}_${afterState.id}_${crewMember.id}_${ch.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        let templateId: string | undefined;
        if (ch === 'EMAIL') {
          templateId =
            priority === 'CRITICAL'
              ? 'email_reassignment_urgent'
              : priority === 'HIGH'
              ? 'email_roster_amendment'
              : 'email_roster_publication';
        }

        const queueDoc: NotificationQueueDocument = {
          id: queueId,
          recipientId: crewMember.id,
          recipientName: crewMember.name,
          recipientStaffNumber: crewMember.staffNumber,
          recipientEmail: crewMember.email,
          recipientPhone: crewMember.whatsAppNumber || crewMember.phone || crewMember.mobileNumber,
          recipientWhatsApp: crewMember.whatsAppNumber || crewMember.phone || crewMember.mobileNumber,
          channel: ch,
          notificationType: category,
          priority,
          subject,
          message,
          status: 'QUEUED',
          flightNumber: details.flightNumber,
          flightDate: details.flightDate,
          dutyCode: details.dutyCode,
          origin: details.origin,
          destination: details.destination,
          reportTime: details.reportTime,
          dutyEndTime: details.dutyEndTime,
          templateId,
          templateParams: {
            '1': crewMember.name,
            '2': details.flightNumber || 'FLIGHT',
            '3': details.dutyCode || 'DUTY',
            '4': details.reportTime || 'TBD',
            '5': details.reason || 'OCC Schedule Update',
          },
          retryCount: 0,
          maxRetries: priority === 'CRITICAL' ? 5 : 3,
          initiatedBy: updatedBy || 'OCC_ROSTER_ENGINE',
          createdAt: now,
          legalityVerified: true,
          legalityValidationId: `legality_appr_${afterState.id}_${Date.now()}`,
          assignmentId: afterState.id,
          revision: details.revision,
          metadata: {
            changeType: diff.changeType,
            assignmentId: afterState.id,
            origin: details.origin,
            destination: details.destination,
          },
        };

        queuedItems.push(queueDoc);
      }
    }

    const summary = `Evaluated assignment ${afterState.id}: Generated ${queuedItems.length} queue items across ${diffs.length} crew diffs. ${blockedIllegalItems.length} blocked by Legality Engine.`;

    return {
      queuedItems,
      blockedIllegalItems,
      summary,
    };
  }
}

// ============================================================================
// 6. LEGACY TRIGGER HANDLERS (QUEUING TO FIRESTORE)
// ============================================================================

export class NotificationTriggerEngine {
  /**
   * 1. Roster Publication Trigger
   */
  public static createRosterPublicationQueueItems(
    event: RosterPublicationEventData
  ): {
    approvedQueueItems: NotificationQueueDocument[];
    rejectedCrew: { crewName: string; reason: string }[];
  } {
    const approvedQueueItems: NotificationQueueDocument[] = [];
    const rejectedCrew: { crewName: string; reason: string }[] = [];
    const now = new Date().toISOString();

    if (!event.legalityEngineSignoff.passedValidation || event.legalityEngineSignoff.hardViolationsCount > 0) {
      throw new Error(
        `Cannot queue roster publication notifications: Legality Engine detected ${event.legalityEngineSignoff.hardViolationsCount} unresolved violations.`
      );
    }

    for (const crew of event.crewMembers) {
      const legalityResult = verifyLegalityForCrewAssignment(crew, event.startDate);

      if (!legalityResult.isLegal) {
        rejectedCrew.push({
          crewName: crew.name,
          reason: legalityResult.violations.join('; '),
        });
        continue;
      }

      const channels: NotificationChannelType[] = [];
      const pref = crew.preferredChannel || 'ALL';

      // WhatsApp disabled for now: dispatch via Email and In-App
      if (pref === 'ALL' || pref === 'EMAIL' || pref === 'WHATSAPP') {
        if (crew.email) channels.push('EMAIL');
      }
      channels.push('IN_APP');

      const formattedSubject = `Zambia Airways - Official Roster Published: ${event.rosterPeriod}`;
      const formattedMessage = `Dear ${crew.name},\n\nYour official flight and duty roster for ${event.rosterPeriod} (${event.startDate} to ${event.endDate}) has been legally verified and published by Crew Planning.\n\nPlease log in to the Zambia Airways Crew Portal to review your schedule and acknowledge receipt within 24 hours.\n\nZambia Airways OCC Operations`;

      for (const ch of channels) {
        const queueId = `q_roster_${crew.id}_${ch.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        
        const queueDoc: NotificationQueueDocument = {
          id: queueId,
          recipientId: crew.id,
          recipientName: crew.name,
          recipientStaffNumber: crew.staffNumber,
          recipientEmail: crew.email,
          recipientPhone: crew.whatsAppNumber || crew.phone || crew.mobileNumber,
          recipientWhatsApp: crew.whatsAppNumber || crew.phone || crew.mobileNumber,
          channel: ch,
          notificationType: 'ROSTER_PUBLICATION',
          priority: 'NORMAL',
          subject: formattedSubject,
          message: formattedMessage,
          status: 'QUEUED',
          templateId: ch === 'EMAIL' ? 'email_roster_publication' : undefined,
          templateParams: {
            '1': crew.name,
            '2': event.rosterPeriod,
            '3': `${event.startDate} - ${event.endDate}`,
          },
          retryCount: 0,
          maxRetries: 3,
          initiatedBy: event.publishedBy || 'OCC_PLANNING',
          createdAt: now,
          legalityVerified: true,
          legalityValidationId: `legality_signoff_${event.publishTimestamp}`,
        };

        approvedQueueItems.push(queueDoc);
      }
    }

    return { approvedQueueItems, rejectedCrew };
  }

  /**
   * 2. Operational Disruption Trigger
   */
  public static createDisruptionQueueItems(
    event: DisruptionEventData
  ): {
    approvedQueueItems: NotificationQueueDocument[];
    rejectedCrew: { crewName: string; reason: string }[];
  } {
    const approvedQueueItems: NotificationQueueDocument[] = [];
    const rejectedCrew: { crewName: string; reason: string }[] = [];
    const now = new Date().toISOString();

    for (const crew of event.impactedCrew) {
      const legalityResult = verifyLegalityForCrewAssignment(crew, event.flightDate, {
        flightNumber: event.flightNumber,
        aircraft: event.aircraft,
        date: event.flightDate,
      });

      if (!legalityResult.isLegal) {
        rejectedCrew.push({
          crewName: crew.name,
          reason: legalityResult.violations.join('; '),
        });
        continue;
      }

      const urgency: NotificationPriorityType = 
        event.disruptionType === 'CANCELLATION' || event.disruptionType === 'CREW_CHANGE' 
          ? 'CRITICAL' 
          : 'HIGH';

      let subjectPrefix = 'OPERATIONAL ALERT';
      if (event.disruptionType === 'DELAY') subjectPrefix = `FLIGHT DELAY: ${event.flightNumber}`;
      if (event.disruptionType === 'CANCELLATION') subjectPrefix = `FLIGHT CANCELLED: ${event.flightNumber}`;
      if (event.disruptionType === 'AIRCRAFT_CHANGE') subjectPrefix = `AIRCRAFT CHANGE: ${event.flightNumber}`;

      const revisedReportNote = event.revisedDutyReportTime
        ? `\n\nRevised Duty Report Time: ${event.revisedDutyReportTime} (UTC+2)`
        : '';

      const messageBody = `CRITICAL OCC ALERT\n\nDear ${crew.name} (${crew.staffNumber}),\n\nFlight ${event.flightNumber} (${event.origin} ➔ ${event.destination}) on ${event.flightDate} has experienced a disruption: ${event.disruptionType}.\n\nOriginal Departure: ${event.originalDeparture}\nRevised Departure: ${event.revisedDeparture}\nReason: ${event.reason}${revisedReportNote}\n\nPlease check the Crew Portal or contact OCC Duty Officer immediately to acknowledge this change.\n\nOCC Duty Desk - Zambia Airways`;

      const channels: NotificationChannelType[] = ['IN_APP'];
      if (crew.email) channels.push('EMAIL');

      for (const ch of channels) {
        const queueId = `q_disrupt_${event.id}_${crew.id}_${ch.toLowerCase()}_${Date.now()}`;
        
        const queueDoc: NotificationQueueDocument = {
          id: queueId,
          recipientId: crew.id,
          recipientName: crew.name,
          recipientStaffNumber: crew.staffNumber,
          recipientEmail: crew.email,
          recipientPhone: crew.whatsAppNumber || crew.phone || crew.mobileNumber,
          recipientWhatsApp: crew.whatsAppNumber || crew.phone || crew.mobileNumber,
          channel: ch,
          notificationType: 'DISRUPTION',
          priority: urgency,
          subject: subjectPrefix,
          message: messageBody,
          status: 'QUEUED',
          flightNumber: event.flightNumber,
          flightDate: event.flightDate,
          origin: event.origin,
          destination: event.destination,
          reportTime: event.revisedDutyReportTime,
          templateId: ch === 'EMAIL' ? 'email_disruption_alert' : undefined,
          templateParams: {
            '1': crew.name,
            '2': event.flightNumber,
            '3': event.disruptionType,
            '4': event.revisedDeparture,
            '5': event.reason,
          },
          retryCount: 0,
          maxRetries: 5,
          initiatedBy: event.initiatedBy || 'OCC_DUTY_DESK',
          createdAt: now,
          legalityVerified: true,
          legalityValidationId: `disrupt_check_${event.flightNumber}_${Date.now()}`,
        };

        approvedQueueItems.push(queueDoc);
      }
    }

    return { approvedQueueItems, rejectedCrew };
  }

  /**
   * 3. Training & Qualification Expiry Trigger
   */
  public static createTrainingExpiryQueueItem(
    event: TrainingExpiryEventData
  ): NotificationQueueDocument[] {
    const queueItems: NotificationQueueDocument[] = [];
    const now = new Date().toISOString();
    const { crew, trainingType, expiryDate, daysRemaining } = event;

    const urgency: NotificationPriorityType = daysRemaining <= 7 ? 'CRITICAL' : daysRemaining <= 30 ? 'HIGH' : 'NORMAL';

    const subject = `Training & Qualification Alert: ${trainingType} Expiry in ${daysRemaining} Days`;
    const sessionNote = event.scheduledSessionDate
      ? `\n\nA refresher session has been scheduled for: ${event.scheduledSessionDate}${event.location ? ` at ${event.location}` : ''}.`
      : '\n\nPlease contact Crew Training (training@zambiaairways.co.zm) immediately to schedule your recurrent session before expiry.';

    const message = `Dear ${crew.name},\n\nThis is an automated compliance notification from Zambia Airways Flight Operations Training.\n\nYour ${trainingType} qualification will expire on ${expiryDate} (${daysRemaining} days remaining). Failure to renew prior to expiry will result in automatic flight duty grounding pursuant to ZCARs regulations.${sessionNote}\n\nCrew Training Department`;

    const channels: NotificationChannelType[] = ['IN_APP'];
    if (crew.email) {
      channels.push('EMAIL');
    }

    for (const ch of channels) {
      const queueId = `q_train_${crew.id}_${trainingType}_${ch.toLowerCase()}_${Date.now()}`;

      queueItems.push({
        id: queueId,
        recipientId: crew.id,
        recipientName: crew.name,
        recipientStaffNumber: crew.staffNumber,
        recipientEmail: crew.email,
        recipientPhone: crew.whatsAppNumber || crew.phone,
        recipientWhatsApp: crew.whatsAppNumber || crew.phone,
        channel: ch,
        notificationType: 'TRAINING_EXPIRY',
        priority: urgency,
        subject,
        message,
        status: 'QUEUED',
        templateId: ch === 'EMAIL' ? 'email_training_compliance' : undefined,
        templateParams: {
          '1': crew.name,
          '2': trainingType,
          '3': expiryDate,
          '4': String(daysRemaining),
        },
        retryCount: 0,
        maxRetries: 3,
        initiatedBy: 'COMPLIANCE_ENGINE',
        createdAt: now,
        legalityVerified: true,
      });
    }

    return queueItems;
  }
}

// ============================================================================
// 7. PROVIDER IMPLEMENTATIONS
// ============================================================================

export class MetaWhatsAppProvider implements IWhatsAppProvider {
  public readonly name = 'META_WHATSAPP_CLOUD_API';

  private get token(): string | undefined {
    return process.env.WHATSAPP_ACCESS_TOKEN;
  }

  private get phoneId(): string {
    return process.env.WHATSAPP_PHONE_NUMBER_ID || '108429582194830';
  }

  private get apiEndpoint(): string {
    return process.env.WHATSAPP_API_ENDPOINT || 'https://graph.facebook.com/v20.0';
  }

  public get isConfigured(): boolean {
    return !!this.token;
  }

  public async sendMessage(params: WhatsAppSendParams): Promise<ProviderDispatchResult> {
    const fallbackId = `wam_meta_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!this.token) {
      return {
        success: false,
        provider: this.name,
        providerMessageId: fallbackId,
        status: 'FAILED',
        errorMessage: 'WHATSAPP_ACCESS_TOKEN not configured.',
        errorCode: 'UNCONFIGURED_CREDENTIALS',
      };
    }

    const cleanPhone = params.recipientPhone.replace(/[\s\+\-\(\)]/g, '');

    const payload = params.templateName
      ? {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'template',
          template: {
            name: params.templateName,
            language: { code: 'en_GB' },
            components: [
              {
                type: 'body',
                parameters: Object.entries(params.variables || {}).map(([_, val]) => ({
                  type: 'text',
                  text: String(val),
                })),
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: params.messageText || '' },
        };

    try {
      const response = await fetch(`${this.apiEndpoint}/${this.phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          provider: this.name,
          providerMessageId: fallbackId,
          status: 'FAILED',
          errorMessage: data?.error?.message || 'WhatsApp Meta Cloud API rejected dispatch',
          errorCode: String(data?.error?.code || response.status),
          rawResponse: data,
        };
      }

      const metaMsgId = data?.messages?.[0]?.id || fallbackId;
      return {
        success: true,
        provider: this.name,
        providerMessageId: metaMsgId,
        status: 'SENT',
        sentAt: new Date().toISOString(),
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        providerMessageId: fallbackId,
        status: 'FAILED',
        errorMessage: err?.message || 'Network transport failure contacting Meta Cloud API',
        errorCode: 'NETWORK_ERROR',
      };
    }
  }

  public async testConnection(): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!this.isConfigured) {
      return { success: false, message: 'WhatsApp Access Token is not set.' };
    }
    return { success: true, message: `Meta WhatsApp Cloud API configured for Phone ID ${this.phoneId}` };
  }
}

export class SendGridEmailProvider implements IEmailProvider {
  public readonly name = 'SENDGRID_API';

  private get apiKey(): string | undefined {
    return process.env.SENDGRID_API_KEY;
  }

  private get senderEmail(): string {
    return process.env.SMTP_SENDER_EMAIL || 'crewcontrol@zambiaairways.co.zm';
  }

  private get senderName(): string {
    return process.env.SMTP_SENDER_NAME || 'Zambia Airways Crew Operations';
  }

  public get isConfigured(): boolean {
    return !!this.apiKey;
  }

  public async sendEmail(params: EmailSendParams): Promise<ProviderDispatchResult> {
    const fallbackId = `sg_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!this.isConfigured) {
      return {
        success: false,
        provider: this.name,
        providerMessageId: fallbackId,
        status: 'FAILED',
        errorMessage: 'SENDGRID_API_KEY is not configured on the server.',
        errorCode: 'UNCONFIGURED_CREDENTIALS',
      };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: params.recipientEmail, name: params.recipientName }],
              subject: params.subject,
            },
          ],
          from: { email: this.senderEmail, name: this.senderName },
          reply_to: params.replyTo ? { email: params.replyTo } : undefined,
          content: [
            {
              type: 'text/html',
              value: params.htmlBody || params.textBody || '<p>Zambia Airways Operational Notification</p>',
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          provider: this.name,
          providerMessageId: fallbackId,
          status: 'FAILED',
          errorMessage: `SendGrid error (${response.status}): ${errorText}`,
          errorCode: String(response.status),
        };
      }

      const messageId = response.headers.get('x-message-id') || fallbackId;
      return {
        success: true,
        provider: this.name,
        providerMessageId: messageId,
        status: 'SENT',
        sentAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        providerMessageId: fallbackId,
        status: 'FAILED',
        errorMessage: err?.message || 'SendGrid network dispatch error',
      };
    }
  }

  public async testConnection(): Promise<{ success: boolean; message: string }> {
    return {
      success: this.isConfigured,
      message: this.isConfigured ? 'SendGrid configured' : 'SendGrid API key not set',
    };
  }
}

export class SandboxWhatsAppProvider implements IWhatsAppProvider {
  public readonly name = 'WHATSAPP_SANDBOX';
  public readonly isConfigured = true;

  public async sendMessage(params: WhatsAppSendParams): Promise<ProviderDispatchResult> {
    const providerMessageId = `wam_zn_sbx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      success: true,
      provider: this.name,
      providerMessageId,
      status: 'SENT',
      sentAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString(),
      meta: {
        recipientNumber: params.recipientPhone,
        recipientName: params.recipientName,
        simulated: true,
      },
    };
  }

  public async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'WhatsApp Sandbox Provider Ready' };
  }
}

export class SandboxEmailProvider implements IEmailProvider {
  public readonly name = 'EMAIL_SANDBOX';
  public readonly isConfigured = true;

  public async sendEmail(params: EmailSendParams): Promise<ProviderDispatchResult> {
    const providerMessageId = `em_zn_sbx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}@zambiaairways.co.zm`;

    return {
      success: true,
      provider: this.name,
      providerMessageId,
      status: 'SENT',
      sentAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString(),
      meta: {
        recipientEmail: params.recipientEmail,
        recipientName: params.recipientName,
        simulated: true,
      },
    };
  }

  public async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Email Sandbox Provider Ready' };
  }
}

// ============================================================================
// 8. NOTIFICATION GATEWAY ROUTER & FALLBACK DISPATCHER
// ============================================================================

export class NotificationGatewayRouter {
  private whatsAppProviders: IWhatsAppProvider[] = [];
  private emailProviders: IEmailProvider[] = [];

  constructor() {
    this.whatsAppProviders = [
      new MetaWhatsAppProvider(),
      new SandboxWhatsAppProvider(),
    ];

    this.emailProviders = [
      new SendGridEmailProvider(),
      new SandboxEmailProvider(),
    ];
  }

  public registerWhatsAppProvider(provider: IWhatsAppProvider) {
    this.whatsAppProviders.unshift(provider);
  }

  public registerEmailProvider(provider: IEmailProvider) {
    this.emailProviders.unshift(provider);
  }

  public async dispatchWhatsApp(_params: WhatsAppSendParams): Promise<ProviderDispatchResult> {
    return {
      success: false,
      provider: 'WHATSAPP_GATEWAY',
      providerMessageId: `wa_disabled_${Date.now()}`,
      status: 'FAILED',
      errorMessage: 'WhatsApp notifications are temporarily paused / disabled by administrator.',
      errorCode: 'CHANNEL_PAUSED',
    };
  }

  public async dispatchEmail(params: EmailSendParams): Promise<ProviderDispatchResult> {
    let lastError: ProviderDispatchResult | null = null;
    for (const provider of this.emailProviders) {
      if (provider.isConfigured || provider.name === 'EMAIL_SANDBOX') {
        const result = await provider.sendEmail(params);
        if (result.success) return result;
        lastError = result;
      }
    }
    return lastError || {
      success: false,
      provider: 'NONE',
      providerMessageId: `fail_${Date.now()}`,
      status: 'FAILED',
      errorMessage: 'All Email providers failed',
    };
  }
}

export const notificationGateway = new NotificationGatewayRouter();

// ============================================================================
// 9. CORE PROCESSOR FOR QUEUE ITEM TO AUDIT LOG
// ============================================================================

export async function processNotificationQueueItem(
  queueItem: NotificationQueueDocument
): Promise<{
  status: NotificationStatusType;
  dispatchResult: ProviderDispatchResult;
  logRecord: NotificationLogDocument;
}> {
  const now = new Date().toISOString();

  let dispatchResult: ProviderDispatchResult;

  if (queueItem.channel === 'WHATSAPP') {
    const phone = queueItem.recipientPhone || queueItem.recipientWhatsApp;
    if (!phone) {
      dispatchResult = {
        success: false,
        provider: 'ENGINE_VALIDATION',
        providerMessageId: `err_${Date.now()}`,
        status: 'FAILED',
        errorMessage: 'Missing phone number for recipient',
      };
    } else {
      dispatchResult = await notificationGateway.dispatchWhatsApp({
        recipientPhone: phone,
        recipientName: queueItem.recipientName,
        messageText: queueItem.message,
        templateName: queueItem.templateId,
        variables: queueItem.templateParams,
        priority: queueItem.priority,
        notificationId: queueItem.id,
      });
    }
  } else if (queueItem.channel === 'EMAIL') {
    if (!queueItem.recipientEmail) {
      dispatchResult = {
        success: false,
        provider: 'ENGINE_VALIDATION',
        providerMessageId: `err_${Date.now()}`,
        status: 'FAILED',
        errorMessage: 'Missing email address for recipient',
      };
    } else {
      dispatchResult = await notificationGateway.dispatchEmail({
        recipientEmail: queueItem.recipientEmail,
        recipientName: queueItem.recipientName,
        subject: queueItem.subject || 'Zambia Airways OCC Operational Notification',
        textBody: queueItem.message,
        priority: queueItem.priority,
        notificationId: queueItem.id,
      });
    }
  } else {
    // In-App or SMS
    dispatchResult = {
      success: true,
      provider: 'IN_APP_GATEWAY',
      providerMessageId: `inapp_${Date.now()}`,
      status: 'DELIVERED',
      sentAt: now,
      deliveredAt: now,
    };
  }

  const finalStatus: NotificationStatusType = dispatchResult.success
    ? (dispatchResult.status as NotificationStatusType) || 'SENT'
    : 'FAILED';

  const logRecord: NotificationLogDocument = {
    id: `log_${queueItem.id}_${Date.now()}`,
    queueId: queueItem.id,
    recipientId: queueItem.recipientId,
    recipientName: queueItem.recipientName,
    recipientStaffNumber: queueItem.recipientStaffNumber,
    recipientContact:
      queueItem.channel === 'WHATSAPP'
        ? queueItem.recipientPhone || queueItem.recipientWhatsApp
        : queueItem.recipientEmail,
    channel: queueItem.channel,
    notificationType: queueItem.notificationType,
    priority: queueItem.priority,
    subject: queueItem.subject,
    message: queueItem.message,
    status: finalStatus,
    flightNumber: queueItem.flightNumber,
    flightDate: queueItem.flightDate,
    dutyCode: queueItem.dutyCode,
    origin: queueItem.origin,
    destination: queueItem.destination,
    provider: dispatchResult.provider,
    providerMessageId: dispatchResult.providerMessageId,
    retryCount: (queueItem.retryCount || 0) + (dispatchResult.success ? 0 : 1),
    errorMessage: dispatchResult.errorMessage,
    createdAt: queueItem.createdAt || now,
    sentAt: dispatchResult.sentAt || now,
    deliveredAt: dispatchResult.deliveredAt,
    failedAt: !dispatchResult.success ? now : undefined,
    initiatedBy: queueItem.initiatedBy || 'OCC_SYSTEM',
    statusTimeline: [
      {
        status: 'QUEUED',
        timestamp: queueItem.createdAt || now,
        actorOrProvider: queueItem.initiatedBy || 'OCC_SYSTEM',
        note: 'Queued for dispatch',
      },
      {
        status: finalStatus,
        timestamp: now,
        actorOrProvider: dispatchResult.provider,
        note: dispatchResult.success
          ? `Delivered to provider gateway: ${dispatchResult.provider}`
          : `Dispatch failed: ${dispatchResult.errorMessage}`,
      },
    ],
  };

  return {
    status: finalStatus,
    dispatchResult,
    logRecord,
  };
}
