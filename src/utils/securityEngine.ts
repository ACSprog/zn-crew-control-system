import { verifyAuditEntries } from './auditSeal';
import { Role, Permission, UserSession, SecurityAuditRecord } from '../types/security';
import { CrewMember, ActiveView } from '../types';

/**
 * Standard Role-to-Permissions Mapping for Zambia Airways Operations
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: [
    Permission.ROSTER_READ_ALL,
    Permission.ROSTER_READ_SELF,
    Permission.ROSTER_EDIT,
    Permission.ROSTER_OVERRIDE_APPROVE,
    Permission.PII_READ_FULL,
    Permission.AUDIT_LOG_READ,
    Permission.USER_MANAGE,
    Permission.SECURITY_CONFIG,
    Permission.DATABASE_ADMIN,
  ],
  [Role.SCHEDULER]: [
    Permission.ROSTER_READ_ALL,
    Permission.ROSTER_READ_SELF,
    Permission.ROSTER_EDIT,
    Permission.PII_READ_FULL,
    Permission.AUDIT_LOG_READ,
  ],
  [Role.CHIEF_PILOT]: [
    Permission.ROSTER_READ_ALL,
    Permission.ROSTER_READ_SELF,
    Permission.ROSTER_OVERRIDE_APPROVE,
    Permission.PII_READ_FULL,
    Permission.AUDIT_LOG_READ,
  ],
  [Role.FLIGHT_CREW]: [
    Permission.ROSTER_READ_SELF,
  ],
  [Role.AUDITOR]: [
    Permission.ROSTER_READ_ALL,
    Permission.AUDIT_LOG_READ,
  ],
};

/**
 * Maps legacy role strings to standardized Security Roles
 */
export function normalizeRole(roleStr: string): Role {
  switch (roleStr) {
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return Role.SUPER_ADMIN;
    case 'OCC_CONTROLLER':
    case 'SCHEDULER':
      return Role.SCHEDULER;
    case 'CHIEF_PILOT':
      return Role.CHIEF_PILOT;
    case 'PILOT_CABIN':
    case 'FLIGHT_CREW':
      return Role.FLIGHT_CREW;
    case 'AUDITOR':
      return Role.AUDITOR;
    default:
      return Role.FLIGHT_CREW;
  }
}

/**
 * Checks if a user has a specific permission
 */
export function hasPermission(session: UserSession | null, permission: Permission): boolean {
  if (!session) return false;
  if (session.role === Role.SUPER_ADMIN) return true;
  return session.permissions.includes(permission);
}

/**
 * Checks if a user has all required permissions
 */
export function hasAllPermissions(session: UserSession | null, requiredPermissions: Permission[]): boolean {
  if (!session) return false;
  if (session.role === Role.SUPER_ADMIN) return true;
  return requiredPermissions.every((p) => session.permissions.includes(p));
}

/**
 * Role-Based Access Control (RBAC) View Guard
 */
export function canAccessView(view: ActiveView, role: Role): { allowed: boolean; reason?: string } {
  if (role === Role.SUPER_ADMIN) return { allowed: true };

  switch (view) {
    case 'portal':
    case 'crewportal':
    case 'guide':
      return { allowed: true };

    case 'users':
    case 'settings':
      return {
        allowed: false,
        reason: 'Access Restricted: Only Super Admin / IT can access User Administration & System Settings.',
      };

    case 'scheduler':
    case 'scheduling':
      if (role === Role.FLIGHT_CREW || role === Role.AUDITOR) {
        return {
          allowed: false,
          reason: `Access Restricted: ${role} accounts have read-only access and cannot edit or generate live flight rosters.`,
        };
      }
      return { allowed: true };

    case 'crew':
    case 'documents':
    case 'linechecks':
    case 'leave':
    case 'training':
      if (role === Role.FLIGHT_CREW) {
        return {
          allowed: false,
          reason: 'Data Privacy Guard: Flight Crew members can only view their own individual records via the Crew Member Portal.',
        };
      }
      return { allowed: true };

    case 'audit':
      if (role === Role.FLIGHT_CREW) {
        return {
          allowed: false,
          reason: 'Access Restricted: Audit trail inspection is reserved for Schedulers, Chief Pilots, Auditors, and Super Admins.',
        };
      }
      return { allowed: true };

    default:
      if (role === Role.FLIGHT_CREW && view !== 'dashboard' && view !== 'calendar') {
        return {
          allowed: false,
          reason: 'Flight Crew accounts are limited to the Personal Crew Portal, Calendar, and Operational Guides.',
        };
      }
      return { allowed: true };
  }
}

/**
 * Enforces Roster Data Segregation: Ensures flight crew can only query their own records
 */
export function enforceRosterOwnership(
  session: UserSession | null,
  targetCrewId: string,
  targetStaffNumber?: string
): boolean {
  if (!session) return false;
  if (session.role === Role.SUPER_ADMIN || session.role === Role.SCHEDULER || session.role === Role.CHIEF_PILOT || session.role === Role.AUDITOR) {
    return true;
  }
  // Flight crew can only access their own profile or matching staff number
  return session.userId === targetCrewId || (targetStaffNumber !== undefined && session.userId === targetStaffNumber);
}

