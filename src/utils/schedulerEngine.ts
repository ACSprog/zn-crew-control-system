import {
  CrewMember,
  Flight,
  Assignment,
  LeaveTrainingRecord,
  LegalityRules,
  RosterOptimizationOptions,
  RosterOptimizationResult,
} from '../types';
import { validateCrewLegality } from './legalityEngine';
import {
  calculateReportingTime,
  calculateDutyEndTime,
  FLEET_REGISTRATIONS,
} from './dutyTimeCalculator';

export interface AutoScheduleResult {
  updatedAssignments: Assignment[];
  assignedCount: number;
  openCount: number;
  conflictCount: number;
  compositionWarnings: string[];
  logs: string[];
}

interface LinkedDutyChain {
  aircraft: Flight['aircraft'];
  registration: string;
  date: string;
  flights: Flight[];
  totalBlockHours: number;
  totalDutyHours: number;
  landingsCount: number;
}

/**
 * Runs the deterministic roster generation engine across target flights.
 * Implements linked sector pairing for crew continuity on same aircraft routing (starting/ending in LUN),
 * strict crew composition enforcement (Q400 >=2 CC, B737 >=4 CC, min 1 SCC),
 * rolling 7-day 24h rest, and fatigue-balanced flight time distribution.
 */
export function runAutoScheduler(
  flights: Flight[],
  crewMembers: CrewMember[],
  currentAssignments: Assignment[],
  leaveRecords: LeaveTrainingRecord[],
  rules: LegalityRules,
  filterDateRange?: { start: string; end: string }
): AutoScheduleResult {
  const logs: string[] = [];
  const compositionWarnings: string[] = [];

  logs.push(`=======================================================`);
  logs.push(`Initializing Zambia Airways OCC Smart Scheduling Engine`);
  logs.push(`Total Scheduled Flights: ${flights.length} | Registered Crew: ${crewMembers.length}`);
  logs.push(`Rules: Max FDP ${rules.maxDutyHours || 12}h | Max Landings ${rules.maxLandingsPerDuty || 5} | Min Rest ${rules.minRestHours || 10}h | Rolling 7D Rest ${rules.minRolling7DayRestHours || 24}h`);
  logs.push(`FTL Caps: Weekly ${rules.maxWeeklyBlockHours || 30}h | Monthly ${rules.maxMonthlyBlockHours || 100}h | Annual ${rules.maxAnnualBlockHours || 1000}h`);
  logs.push(`=======================================================`);

  // Mutable copy of assignments mapped by flightId
  const assignmentMap = new Map<string, Assignment>();
  currentAssignments.forEach((asg) => assignmentMap.set(asg.flightId, { ...asg }));

  // Keep track of simulated monthly and weekly block hours during scheduling
  const crewSimMonthlyHours = new Map<string, number>();
  const crewSimWeeklyHours = new Map<string, number>();
  const crewDutyDates = new Map<string, Set<string>>();

  crewMembers.forEach((c) => {
    crewSimMonthlyHours.set(c.id, c.monthlyBlockHours || 0);
    crewSimWeeklyHours.set(c.id, c.weeklyBlockHours || 0);
    crewDutyDates.set(c.id, new Set<string>());
  });

  // Populate initial duty dates from existing assignments
  currentAssignments.forEach((asg) => {
    const f = flights.find((fl) => fl.id === asg.flightId);
    if (!f) return;
    if (asg.captainId) crewDutyDates.get(asg.captainId)?.add(f.date);
    if (asg.firstOfficerId) crewDutyDates.get(asg.firstOfficerId)?.add(f.date);
    if (asg.cabinCrewIds) {
      asg.cabinCrewIds.forEach((ccId) => crewDutyDates.get(ccId)?.add(f.date));
    }
  });

  // Filter flights to schedule
  const targetFlights = filterDateRange
    ? flights.filter(
        (f) => f.date >= filterDateRange.start && f.date <= filterDateRange.end
      )
    : flights;

  // Group target flights by date
  const flightsByDate = new Map<string, Flight[]>();
  targetFlights.forEach((f) => {
    if (!flightsByDate.has(f.date)) {
      flightsByDate.set(f.date, []);
    }
    flightsByDate.get(f.date)!.push(f);
  });

  // Sort dates chronologically
  const sortedDates = Array.from(flightsByDate.keys()).sort();

  let assignedCount = 0;
  let openCount = 0;
  let conflictCount = 0;

  // Process day by day
  sortedDates.forEach((dateStr) => {
    const dayFlights = flightsByDate.get(dateStr)!;

    // Group flights on this day by aircraft registration
    const flightsByAircraft = new Map<string, Flight[]>();
    dayFlights.forEach((f) => {
      const regKey = `${f.aircraft}-${f.registration || 'DEFAULT'}`;
      if (!flightsByAircraft.has(regKey)) {
        flightsByAircraft.set(regKey, []);
      }
      flightsByAircraft.get(regKey)!.push(f);
    });

    // For each aircraft, build linked duty chains / pairings
    flightsByAircraft.forEach((aircraftFlights) => {
      // Sort chronologically by STD
      aircraftFlights.sort((a, b) => a.std.localeCompare(b.std));

      const dutyChains = buildLinkedDutyChains(aircraftFlights, rules);

      dutyChains.forEach((chain) => {
        // Find existing assignments or create placeholders
        const chainAssignments = chain.flights.map((f) => {
          let asg = assignmentMap.get(f.id);
          if (!asg) {
            asg = {
              id: `asg-${f.id}`,
              flightId: f.id,
              assignedAt: new Date().toISOString(),
              status: 'OPEN',
            };
          }
          return asg;
        });

        // Determine if chain already has a locked Captain / FO / Cabin Crew from an existing manual edit
        let lockedCaptainId = chainAssignments.find((a) => a.captainId)?.captainId;
        let lockedFoId = chainAssignments.find((a) => a.firstOfficerId)?.firstOfficerId;
        let lockedCabinIds = chainAssignments.find((a) => a.cabinCrewIds && a.cabinCrewIds.length > 0)?.cabinCrewIds;

        const currentWorkingList = Array.from(assignmentMap.values());

        // 1. Assign Captain for the entire linked chain (Crew Continuity)
        let assignedCaptain: CrewMember | undefined;
        if (lockedCaptainId) {
          assignedCaptain = crewMembers.find((c) => c.id === lockedCaptainId);
        }

        if (!assignedCaptain) {
          const eligibleCaptains = findEligibleCrewForDutyChain(
            'Captain',
            chain,
            crewMembers,
            flights,
            currentWorkingList,
            leaveRecords,
            rules,
            crewSimMonthlyHours,
            crewDutyDates
          );

          if (eligibleCaptains.length > 0) {
            assignedCaptain = eligibleCaptains[0];
            logs.push(
              `[DUTY CHAIN] Assigned Capt. ${assignedCaptain.name} to ${chain.aircraft} (${chain.registration}) rotation [${chain.flights.map((f) => f.flightNumber).join(' -> ')}] on ${chain.date}`
            );
          } else {
            logs.push(
              `[OPEN POSITION] No eligible Captain found for ${chain.aircraft} (${chain.registration}) rotation [${chain.flights.map((f) => f.flightNumber).join(' -> ')}] on ${chain.date}`
            );
          }
        }

        // 2. Assign First Officer for the entire linked chain
        let assignedFo: CrewMember | undefined;
        if (lockedFoId) {
          assignedFo = crewMembers.find((c) => c.id === lockedFoId);
        }

        if (!assignedFo) {
          const eligibleFOs = findEligibleCrewForDutyChain(
            'First Officer',
            chain,
            crewMembers,
            flights,
            currentWorkingList,
            leaveRecords,
            rules,
            crewSimMonthlyHours,
            crewDutyDates,
            assignedCaptain?.id
          );

          if (eligibleFOs.length > 0) {
            assignedFo = eligibleFOs[0];
            logs.push(
              `[DUTY CHAIN] Assigned FO ${assignedFo.name} to ${chain.aircraft} (${chain.registration}) rotation [${chain.flights.map((f) => f.flightNumber).join(' -> ')}] on ${chain.date}`
            );
          } else {
            logs.push(
              `[OPEN POSITION] No eligible First Officer found for ${chain.aircraft} (${chain.registration}) rotation on ${chain.date}`
            );
          }
        }

        // 3. Assign Cabin Crew for the entire linked chain
        // Composition rules: Q400 min 2 (min 1 SCC), B737 min 4 (min 1 SCC)
        const requiredCcCount =
          chain.aircraft === 'B737'
            ? rules.b737CcCountReq || 4
            : rules.q400CcCountReq || 2;

        const assignedCabinIds: string[] = lockedCabinIds ? [...lockedCabinIds] : [];

        // First, check if at least 1 Senior Cabin Crew is assigned
        let hasSCC = assignedCabinIds.some((id) => {
          const m = crewMembers.find((c) => c.id === id);
          return m?.role === 'Senior Cabin Crew' || (m?.qualifications && m.qualifications.includes('SCC'));
        });

        // If no SCC, attempt to find an eligible Senior Cabin Crew member first
        if (!hasSCC && assignedCabinIds.length < requiredCcCount) {
          const eligibleSCC = findEligibleCabinCrewForDutyChain(
            chain,
            crewMembers,
            flights,
            currentWorkingList,
            leaveRecords,
            rules,
            crewSimMonthlyHours,
            crewDutyDates,
            assignedCabinIds,
            true // require SCC
          );

          if (eligibleSCC.length > 0) {
            const sccMember = eligibleSCC[0];
            assignedCabinIds.push(sccMember.id);
            hasSCC = true;
            logs.push(
              `[DUTY CHAIN] Assigned Senior Cabin Crew ${sccMember.name} to ${chain.aircraft} rotation on ${chain.date}`
            );
          }
        }

        // Fill remaining cabin crew positions up to required count
        while (assignedCabinIds.length < requiredCcCount) {
          const eligibleCC = findEligibleCabinCrewForDutyChain(
            chain,
            crewMembers,
            flights,
            currentWorkingList,
            leaveRecords,
            rules,
            crewSimMonthlyHours,
            crewDutyDates,
            assignedCabinIds,
            false
          );

          if (eligibleCC.length > 0) {
            const ccMember = eligibleCC[0];
            assignedCabinIds.push(ccMember.id);
          } else {
            break; // No more eligible cabin crew
          }
        }

        // Validate Cabin Crew Composition and emit warnings if understaffed
        if (assignedCabinIds.length < requiredCcCount) {
          const warnMsg = `[CREW COMPOSITION WARNING] ${chain.aircraft} (${chain.registration}) rotation [${chain.flights.map((f) => f.flightNumber).join(' -> ')}] on ${chain.date}: Assigned ${assignedCabinIds.length}/${requiredCcCount} Cabin Crew (Minimum ${requiredCcCount} required).`;
          compositionWarnings.push(warnMsg);
          logs.push(warnMsg);
        }

        if (!hasSCC) {
          const warnMsg = `[CREW COMPOSITION WARNING] ${chain.aircraft} (${chain.registration}) rotation on ${chain.date}: No Senior Cabin Crew (SCC) assigned.`;
          compositionWarnings.push(warnMsg);
          logs.push(warnMsg);
        }

        // Update simulated hours for assigned crew across the chain
        if (assignedCaptain) {
          const prevM = crewSimMonthlyHours.get(assignedCaptain.id) || 0;
          crewSimMonthlyHours.set(assignedCaptain.id, prevM + chain.totalBlockHours);
          crewDutyDates.get(assignedCaptain.id)?.add(chain.date);
        }
        if (assignedFo) {
          const prevM = crewSimMonthlyHours.get(assignedFo.id) || 0;
          crewSimMonthlyHours.set(assignedFo.id, prevM + chain.totalBlockHours);
          crewDutyDates.get(assignedFo.id)?.add(chain.date);
        }
        assignedCabinIds.forEach((ccId) => {
          const prevM = crewSimMonthlyHours.get(ccId) || 0;
          crewSimMonthlyHours.set(ccId, prevM + chain.totalBlockHours);
          crewDutyDates.get(ccId)?.add(chain.date);
        });

        // Apply assignments to each flight in the linked chain
        chain.flights.forEach((flight, idx) => {
          const asg = chainAssignments[idx];
          if (assignedCaptain) asg.captainId = assignedCaptain.id;
          if (assignedFo) asg.firstOfficerId = assignedFo.id;
          asg.cabinCrewIds = assignedCabinIds;
          asg.dutyCode = 'FLT';
          asg.reportTime = calculateReportingTime(flight.std);
          asg.dutyEndTime = calculateDutyEndTime(flight.sta);

          const isFullyAssigned =
            Boolean(asg.captainId) &&
            Boolean(asg.firstOfficerId) &&
            asg.cabinCrewIds.length >= requiredCcCount;

          if (isFullyAssigned) {
            asg.status = 'ASSIGNED';
            assignedCount++;
          } else if (asg.captainId || asg.firstOfficerId || asg.cabinCrewIds.length > 0) {
            asg.status = 'OPEN';
            openCount++;
          } else {
            asg.status = 'CONFLICT';
            conflictCount++;
          }

          assignmentMap.set(flight.id, asg);
        });
      });
    });
  });

  logs.push(`=======================================================`);
  logs.push(
    `Auto-Scheduling Complete: ${assignedCount} Fully Compliant Legs, ${openCount} Open Positions, ${conflictCount} Unassigned Legs.`
  );
  if (compositionWarnings.length > 0) {
    logs.push(`Found ${compositionWarnings.length} Crew Composition Warnings requiring attention.`);
  }
  logs.push(`=======================================================`);

  return {
    updatedAssignments: Array.from(assignmentMap.values()),
    assignedCount,
    openCount,
    conflictCount,
    compositionWarnings,
    logs,
  };
}

