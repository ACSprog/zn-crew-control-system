export type DutyCode =
  | 'FLT' // Flight Duty
  | 'STBY' // Airport Standby
  | 'SBH' // Standby at Home
  | 'RES' // Reserve Duty
  | 'OFC' // Office / Ground Duties
  | 'TRNG' // Ground / Recurrent Training
  | 'VAC' // Vacation / Annual Leave
  | 'SCK' // Sick Leave
  | 'GDO' // Guaranteed Day Off
  | 'DH' // Deadhead / Positioning
  | 'SIM' // Simulator / IR Check
  | 'CHK'; // Line Check / Evaluation

export interface DutyCodeInfo {
  code: DutyCode;
  name: string;
  category: 'FLIGHT' | 'STANDBY' | 'TRAINING' | 'GROUND' | 'REST' | 'LEAVE';
  description: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  countsAsDuty: boolean;
  countsAsFlightTime: boolean;
}

export const DUTY_CODES_MAP: Record<DutyCode, DutyCodeInfo> = {
  FLT: {
    code: 'FLT',
    name: 'Flight Duty',
    category: 'FLIGHT',
    description: 'Active operating flight sector duty',
    badgeBg: 'bg-blue-600',
    badgeText: 'text-white',
    borderColor: 'border-blue-700',
    countsAsDuty: true,
    countsAsFlightTime: true,
  },
  STBY: {
    code: 'STBY',
    name: 'Airport Standby',
    category: 'STANDBY',
    description: 'Airport-based ready standby (max 4-6h)',
    badgeBg: 'bg-amber-500',
    badgeText: 'text-slate-900',
    borderColor: 'border-amber-600',
    countsAsDuty: true,
    countsAsFlightTime: false,
  },
  SBH: {
    code: 'SBH',
    name: 'Standby at Home',
    category: 'STANDBY',
    description: 'Home standby with 90-minute report callout',
    badgeBg: 'bg-orange-500',
    badgeText: 'text-white',
    borderColor: 'border-orange-600',
    countsAsDuty: false,
    countsAsFlightTime: false,
  },
  RES: {
    code: 'RES',
    name: 'Reserve Duty',
    category: 'STANDBY',
    description: 'Operational reserve coverage window',
    badgeBg: 'bg-amber-600',
    badgeText: 'text-white',
    borderColor: 'border-amber-700',
    countsAsDuty: false,
    countsAsFlightTime: false,
  },
  OFC: {
    code: 'OFC',
    name: 'Office / Ground Duty',
    category: 'GROUND',
    description: 'Administrative, management or flight ops office duties',
    badgeBg: 'bg-slate-600',
    badgeText: 'text-white',
    borderColor: 'border-slate-700',
    countsAsDuty: true,
    countsAsFlightTime: false,
  },
  TRNG: {
    code: 'TRNG',
    name: 'Ground Training',
    category: 'TRAINING',
    description: 'Ground school, recurrent classroom or SEPT training',
    badgeBg: 'bg-indigo-600',
    badgeText: 'text-white',
    borderColor: 'border-indigo-700',
    countsAsDuty: true,
    countsAsFlightTime: false,
  },
  VAC: {
    code: 'VAC',
    name: 'Vacation / Annual Leave',
    category: 'LEAVE',
    description: 'Approved annual vacation leave',
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    borderColor: 'border-emerald-700',
    countsAsDuty: false,
    countsAsFlightTime: false,
  },
  SCK: {
    code: 'SCK',
    name: 'Sick Leave',
    category: 'LEAVE',
    description: 'Medical or illness absence',
    badgeBg: 'bg-rose-600',
    badgeText: 'text-white',
    borderColor: 'border-rose-700',
    countsAsDuty: false,
    countsAsFlightTime: false,
  },
  GDO: {
    code: 'GDO',
    name: 'Guaranteed Day Off',
    category: 'REST',
    description: 'Mandatory CAA rostered guaranteed day off',
    badgeBg: 'bg-teal-600',
    badgeText: 'text-white',
    borderColor: 'border-teal-700',
    countsAsDuty: false,
    countsAsFlightTime: false,
  },
  DH: {
    code: 'DH',
    name: 'Deadhead / Positioning',
    category: 'FLIGHT',
    description: 'Non-operating positioning crew travel',
    badgeBg: 'bg-purple-600',
    badgeText: 'text-white',
    borderColor: 'border-purple-700',
    countsAsDuty: true,
    countsAsFlightTime: false,
  },
  SIM: {
    code: 'SIM',
    name: 'Simulator / IR Check',
    category: 'TRAINING',
    description: 'Full-flight simulator training or recurrent check',
    badgeBg: 'bg-cyan-700',
    badgeText: 'text-white',
    borderColor: 'border-cyan-800',
    countsAsDuty: true,
    countsAsFlightTime: false,
  },
  CHK: {
    code: 'CHK',
    name: 'Line Check / Evaluation',
    category: 'TRAINING',
    description: 'Operational route evaluation or line proficiency check',
    badgeBg: 'bg-violet-600',
    badgeText: 'text-white',
    borderColor: 'border-violet-700',
    countsAsDuty: true,
    countsAsFlightTime: true,
  },
};

/**
 * Standard Tail Number Registrations bound to Fleet:
 * Boeing B737-700 -> 9J-ZAE
 * Dash 8-Q400     -> 9J-ZAW
 */
export const FLEET_REGISTRATIONS = {
  B737: '9J-ZAE',
  Q400: '9J-ZAW',
} as const;

export function getAircraftRegistration(aircraft: 'Q400' | 'B737', customReg?: string): string {
  if (customReg && customReg.trim() !== '') return customReg;
  return aircraft === 'B737' ? FLEET_REGISTRATIONS.B737 : FLEET_REGISTRATIONS.Q400;
}

/**
 * Calculates Reporting Time: Exactly 1 hour prior to Scheduled Time of Departure (STD - 01:00)
 * Example: '06:30' -> '05:30', '00:15' -> '23:15'
 */
export function calculateReportingTime(std: string): string {
  if (!std || !std.includes(':')) return '00:00';
  const [hStr, mStr] = std.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  if (isNaN(h) || isNaN(m)) return '00:00';

  h = h - 1;
  if (h < 0) {
    h = 24 + h; // wrap to previous day (e.g. 00:30 -> 23:30)
  }

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculates Duty End Time: Exactly 30 minutes after Scheduled Time of Arrival (STA + 00:30)
 * Example: '08:00' -> '08:30', '23:45' -> '00:15'
 */
export function calculateDutyEndTime(sta: string): string {
  if (!sta || !sta.includes(':')) return '00:00';
  const [hStr, mStr] = sta.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);

  if (isNaN(h) || isNaN(m)) return '00:00';

  m = m + 30;
  if (m >= 60) {
    h = h + Math.floor(m / 60);
    m = m % 60;
  }
  if (h >= 24) {
    h = h % 24;
  }

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculates total Flight Duty Period (FDP) in hours from report time to duty end time
 */
export function calculateFlightDutyPeriod(reportTime: string, dutyEndTime: string): number {
  if (!reportTime || !dutyEndTime) return 0;
  const [rH, rM] = reportTime.split(':').map((v) => parseInt(v, 10));
  const [eH, eM] = dutyEndTime.split(':').map((v) => parseInt(v, 10));

  let startMinutes = rH * 60 + rM;
  let endMinutes = eH * 60 + eM;

  if (endMinutes < startMinutes) {
    // Crosses midnight
    endMinutes += 24 * 60;
  }

  const diffHours = (endMinutes - startMinutes) / 60;
  return Math.round(diffHours * 10) / 10;
}
