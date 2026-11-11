import { sha256Hex } from './sha256';

export interface AuditSealInput {
  timestamp: string;
  user: string;
  action: string;
  details: string;
  previousSeal: string;
}

/** Seal format v2: "ZA2-" + SHA-256 hex of the canonical fields. */
export function computeAuditSealV2(input: AuditSealInput): string {
  const canonical = JSON.stringify([
    'ZA-AUDIT-v2',
    input.timestamp,
    input.user,
    input.action,
    input.details,
    input.previousSeal,
  ]);
  return `ZA2-${sha256Hex(canonical)}`;
}

export interface AuditVerification {
  isValid: boolean;
  message: string;
  verifiedCount: number;
  tamperedIds: string[];
  unverifiableCount: number;
}

interface SealedEntry {
  id: string;
  user?: string;
  action?: string;
  details?: string;
  timestamp?: string;
  immutableSeal?: string;
  previousSeal?: string;
  sealVersion?: number;
}

/**
 * Recomputes every v2 seal from the stored fields. An entry whose content was
 * changed after it was written will no longer match its seal. Entries written
 * before seal v2 can't be re-verified and are counted separately (they are
 * still protected by the database rule that forbids edits and deletes).
 */
export function verifyAuditEntries(logs: SealedEntry[]): AuditVerification {
  const tamperedIds: string[] = [];
  let verifiedCount = 0;
  let unverifiableCount = 0;

  for (const e of logs) {
    if (e.sealVersion !== 2 || !e.timestamp || !e.immutableSeal) {
      unverifiableCount++;
      continue;
    }
    const expected = computeAuditSealV2({
      timestamp: e.timestamp,
      user: e.user || '',
      action: e.action || '',
      details: e.details || '',
      previousSeal: e.previousSeal || '',
    });
    if (expected === e.immutableSeal) verifiedCount++;
    else tamperedIds.push(e.id);
  }

  const parts: string[] = [];
  if (logs.length === 0) {
    return { isValid: true, message: 'Audit log is empty.', verifiedCount: 0, tamperedIds, unverifiableCount: 0 };
  }
  parts.push(`${verifiedCount} of ${logs.length} loaded entries re-verified against their SHA-256 seal.`);
  if (tamperedIds.length) {
    parts.push(`${tamperedIds.length} entr${tamperedIds.length === 1 ? 'y does' : 'ies do'} NOT match their seal and may have been altered: ${tamperedIds.slice(0, 10).join(', ')}${tamperedIds.length > 10 ? '…' : ''}`);
  }
  if (unverifiableCount) {
    parts.push(`${unverifiableCount} older entr${unverifiableCount === 1 ? 'y was' : 'ies were'} written before re-verifiable seals and can't be checked (edits to them are still blocked by database rules).`);
  }
  return {
    isValid: tamperedIds.length === 0,
    message: parts.join(' '),
    verifiedCount,
    tamperedIds,
    unverifiableCount,
  };
}