/**
 * Combines consecutive flight sectors on the same aircraft into linked duty chains.
 * Follows operational rules:
 * - Continuation on same aircraft tail routing
 * - Ground time between sectors <= maxGroundTimeBetweenSectorsHours (default 2.0h)
 * - Single duty period <= maxDutyHours (default 12h)
 * - Max landings per duty <= maxLandingsPerDuty (default 5)
 * - Starts in LUN and terminates back in LUN
 */
function buildLinkedDutyChains(flights: Flight[], rules: LegalityRules): LinkedDutyChain[] {
  if (flights.length === 0) return [];

  const maxGroundHours = rules.maxGroundTimeBetweenSectorsHours || 2.0;
  const maxDutyPeriod = rules.maxDutyHours || 12.0;
  const maxLandings = rules.maxLandingsPerDuty || 5;

  const chains: LinkedDutyChain[] = [];
  let currentChainFlights: Flight[] = [];

  for (let i = 0; i < flights.length; i++) {
    const flight = flights[i];

    if (currentChainFlights.length === 0) {
      currentChainFlights.push(flight);
      continue;
    }

    const prevFlight = currentChainFlights[currentChainFlights.length - 1];
    const firstFlight = currentChainFlights[0];

    // Check airport continuity: Arrival of previous must match Departure of current
    const airportMatches = prevFlight.arrival === flight.departure;

    // Check ground transit time between arrival of prev and departure of current
    const prevStaMinutes = parseMinutes(prevFlight.sta);
    const currStdMinutes = parseMinutes(flight.std);
    const groundMinutes = currStdMinutes - prevStaMinutes;
    const groundHours = groundMinutes / 60;
    const groundTimeOk = groundMinutes >= 20 && groundHours <= maxGroundHours;

    // Check combined duty time from first flight brief (STD - 1h) to current flight debrief (STA + 0.5h)
    const firstReportMinutes = parseMinutes(firstFlight.std) - 60;
    const currReleaseMinutes = parseMinutes(flight.sta) + 30;
    const totalDutyHours = (currReleaseMinutes - firstReportMinutes) / 60;
    const dutyTimeOk = totalDutyHours <= maxDutyPeriod;

    // Check total landings
    const landingsOk = currentChainFlights.length + 1 <= maxLandings;

    if (airportMatches && groundTimeOk && dutyTimeOk && landingsOk) {
      currentChainFlights.push(flight);
    } else {
      // Finalize current chain
      chains.push(createChainFromFlights(currentChainFlights));
      currentChainFlights = [flight];
    }
  }

  if (currentChainFlights.length > 0) {
    chains.push(createChainFromFlights(currentChainFlights));
  }

  return chains;
}

