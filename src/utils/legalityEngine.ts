import {
  CrewMember,
  Flight,
  Assignment,
  LeaveTrainingRecord,
  LegalityRules,
  ConflictCheckResult,
  PreGenerationValidationReport,
  PreGenerationCrewCheck,
  CriticalLegalityConflict,
  RosterLegalityScanResult,
} from '../types';

export function formatHoursMinutes(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Validates whether a specific crew member can legally operate a specific flight.
 */
export function validateCrewLegality(
  crew: CrewMember,
  flight: Flight,
  allFlights: Flight[],
  allAssignments: Assignment[],
  leaveRecords: LeaveTrainingRecord[],
  rules: LegalityRules
): ConflictCheckResult {
  const failReasons: string[] = [];

  // 1. Aircraft Qualification & Status Check
  const isCabinCrew = crew.role === 'Cabin Crew' || crew.role === 'Senior Cabin Crew';
  const qualificationPass =
    crew.aircraft === flight.aircraft ||
    (Array.isArray(crew.qualifications) && crew.qualifications.includes(flight.aircraft));
  if (!qualificationPass) {
    const qualList =
      crew.qualifications && crew.qualifications.length > 0
        ? crew.qualifications.join(', ')
        : crew.aircraft;
    failReasons.push(
      `Aircraft mismatch: Crew qualified for (${qualList}), flight operates ${flight.aircraft}.`
    );
  }

  const availabilityPass =
    crew.status === 'ACTIVE' || crew.status === 'STANDBY';
  if (!availabilityPass) {
    failReasons.push(
      `Crew status is '${crew.status}'. Only ACTIVE or STANDBY crew can be assigned.`
    );
  }

  // 2. Comprehensive Currency & Document Validity Checks
  const flightDate = new Date(flight.date);
  let docValidityPass = true;

  // CAA Flight Crew License / Attestation Expiry Check
  if (crew.licenseExpiry && new Date(crew.licenseExpiry) < flightDate) {
    docValidityPass = false;
    failReasons.push(
      `License / Attestation expired on ${crew.licenseExpiry} (Flight date: ${flight.date}).`
    );
  }

  // Medical Certificate Expiry Check
  if (crew.medicalExpiry && new Date(crew.medicalExpiry) < flightDate) {
    docValidityPass = false;
    failReasons.push(
      `Medical certificate expired on ${crew.medicalExpiry} (Flight date: ${flight.date}).`
    );
  }

  // Passport Expiry Check
  if (crew.passportExpiry && new Date(crew.passportExpiry) < flightDate) {
    docValidityPass = false;
    failReasons.push(
      `Passport expired on ${crew.passportExpiry} (Flight date: ${flight.date}).`
    );
  }

  // Airport Security Pass Expiry Check
  if (crew.airportPassExpiry && new Date(crew.airportPassExpiry) < flightDate) {
    docValidityPass = false;
    failReasons.push(
      `Airport Security Pass expired on ${crew.airportPassExpiry} (Flight date: ${flight.date}).`
    );
  }

  // Simulator / Instrument Rating Currency Check (Flight Deck Pilots Only)
  if (!isCabinCrew && crew.simExpiry && new Date(crew.simExpiry) < flightDate) {
    docValidityPass = false;
    failReasons.push(
      `Pilot Simulator / IR Rating expired on ${crew.simExpiry} (Flight date: ${flight.date}).`
    );
  }

  // SEPT Validity Check (Safety & Emergency Procedures Training)
  if (crew.septExpiry && new Date(crew.septExpiry) < flightDate) {
    docValidityPass = false;
    failReasons.push(
      `SEPT (Safety & Emergency Procedures) expired on ${crew.septExpiry} (Flight date: ${flight.date}).`
    );
  }

  // CRM Validity Check (Crew Resource Management)
  if (crew.crmExpiry && new Date(crew.crmExpiry) < flightDate) {
    docValidityPass = false;
    failReasons.push(
      `CRM (Crew Resource Management) expired on ${crew.crmExpiry} (Flight date: ${flight.date}).`
    );
  }

  // DGR Validity Check (Dangerous Goods Regulations)
  if (crew.dgrExpiry && new Date(crew.dgrExpiry) < flightDate) {
    docValidityPass = false;
    failReasons.push(
      `DGR (Dangerous Goods) validity expired on ${crew.dgrExpiry} (Flight date: ${flight.date}).`
    );
  }

  // 3. Leave & Training Exclusion
  const onLeaveOrTraining = leaveRecords.some((record) => {
    if (record.crewId !== crew.id || !record.approved) return false;
    const start = new Date(record.startDate);
    const end = new Date(record.endDate);
    return flightDate >= start && flightDate <= end;
  });

  const leavePass = !onLeaveOrTraining;
  if (!leavePass) {
    failReasons.push(
      `Crew is unavailable due to registered Leave/Training on ${flight.date}.`
    );
  }

  // 4. Duplicate / Overlapping Assignment Check
  const crewAssignmentsOnDate = allAssignments.filter((asg) => {
    if (asg.flightId === flight.id) return false; // exclude current flight if re-checking
    const isAssigned =
      asg.captainId === crew.id ||
      asg.firstOfficerId === crew.id ||
      (asg.cabinCrewIds && asg.cabinCrewIds.includes(crew.id));
    if (!isAssigned) return false;

    const assignedFlight = allFlights.find((f) => f.id === asg.flightId);
    return assignedFlight?.date === flight.date;
  });

  let overlapPass = true;
  crewAssignmentsOnDate.forEach((asg) => {
    const asgFlight = allFlights.find((f) => f.id === asg.flightId);
    if (asgFlight) {
      if (
        isTimeOverlapping(
          flight.std,
          flight.sta,
          asgFlight.std,
          asgFlight.sta
        )
      ) {
        overlapPass = false;
        failReasons.push(
          `Overlapping flight assignment: Already assigned to ${asgFlight.flightNumber} (${asgFlight.std} - ${asgFlight.sta}).`
        );
      }
    }
  });

  // 5. Rest Hours & Rolling 7-Day Rest Calculation
  let previousRelease = '18:40';
  let nextReport = flight.std;
  let requiredRest = rules.minRestHours || 10;
  let availableRest = 14; // default pass if no previous duty
  let restPass = true;

  // Check rest from previous duty
  const prevDate = new Date(flightDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateStr = prevDate.toISOString().split('T')[0];

  const prevAssignments = allAssignments.filter((asg) => {
    const isAssigned =
      asg.captainId === crew.id ||
      asg.firstOfficerId === crew.id ||
      (asg.cabinCrewIds && asg.cabinCrewIds.includes(crew.id));
    if (!isAssigned) return false;
    const f = allFlights.find((fl) => fl.id === asg.flightId);
    return f && (f.date === prevDateStr || (f.date === flight.date && f.id !== flight.id));
  });

  if (prevAssignments.length > 0) {
    let latestReleaseMinutes = -1;
    let latestReleaseStr = '18:40';

    prevAssignments.forEach((asg) => {
      const f = allFlights.find((fl) => fl.id === asg.flightId);
      if (f) {
        const [staH, staM] = f.sta.split(':').map(Number);
        const isSameDay = f.date === flight.date;
        const releaseMin = (isSameDay ? 24 * 60 : 0) + (staH || 0) * 60 + (staM || 0) + 30;
        if (releaseMin > latestReleaseMinutes) {
          latestReleaseMinutes = releaseMin;
          latestReleaseStr = `${String(staH).padStart(2, '0')}:${String(staM).padStart(2, '0')}`;
        }
      }
    });

    if (latestReleaseMinutes > -1) {
      previousRelease = latestReleaseStr;
      const [stdH, stdM] = flight.std.split(':').map(Number);
      const reportMin = 24 * 60 + (stdH || 0) * 60 + (stdM || 0) - 60;
      const calculatedRestHours = (reportMin - latestReleaseMinutes) / 60;

      availableRest = Math.max(0, Math.round(calculatedRestHours * 10) / 10);
      if (availableRest < requiredRest) {
        restPass = false;
        failReasons.push(
          `Insufficient rest hours: Available rest is ${formatHoursMinutes(
            availableRest
          )}, required minimum is ${rules.minRestHours}:00.`
        );
      }
    }
  }

  // Rolling 7-day consecutive rest check (minimum 24h continuous rest within any 7-day window)
  const rollingRestRequired = rules.minRolling7DayRestHours || 24;
  let consecutiveDutyDays = 0;
  for (let d = 1; d <= 7; d++) {
    const checkDate = new Date(flightDate);
    checkDate.setDate(checkDate.getDate() - d);
    const checkDateStr = checkDate.toISOString().split('T')[0];
    const hasDutyOnDate = allAssignments.some((asg) => {
      const isAssigned =
        asg.captainId === crew.id ||
        asg.firstOfficerId === crew.id ||
        (asg.cabinCrewIds && asg.cabinCrewIds.includes(crew.id));
      if (!isAssigned) return false;
      const f = allFlights.find((fl) => fl.id === asg.flightId);
      return f?.date === checkDateStr;
    });
    if (hasDutyOnDate) {
      consecutiveDutyDays++;
    } else {
      break;
    }
  }

  if (consecutiveDutyDays >= (rules.maxConsecutiveDuties || 6)) {
    restPass = false;
    failReasons.push(
      `Rolling 7-day Rest Violation: Crew has operated ${consecutiveDutyDays} consecutive duty days without required ${rollingRestRequired}h continuous rest.`
    );
  }

  // 6. Flight Time Limitations (FTL): Weekly, Monthly, Annual
  let blockHoursPass = true;

  // Monthly Limit (Default 100h)
  const maxMonthly = rules.maxMonthlyBlockHours || 100;
  const currentMonthlyBlock = crew.monthlyBlockHours || 0;
  const projectedMonthly = currentMonthlyBlock + flight.blockHours;
  if (projectedMonthly > maxMonthly) {
    blockHoursPass = false;
    failReasons.push(
      `Exceeds monthly block hours limit: Projected ${projectedMonthly.toFixed(
        1
      )}h exceeds max ${maxMonthly}h.`
    );
  }

  // Weekly Limit (Default 30h)
  const maxWeekly = rules.maxWeeklyBlockHours || 30;
  const currentWeeklyBlock = crew.weeklyBlockHours || 0;
  const projectedWeekly = currentWeeklyBlock + flight.blockHours;
  if (projectedWeekly > maxWeekly) {
    blockHoursPass = false;
    failReasons.push(
      `Exceeds weekly block hours limit: Projected ${projectedWeekly.toFixed(
        1
      )}h exceeds max ${maxWeekly}h.`
    );
  }

  // Annual Limit (Default 1,000h)
  const maxAnnual = rules.maxAnnualBlockHours || 1000;
  const currentAnnualBlock = crew.annualBlockHours || 0;
  const projectedAnnual = currentAnnualBlock + flight.blockHours;
  if (projectedAnnual > maxAnnual) {
    blockHoursPass = false;
    failReasons.push(
      `Exceeds annual block hours limit: Projected ${projectedAnnual.toFixed(
        1
      )}h exceeds max ${maxAnnual}h.`
    );
  }

  const overallResult =
    qualificationPass &&
    availabilityPass &&
    docValidityPass &&
    leavePass &&
    overlapPass &&
    restPass &&
    blockHoursPass
      ? 'PASS'
      : 'FAIL';

  const recencyPass =
    (crew.flightsCount || 0) >= 3 ||
    crew.role === 'Cabin Crew' ||
    crew.role === 'Senior Cabin Crew';
  const lineCheckPass = crew.lineCheck
    ? new Date(crew.lineCheck).getTime() > Date.now()
    : true;

  return {
    crewId: crew.id,
    crewName: crew.name,
    flightId: flight.id,
    flightNumber: flight.flightNumber,
    aircraft: flight.aircraft,
    qualificationPass,
    availabilityPass,
    leavePass,
    restPass,
    blockHoursPass,
    overlapPass,
    docValidityPass,
    recencyPass,
    lineCheckPass,
    previousRelease,
    nextReport,
    requiredRest,
    availableRest,
    overallResult,
    failReasons,
  };
}

// Helper: check time overlap
function isTimeOverlapping(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = parseMinutes(start1);
  const e1 = parseMinutes(end1);
  const s2 = parseMinutes(start2);
  const e2 = parseMinutes(end2);
  return Math.max(s1, s2) < Math.min(e1, e2);
}

function parseMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Runs pre-generation compliance checks across all crew members BEFORE generating roster.
 * Validates licenses, medicals, SIM, SEPT, CRM, DGR, line checks, recency, leave conflicts, and FTL caps.
 */
export function runPreGenerationComplianceCheck(
  crewMembers: CrewMember[],
  flights: Flight[],
  leaveRecords: LeaveTrainingRecord[],
  rules: LegalityRules
): PreGenerationValidationReport {
  const crewChecks: PreGenerationCrewCheck[] = [];
  const hardViolations: string[] = [];
  const warnings: string[] = [];

  const now = new Date();

  crewMembers.forEach((crew) => {
    const issues: string[] = [];

    // License Check
    const licenseValid = Boolean(
      crew.licenseExpiry && new Date(crew.licenseExpiry) > now
    );
    if (!licenseValid) {
      issues.push(`License Expired or Missing (${crew.licenseExpiry || 'N/A'})`);
      hardViolations.push(`Crew ${crew.name} (${crew.staffNumber}): License expired or missing`);
    }

    // Medical Check
    const medicalValid = Boolean(
      crew.medicalExpiry && new Date(crew.medicalExpiry) > now
    );
    if (!medicalValid) {
      issues.push(`Medical Expired or Missing (${crew.medicalExpiry || 'N/A'})`);
      hardViolations.push(`Crew ${crew.name} (${crew.staffNumber}): Medical expired`);
    }

    // 4 Currencies Check (SIM, SEPT, CRM, DGR)
    const simValid = !crew.simExpiry || new Date(crew.simExpiry) > now;
    if (!simValid) {
      issues.push(`SIM / Instrument Rating Expired (${crew.simExpiry})`);
      warnings.push(`Crew ${crew.name} (${crew.staffNumber}): SIM check overdue`);
    }

    const septValid = !crew.septExpiry || new Date(crew.septExpiry) > now;
    if (!septValid) {
      issues.push(`SEPT (Safety Procedures) Expired (${crew.septExpiry})`);
      warnings.push(`Crew ${crew.name} (${crew.staffNumber}): SEPT training overdue`);
    }

    const crmValid = !crew.crmExpiry || new Date(crew.crmExpiry) > now;
    if (!crmValid) {
      issues.push(`CRM Currency Expired (${crew.crmExpiry})`);
      warnings.push(`Crew ${crew.name} (${crew.staffNumber}): CRM training overdue`);
    }

    const dgrValid = !crew.dgrExpiry || new Date(crew.dgrExpiry) > now;
    if (!dgrValid) {
      issues.push(`DGR (Dangerous Goods) Expired (${crew.dgrExpiry})`);
      warnings.push(`Crew ${crew.name} (${crew.staffNumber}): DGR certification overdue`);
    }

    // Line Check Check
    const lineCheckValid = !crew.lineCheck || new Date(crew.lineCheck) > now;
    if (!lineCheckValid) {
      issues.push(`Line Check / Evaluation Due (${crew.lineCheck})`);
      warnings.push(`Crew ${crew.name} (${crew.staffNumber}): Line Check review due`);
    }

    // Recency Check (For pilots: min 3 landings in 90 days)
    const isPilot = crew.role === 'Captain' || crew.role === 'First Officer';
    const recencyValid = !isPilot || (crew.flightsCount !== undefined ? crew.flightsCount >= 3 : true);
    if (!recencyValid) {
      issues.push(`Recency Non-Compliant (<3 Landings in 90 Days)`);
      warnings.push(`Crew ${crew.name} (${crew.staffNumber}): Recency non-compliant`);
    }

    // Leave overlap check
    const hasLeaveOverlap = leaveRecords.some((l) => l.crewId === crew.id && l.approved);

    // FTL hours remaining
    const weeklyMax = rules.maxWeeklyBlockHours || 30;
    const monthlyMax = rules.maxMonthlyBlockHours || 100;
    const weeklyHoursLeft = Math.max(0, weeklyMax - (crew.weeklyBlockHours || 0));
    const monthlyHoursLeft = Math.max(0, monthlyMax - (crew.monthlyBlockHours || 0));

    if (monthlyHoursLeft <= 5) {
      warnings.push(`Crew ${crew.name} (${crew.staffNumber}): Near monthly FTL limit (${crew.monthlyBlockHours || 0}h / ${monthlyMax}h)`);
    }

    const overallEligible = licenseValid && medicalValid && (crew.status === 'ACTIVE' || crew.status === 'STANDBY');

    crewChecks.push({
      crewId: crew.id,
      staffNumber: crew.staffNumber,
      name: crew.name,
      role: crew.role,
      aircraft: crew.aircraft,
      qualifications: crew.qualifications || [crew.aircraft],
      licenseValid,
      medicalValid,
      simValid,
      septValid,
      crmValid,
      dgrValid,
      recencyValid,
      lineCheckValid,
      hasLeaveOverlap,
      weeklyHoursLeft,
      monthlyHoursLeft,
      overallEligible,
      issues,
    });
  });

  const eligibleCrewCount = crewChecks.filter((c) => c.overallEligible).length;
  const ineligibleCrewCount = crewChecks.filter((c) => !c.overallEligible).length;

  return {
    timestamp: new Date().toISOString(),
    totalCrewChecked: crewMembers.length,
    eligibleCrewCount,
    ineligibleCrewCount,
    totalFlightsToSchedule: flights.length,
    crewChecks,
    hardViolations,
    warnings,
    readyToGenerate: hardViolations.length === 0,
  };
}

/**
 * Scans all roster flight assignments against the automated legality & FTL rules engine
 * to identify and surface Critical Legality Conflicts.
 */
export function scanRosterLegalityConflicts(
  flights: Flight[],
  crewMembers: CrewMember[],
  assignments: Assignment[],
  leaveRecords: LeaveTrainingRecord[],
  rules: LegalityRules
): RosterLegalityScanResult {
  const crewMap = new Map<string, CrewMember>(crewMembers.map((c) => [c.id, c]));
  const flightMap = new Map<string, Flight>(flights.map((f) => [f.id, f]));
  const conflicts: CriticalLegalityConflict[] = [];

  let totalChecked = 0;
  const processedKeys = new Set<string>();

  assignments.forEach((asg) => {
    const flight = flightMap.get(asg.flightId);
    if (!flight) return;

    // Collect all assigned crew members for this flight
    const assignedMembers: { member: CrewMember; role: CrewMember['role'] }[] = [];

    if (asg.captainId) {
      const cap = crewMap.get(asg.captainId);
      if (cap) assignedMembers.push({ member: cap, role: 'Captain' });
    }
    if (asg.firstOfficerId) {
      const fo = crewMap.get(asg.firstOfficerId);
      if (fo) assignedMembers.push({ member: fo, role: 'First Officer' });
    }
    if (Array.isArray(asg.cabinCrewIds)) {
      asg.cabinCrewIds.forEach((ccId) => {
        const cc = crewMap.get(ccId);
        if (cc) assignedMembers.push({ member: cc, role: cc.role });
      });
    }

    // Check if the assignment is manually marked CONFLICT with no assigned crew
    if (asg.status === 'CONFLICT' && assignedMembers.length === 0) {
      const conflictKey = `${asg.id}_manual_conflict`;
      if (!processedKeys.has(conflictKey)) {
        processedKeys.add(conflictKey);
        conflicts.push({
          id: conflictKey,
          flightId: flight.id,
          flightNumber: flight.flightNumber,
          flightDate: flight.date,
          aircraft: flight.aircraft,
          departure: flight.departure,
          arrival: flight.arrival,
          std: flight.std,
          sta: flight.sta,
          crewId: 'UNASSIGNED',
          crewName: 'Unassigned Crew / Roster Conflict',
          role: 'Captain',
          conflictType: 'MANUAL_CONFLICT',
          severity: 'CRITICAL',
          description: asg.notes || `Flight ${flight.flightNumber} flagged with an unresolved scheduling conflict.`,
          failReasons: [asg.notes || 'Unresolved sector staffing conflict.'],
        });
      }
    }

    // Validate each assigned crew member against the legality rules
    assignedMembers.forEach(({ member }) => {
      totalChecked++;
      const conflictKey = `${asg.id}_${member.id}`;
      if (processedKeys.has(conflictKey)) return;

      const result = validateCrewLegality(
        member,
        flight,
        flights,
        assignments,
        leaveRecords,
        rules
      );

      if (result.overallResult === 'FAIL' || asg.status === 'CONFLICT') {
        processedKeys.add(conflictKey);

        // Classify primary conflict type
        let conflictType: CriticalLegalityConflict['conflictType'] = 'MANUAL_CONFLICT';
        let severity: 'CRITICAL' | 'WARNING' = 'CRITICAL';

        if (!result.restPass) {
          if (result.failReasons.some((r) => r.includes('Rolling 7-day'))) {
            conflictType = 'CONSECUTIVE_DAYS';
          } else {
            conflictType = 'REST_VIOLATION';
          }
        } else if (!result.overlapPass) {
          conflictType = 'OVERLAP';
        } else if (!result.docValidityPass) {
          if (result.failReasons.some((r) => r.toLowerCase().includes('medical'))) {
            conflictType = 'MEDICAL_EXPIRED';
          } else {
            conflictType = 'LICENSE_EXPIRED';
          }
        } else if (!result.leavePass) {
          conflictType = 'LEAVE_CONFLICT';
        } else if (!result.blockHoursPass) {
          conflictType = 'FTL_EXCEEDED';
        } else if (!result.qualificationPass) {
          conflictType = 'QUALIFICATION_MISMATCH';
        }

        const description =
          result.failReasons.length > 0
            ? result.failReasons[0]
            : `Legality validation failure for ${member.name} on ${flight.flightNumber} (${flight.date})`;

        conflicts.push({
          id: conflictKey,
          flightId: flight.id,
          flightNumber: flight.flightNumber,
          flightDate: flight.date,
          aircraft: flight.aircraft,
          departure: flight.departure,
          arrival: flight.arrival,
          std: flight.std,
          sta: flight.sta,
          crewId: member.id,
          crewName: member.name,
          staffNumber: member.staffNumber,
          role: member.role,
          conflictType,
          severity,
          description,
          failReasons: result.failReasons.length > 0 ? result.failReasons : [description],
        });
      }
    });
  });

  const criticalCount = conflicts.filter((c) => c.severity === 'CRITICAL').length;
  const warningCount = conflicts.filter((c) => c.severity === 'WARNING').length;

  let summaryText = 'All generated roster assignments are 100% compliant with FTL and CAA legality rules.';
  if (criticalCount > 0) {
    summaryText = `${criticalCount} Critical FTL / Legality Conflict${criticalCount > 1 ? 's' : ''} detected across live roster pairings.`;
  }

  return {
    totalChecked,
    totalAssignments: assignments.length,
    criticalConflictCount: criticalCount,
    warningCount,
    conflicts,
    hasCriticalConflict: criticalCount > 0,
    summaryText,
  };
}

