import type { SystemUserPermissions } from '../types';

// Sensible default UI permissions per role, used only to drive what
// buttons/sections render — NOT a security boundary. Real enforcement
// happens in Firestore security rules and the server's ID-token check,
// both of which read the role on the user's users/{uid} profile, never this object.
export function defaultPermissionsForRole(role: string): SystemUserPermissions {
  const base = {
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
  };
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return Object.fromEntries(Object.keys(base).map((k) => [k, true])) as typeof base;
    case 'SCHEDULER':
    case 'OCC_CONTROLLER':
      return { ...base, canEditRoster: true, canGenerateRoster: true, canManageCrew: true, canExportAudit: true, canViewFullPii: true, canOverrideLegality: role === 'OCC_CONTROLLER', canApproveRosterEdits: role === 'OCC_CONTROLLER' };
    case 'CHIEF_PILOT':
      return { ...base, canOverrideLegality: true, canApproveRosterEdits: true, canViewFullPii: true, canExportAudit: true };
    case 'AUDITOR':
      return { ...base, canExportAudit: true };
    default:
      return base;
  }
}