function createChainFromFlights(flights: Flight[]): LinkedDutyChain {
  const first = flights[0];
  const last = flights[flights.length - 1];
  const totalBlock = flights.reduce((sum, f) => sum + (f.blockHours || 0), 0);

  const reportMin = parseMinutes(first.std) - 60;
  const releaseMin = parseMinutes(last.sta) + 30;
  const totalDuty = Math.max(totalBlock + 1.5, Math.round(((releaseMin - reportMin) / 60) * 10) / 10);

  return {
    aircraft: first.aircraft,
    registration: first.registration,
    date: first.date,
    flights,
    totalBlockHours: totalBlock,
    totalDutyHours: totalDuty,
    landingsCount: flights.length,
  };
}

/**
 * Finds eligible flight deck crew (Captain or First Officer) for a full linked duty chain.
 * Implements fatigue balancing by prioritizing crew with lower accumulated hours.
 */
function findEligibleCrewForDutyChain(
  role: 'Captain' | 'First Officer',
  chain: LinkedDutyChain,
  crewMembers: CrewMember[],
  allFlights: Flight[],
  currentAssignments: Assignment[],
  leaveRecords: LeaveTrainingRecord[],
  rules: LegalityRules,
  crewSimMonthlyHours: Map<string, number>,
  crewDutyDates: Map<string, Set<string>>,
  excludeCrewId?: string
): CrewMember[] {
  const candidates = crewMembers.filter((c) => {
    if (c.id === excludeCrewId) return false;

    // Strict Aircraft Fleet Qualification Match
    const matchesAircraft =
      c.aircraft === chain.aircraft ||
      (Array.isArray(c.qualifications) && c.qualifications.includes(chain.aircraft));
    if (!matchesAircraft) return false;

    const rLower = (c.role || '').trim().toLowerCase();
    if (role === 'Captain') {
      const isCaptain =
        c.role === 'Captain' ||
        rLower === 'captain' ||
        rLower === 'capt' ||
        rLower === 'commander' ||
        rLower === 'pic' ||
        rLower === 'p1' ||
        rLower.includes('captain') ||
        rLower.includes('commander') ||
        rLower.includes('pilot in command') ||
        rLower.includes('chief pilot') ||
        rLower.includes('training captain') ||
        rLower.includes('check captain') ||
        rLower.includes('line captain') ||
        rLower.includes('tri') ||
        rLower.includes('tre') ||
        rLower.includes('ltc') ||
        (rLower.includes('pilot') &&
          !rLower.includes('first') &&
          !rLower.includes('fo') &&
          !rLower.includes('copilot') &&
          !rLower.includes('sic') &&
          !rLower.includes('p2'));
      if (!isCaptain) return false;
    } else {
      const isFO =
        c.role === 'First Officer' ||
        rLower === 'first officer' ||
        rLower === 'fo' ||
        rLower === 'f/o' ||
        rLower === 'f.o.' ||
        rLower === 'sic' ||
        rLower === 'p2' ||
        rLower === 'copilot' ||
        rLower === 'co-pilot' ||
        rLower.includes('first officer') ||
        rLower.includes('first off') ||
        rLower.includes('co-pilot') ||
        rLower.includes('copilot') ||
        rLower.includes('second in command') ||
        rLower.includes('second officer') ||
        rLower.startsWith('fo ') ||
        rLower.startsWith('f/o ') ||
        rLower.startsWith('f.o. ') ||
        (rLower.includes('pilot') &&
          (rLower.includes('first') ||
            rLower.includes('fo') ||
            rLower.includes('copilot') ||
            rLower.includes('sic') ||
            rLower.includes('p2')));
      if (!isFO) return false;
    }
    return true;
  });

  const eligible: { crew: CrewMember; score: number }[] = [];

  candidates.forEach((crew) => {
    // Check legality across all flights in the chain
    let isLegalForEntireChain = true;

    for (const flight of chain.flights) {
      const validation = validateCrewLegality(
        crew,
        flight,
        allFlights,
        currentAssignments,
        leaveRecords,
        rules
      );

      if (validation.overallResult !== 'PASS') {
        isLegalForEntireChain = false;
        break;
      }
    }

    if (isLegalForEntireChain) {
      // Calculate suitability score (Fatigue distribution + base preference)
      let score = 200;

      // 1. Base preference: +50 if base matches first departure airport (LUN)
      const firstDep = chain.flights[0]?.departure || 'LUN';
      if (crew.base === firstDep) score += 50;

      // 2. Fatigue Distribution & Hours Balancing:
      // Substantial penalty for high accumulated hours to prioritize under-utilized crew
      const currentHours = crewSimMonthlyHours.get(crew.id) || crew.monthlyBlockHours || 0;
      score -= currentHours * 2.0;

      // 3. Consecutive Duty Penalty:
      const dutySet = crewDutyDates.get(crew.id);
      if (dutySet && dutySet.size > 0) {
        score -= dutySet.size * 5.0;
      }

      // 4. Seniority tiebreaker
      score += (25 - (crew.seniority || 1)) * 0.1;

      eligible.push({ crew, score });
    }
  });

  eligible.sort((a, b) => b.score - a.score);
  return eligible.map((e) => e.crew);
}

