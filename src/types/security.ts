export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SCHEDULER = 'SCHEDULER',
  CHIEF_PILOT = 'CHIEF_PILOT',
  FLIGHT_CREW = 'FLIGHT_CREW',
  AUDITOR = 'AUDITOR',
}

export enum Permission {
  ROSTER_READ_SELF = 'roster:read:self',
  ROSTER_READ_ALL = 'roster:read:all',
  ROSTER_EDIT = 'roster:edit',
  ROSTER_OVERRIDE_APPROVE = 'roster:override:approve',
  PII_READ_FULL = 'pii:read:full',
  AUDIT_LOG_READ = 'audit:read',
  USER_MANAGE = 'user:manage',
  SECURITY_CONFIG = 'security:config',
  DATABASE_ADMIN = 'database:admin',
}

export interface UserSession {
  userId: string; // Company ID (e.g., "EMP-9283" or "ZA-ADM-001")
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  department?: string; // e.g., "B737", "Q400", "CABIN", "OCC"
  token?: string;
  expiresAt: string; // ISO String (15-minute inactivity timeout)
  mfaAuthenticated: boolean;
  ipAddress?: string;
}

export interface SecurityAuditRecord {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: Role;
  action: string;
  resource: string;
  details: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SECURITY';
  immutableHash: string; // SHA-256 integrity seal
  previousHash?: string; // Blockchain-style tamper-proof link
  ipAddress: string;
}

export interface MfaVerificationState {
  enabled: boolean;
  method: 'APP_AUTHENTICATOR' | 'COMPANY_SSO' | 'SMS_OTP';
  verified: boolean;
  secretKeyMasked: string;
}
