/**
 * Pilot recency (currency) calculated from real roster data.
 *
 * Rule implemented: a pilot must have made at least 3 take-offs and 3
 * landings in the preceding 90 days. Each sector a pilot is rostered on as
 * Captain or First Officer, on a flight dated on/before today and not
 * cancelled, counts as 1 take-off + 1 landing (whichever pilot actually
 * flew the leg is not recorded, so this is the conservative-for-planning
 * "rostered sectors" count; manual entries can be added on the crew record).
 */
import type { Assignment, CrewMember, Flight } from '../types';

export const RECENCY_WINDOW_DAYS = 90;
export const RECENCY_REQUIRED_LANDINGS = 3;

export interface RecencyResult {
  crewId: string;
  landings90: number;
  takeoffs90: number;
  lastFlightNumber: string | null;
  lastFlightDate: string | null;
  /** Days until recency lapses (counted from the 3rd most recent landing). 0 if not current. */
  daysRemaining: number;
  /** Date the pilot stops being current if no more sectors are flown. */
  lapsesOn: string | null;
  isCurrent: boolean;
  manualLandings: number;
}

const DAY = 24 * 3600 * 1000;

function dayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function computePilotRecency(
  crew: CrewMember,
  flights: Flight[],
  assignments: Assignment[],
  now: Date = new Date()
): RecencyResult {
  const today = dayOnly(now);
  const windowStart = new Date(today.getTime() - RECENCY_WINDOW_DAYS * DAY);
  const flightById = new Map(flights.map((f) => [f.id, f]));

  const sectors: Flight[] = [];
  for (const a of assignments) {
    if (a.captainId !== crew.id && a.firstOfficerId !== crew.id) continue;
    const f = flightById.get(a.flightId);
    if (!f || !f.date) continue;
    if (String(f.status || '').toUpperCase() === 'CANCELLED') continue;
    const d = new Date(f.date + 'T00:00:00Z');
    if (isNaN(d.getTime()) || d > today || d < windowStart) continue;
    sectors.push(f);
  }
  sectors.sort((x, y) => (x.date + x.std < y.date + y.std ? 1 : -1)); // newest first

  // Manual landings (e.g. simulator recency) entered on the crew record are
  // only trusted while their entry date is inside the window.
  const manualDate = crew.recencyManualDate ? new Date(crew.recencyManualDate + 'T00:00:00Z') : null;
  const manualLandings =
    manualDate && !isNaN(manualDate.getTime()) && manualDate >= windowStart && manualDate <= today
      ? Math.max(0, crew.recencyManualLandings || 0)
      : 0;

  const landings90 = sectors.length + manualLandings;

  // Dates of every landing, newest first, to find when currency lapses.
  const landingDates: Date[] = sectors.map((f) => new Date(f.date + 'T00:00:00Z'));
  for (let i = 0; i < manualLandings && manualDate; i++) landingDates.push(manualDate);
  landingDates.sort((a, b) => b.getTime() - a.getTime());

  const isCurrent = landings90 >= RECENCY_REQUIRED_LANDINGS;
  let daysRemaining = 0;
  let lapsesOn: string | null = null;
  if (isCurrent) {
    const third = landingDates[RECENCY_REQUIRED_LANDINGS - 1];
    const lapse = new Date(third.getTime() + RECENCY_WINDOW_DAYS * DAY);
    daysRemaining = Math.max(0, Math.round((lapse.getTime() - today.getTime()) / DAY));
    lapsesOn = lapse.toISOString().slice(0, 10);
  }

  return {
    crewId: crew.id,
    landings90,
    takeoffs90: landings90,
    lastFlightNumber: sectors[0]?.flightNumber ?? null,
    lastFlightDate: sectors[0]?.date ?? null,
    daysRemaining,
    lapsesOn,
    isCurrent,
    manualLandings,
  };
}

export function isPilot(crew: CrewMember): boolean {
  return crew.role === 'Captain' || crew.role === 'First Officer';
}