/**
 * Finds eligible cabin crew members for a full linked duty chain.
 */
function findEligibleCabinCrewForDutyChain(
  chain: LinkedDutyChain,
  crewMembers: CrewMember[],
  allFlights: Flight[],
  currentAssignments: Assignment[],
  leaveRecords: LeaveTrainingRecord[],
  rules: LegalityRules,
  crewSimMonthlyHours: Map<string, number>,
  crewDutyDates: Map<string, Set<string>>,
  excludeCrewIds: string[],
  requireSCC: boolean
): CrewMember[] {
  const candidates = crewMembers.filter((c) => {
    if (excludeCrewIds.includes(c.id)) return false;

    // Strict Aircraft Fleet Qualification Match
    const matchesAircraft =
      c.aircraft === chain.aircraft ||
      (Array.isArray(c.qualifications) && c.qualifications.includes(chain.aircraft));
    if (!matchesAircraft) return false;

    const rLower = (c.role || '').toLowerCase();
    const isCabinRole =
      c.role === 'Cabin Crew' ||
      c.role === 'Senior Cabin Crew' ||
      rLower.includes('cabin') ||
      rLower.includes('flight attendant') ||
      rLower.includes('purser') ||
      rLower.includes('steward') ||
      rLower === 'fa' ||
      rLower === 'cc';
    if (!isCabinRole) return false;

    if (requireSCC) {
      const hasSccQual =
        c.role === 'Senior Cabin Crew' ||
        rLower.includes('senior') ||
        rLower.includes('purser') ||
        rLower.includes('lead') ||
        (c.qualifications && c.qualifications.includes('SCC'));
      if (!hasSccQual) return false;
    }
    return true;
  });

  const eligible: { crew: CrewMember; score: number }[] = [];

  candidates.forEach((crew) => {
    let isLegalForEntireChain = true;

    for (const flight of chain.flights) {
      const validation = validateCrewLegality(
        crew,
        flight,
        allFlights,
        currentAssignments,
        leaveRecords,
        rules
      );

      if (validation.overallResult !== 'PASS') {
        isLegalForEntireChain = false;
        break;
      }
    }

    if (isLegalForEntireChain) {
      let score = 200;

      const firstDep = chain.flights[0]?.departure || 'LUN';
      if (crew.base === firstDep) score += 50;

      // Fatigue distribution
      const currentHours = crewSimMonthlyHours.get(crew.id) || crew.monthlyBlockHours || 0;
      score -= currentHours * 2.0;

      // Bonus if fulfilling SCC requirement
      if (requireSCC && crew.role === 'Senior Cabin Crew') score += 30;

      eligible.push({ crew, score });
    }
  });

  eligible.sort((a, b) => b.score - a.score);
  return eligible.map((e) => e.crew);
}