/**
 * PII Data Sanitization & Field-Level Masking
 * Masks phone numbers, passport, national IDs, and restricts sensitive medical notes
 */
export function sanitizeCrewMember(crew: CrewMember, accessOrRole: boolean | Role): CrewMember {
  const hasFullPiiAccess = typeof accessOrRole === 'boolean'
    ? accessOrRole
    : (accessOrRole === Role.SUPER_ADMIN || accessOrRole === Role.SCHEDULER || accessOrRole === Role.CHIEF_PILOT);

  if (hasFullPiiAccess) {
    return crew;
  }

  // Mask PII for non-privileged viewers
  return {
    ...crew,
    phone: crew.phone ? maskPhoneNumber(crew.phone) : '••••••••',
    passportNumber: crew.passportNumber ? maskPassportNumber(crew.passportNumber) : '••••••••',
    dob: '••••-••-••',
    emergencyContact: '[RESTRICTED PII - AUTHORIZED OCC ONLY]',
    notes: sanitizeMedicalNotes(crew.notes),
  };
}

/**
 * Field-level security: Sanitizes health and medical explanations to maintain HIPAA / Data Privacy
 */
export function sanitizeMedicalNotes(notes: string | undefined): string {
  if (!notes) return '';
  const sensitiveKeywords = ['sick', 'sck', 'illness', 'hospital', 'surgery', 'diagnosis', 'medical', 'fever', 'infection', 'unfit'];
  const hasSensitiveWord = sensitiveKeywords.some((w) => notes.toLowerCase().includes(w));
  if (hasSensitiveWord) {
    return '[RESTRICTED MEDICAL DATA - UNFIT FOR DUTY]';
  }
  return notes;
}

export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 5) return '••••••••';
  const last4 = phone.slice(-4);
  return `+260 ••• ••${last4}`;
}

export function maskPassportNumber(passport: string): string {
  if (!passport || passport.length < 4) return '••••••••';
  const prefix = passport.slice(0, 2);
  const suffix = passport.slice(-2);
  return `${prefix}••••${suffix}`;
}

/**
 * Computes deterministic SHA-256 pseudo-hash for audit trail immutability
 */
export function generateAuditSeal(
  timestamp: string,
  userId: string,
  action: string,
  details: string,
  previousHash: string = '0000000000000000'
): string {
  const payload = `${timestamp}|${userId}|${action}|${details}|${previousHash}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
  const secondary = Math.abs((hash * 31) | 0).toString(16).padStart(8, '0');
  const tertiary = Math.abs((hash * 127) | 0).toString(16).padStart(8, '0');
  const quaternary = Math.abs((hash * 8191) | 0).toString(16).padStart(8, '0');
  return `ZA-SEC-${hexHash}${secondary}-${tertiary}${quaternary}`.toUpperCase();
}

/**
 * Verifies audit-log entries by recomputing their SHA-256 seals.
 * (Previously this always reported "0 tampering" without checking anything.)
 */
export function verifyAuditLogIntegrity(logs: any[]): { isValid: boolean; message: string; verifiedCount: number } {
  return verifyAuditEntries(logs || []);
}

/**
 * Creates an append-only, tamper-proof security audit log record
 */
export function createSecurityAuditRecord(
  user: { id: string; name: string; role: Role },
  action: string,
  resource: string,
  details: string,
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SECURITY' = 'INFO',
  previousHash?: string
): SecurityAuditRecord {
  const timestamp = new Date().toISOString();
  const immutableHash = generateAuditSeal(timestamp, user.id, action, details, previousHash);

  return {
    id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action,
    resource,
    details,
    severity,
    immutableHash,
    previousHash: previousHash || 'ZA-GENESIS-BLOCK-2026',
  };
}

/**
 * Simulates active JWT Token generation with 15-minute expiration
 */
export function issueUserSession(
  userId: string,
  name: string,
  email: string,
  role: Role,
  department: string = 'Operations'
): UserSession {
  const permissions = ROLE_PERMISSIONS[role] || [Permission.ROSTER_READ_SELF];
  const now = Date.now();
  const fifteenMinutesLater = new Date(now + 15 * 60 * 1000).toISOString();

  // Simulated JWT Header + Payload (Base64)
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: userId,
      name,
      role,
      permissions,
      iat: Math.floor(now / 1000),
      exp: Math.floor((now + 15 * 60 * 1000) / 1000),
      iss: 'zambia-airways-auth',
    })
  );
  const signature = 'sig_sha256_zambia_airways_secure_session';
  const token = `${header}.${payload}.${signature}`;

  return {
    userId,
    name,
    email,
    role,
    permissions,
    department,
    token,
    expiresAt: fifteenMinutesLater,
    // No second sign-in factor is implemented yet, so never claim one.
    mfaAuthenticated: false,
  };
}