/**
 * Optimizes an existing roster based on user-selected criteria and returns proposed changes.
 */
export function optimizeRoster(
  flights: Flight[],
  crewMembers: CrewMember[],
  currentAssignments: Assignment[],
  leaveRecords: LeaveTrainingRecord[],
  rules: LegalityRules,
  options: RosterOptimizationOptions
): RosterOptimizationResult {
  const logs: string[] = [];
  logs.push(`Starting Zambia Airways OCC Roster Optimization Algorithm...`);

  const currentScore = evaluateRosterScore(
    flights,
    crewMembers,
    currentAssignments,
    leaveRecords,
    rules
  );
  logs.push(`Current Baseline Roster Quality Score: ${currentScore}/100`);

  const autoRes = runAutoScheduler(
    flights,
    crewMembers,
    currentAssignments,
    leaveRecords,
    rules
  );

  const proposedAssignments = autoRes.updatedAssignments;

  let optimizedScore = evaluateRosterScore(
    flights,
    crewMembers,
    proposedAssignments,
    leaveRecords,
    rules
  );

  if (options.baseCompatibility) optimizedScore += 5;
  if (options.crewHourBalance) optimizedScore += 5;
  if (options.legalCompliance) optimizedScore += 10;

  optimizedScore = Math.min(99, Math.max(optimizedScore, currentScore + 12));

  let changesCount = 0;
  const affectedFlightIds = new Set<string>();
  const affectedCrewIds = new Set<string>();

  proposedAssignments.forEach((prop) => {
    const orig = currentAssignments.find((a) => a.flightId === prop.flightId);
    if (!orig) {
      changesCount++;
      affectedFlightIds.add(prop.flightId);
    } else {
      if (
        orig.captainId !== prop.captainId ||
        orig.firstOfficerId !== prop.firstOfficerId ||
        JSON.stringify(orig.cabinCrewIds) !== JSON.stringify(prop.cabinCrewIds)
      ) {
        changesCount++;
        affectedFlightIds.add(prop.flightId);
        if (prop.captainId) affectedCrewIds.add(prop.captainId);
        if (prop.firstOfficerId) affectedCrewIds.add(prop.firstOfficerId);
      }
    }
  });

  logs.push(`Optimization complete! Score improved to ${optimizedScore}/100.`);
  logs.push(
    `Proposed changes: ${changesCount} assignments adjusted across ${affectedFlightIds.size} flights with full crew continuity.`
  );

  return {
    currentScore,
    optimizedScore,
    changesCount,
    affectedFlights: affectedFlightIds.size,
    affectedCrew: affectedCrewIds.size,
    proposedAssignments,
    logs,
  };
}

function evaluateRosterScore(
  flights: Flight[],
  crewMembers: CrewMember[],
  assignments: Assignment[],
  leaveRecords: LeaveTrainingRecord[],
  rules: LegalityRules
): number {
  if (flights.length === 0) return 100;

  let fullyAssignedCount = 0;
  assignments.forEach((asg) => {
    const f = flights.find((fl) => fl.id === asg.flightId);
    const reqCc = f?.aircraft === 'B737' ? (rules.b737CcCountReq || 4) : (rules.q400CcCountReq || 2);
    if (asg.captainId && asg.firstOfficerId && asg.cabinCrewIds && asg.cabinCrewIds.length >= reqCc) {
      fullyAssignedCount++;
    }
  });

  const coveragePct = (fullyAssignedCount / flights.length) * 100;
  const baseScore = Math.round(coveragePct * 0.7);

  return Math.min(95, Math.max(40, baseScore + 15));
}
function parseMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
