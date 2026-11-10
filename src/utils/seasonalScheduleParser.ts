import { Flight, AircraftType } from '../types';

export interface SeasonalFlightPattern {
  id?: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  std: string; // HH:mm
  sta: string; // HH:mm
  daysOfOperation: string; // e.g. "1234567", "1,3,5", "Mon, Wed, Fri", "Daily", "1357"
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string; // YYYY-MM-DD
  aircraft: AircraftType;
  registration?: string;
  blockHours?: number;
  remarks?: string;
}

/**
 * Normalizes day-of-week frequency strings into an array of ISO day numbers (1 = Monday ... 7 = Sunday)
 */
export function parseDaysOfOperation(daysStr: string | number): number[] {
  if (daysStr === undefined || daysStr === null) return [1, 2, 3, 4, 5, 6, 7];
  const str = String(daysStr).trim().toLowerCase();
  if (!str) return [1, 2, 3, 4, 5, 6, 7];

  if (str === 'daily' || str === 'all' || str === '1234567' || str === '7 days' || str === 'd') {
    return [1, 2, 3, 4, 5, 6, 7];
  }

  const daysSet = new Set<number>();

  // Check if string contains standard digit sequence with dots or numbers like "1.3.5.7", "1234567", "1,3,5"
  if (/^[1-7\s,.-]+$/.test(str)) {
    for (const ch of str) {
      const num = parseInt(ch, 10);
      if (num >= 1 && num <= 7) {
        daysSet.add(num);
      }
    }
    if (daysSet.size > 0) return Array.from(daysSet).sort((a, b) => a - b);
  }

  // Handle textual day names like Mon, Tue, Wednesday, etc.
  if (str.includes('mon') || str.includes('mo')) daysSet.add(1);
  if (str.includes('tue') || str.includes('tu')) daysSet.add(2);
  if (str.includes('wed') || str.includes('we')) daysSet.add(3);
  if (str.includes('thu') || str.includes('th')) daysSet.add(4);
  if (str.includes('fri') || str.includes('fr')) daysSet.add(5);
  if (str.includes('sat') || str.includes('sa')) daysSet.add(6);
  if (str.includes('sun') || str.includes('su')) daysSet.add(7);

  if (str.includes('weekday') || str.includes('mon-fri') || str.includes('mon to fri')) {
    [1, 2, 3, 4, 5].forEach((d) => daysSet.add(d));
  }
  if (str.includes('weekend') || str.includes('sat-sun') || str.includes('sat and sun')) {
    [6, 7].forEach((d) => daysSet.add(d));
  }

  // Exception handling like "daily except sat"
  if (str.includes('except') || str.includes('exc') || str.includes('ex')) {
    const all = [1, 2, 3, 4, 5, 6, 7];
    if (str.includes('sat')) return all.filter((d) => d !== 6);
    if (str.includes('sun')) return all.filter((d) => d !== 7);
    if (str.includes('tue')) return all.filter((d) => d !== 2);
  }

  return daysSet.size > 0 ? Array.from(daysSet).sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6, 7];
}

/**
 * Normalizes time formats (e.g. "6:00", "0600", "600", "16:20", "1620") into "HH:mm"
 */
export function normalizeTimeStr(t: any, defaultTime = '08:00'): string {
  if (!t) return defaultTime;
  let str = String(t).trim();
  if (!str) return defaultTime;

  // "06:00" or "6:00"
  if (str.includes(':')) {
    const parts = str.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // "0600" or "600" or "1620"
  const digits = str.replace(/\D/g, '');
  if (digits.length === 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  } else if (digits.length === 3) {
    return `0${digits.slice(0, 1)}:${digits.slice(1, 3)}`;
  } else if (digits.length === 1 || digits.length === 2) {
    return `${digits.padStart(2, '0')}:00`;
  }

  return defaultTime;
}

/**
 * Normalizes dates (e.g. "8/1/2026", "01/08/2026", "2026-08-01", "01-Aug-2026") into "YYYY-MM-DD"
 */
export function normalizeDateStr(d: any, defaultDate = '2026-08-01'): string {
  if (!d) return defaultDate;
  const str = String(d).trim();
  if (!str) return defaultDate;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Handle M/D/YYYY or D/M/YYYY
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      let p1 = parseInt(parts[0], 10);
      let p2 = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;

      // Check if p1 > 12 -> it is D/M/YYYY
      if (p1 > 12 && p2 <= 12) {
        return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
      } else {
        // Standard M/D/YYYY
        return `${y}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
      }
    }
  }

  // Handle D-MMM-YYYY (e.g. 01-Aug-2026 or 1-Aug-2026)
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const partsHyphen = str.split('-');
  if (partsHyphen.length === 3) {
    const day = partsHyphen[0].padStart(2, '0');
    const monStr = partsHyphen[1].toLowerCase().slice(0, 3);
    const yr = partsHyphen[2].length === 2 ? `20${partsHyphen[2]}` : partsHyphen[2];
    if (monthMap[monStr]) {
      return `${yr}-${monthMap[monStr]}-${day}`;
    }
  }

  try {
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) {
      return dt.toISOString().split('T')[0];
    }
  } catch {
    // fallback
  }

  return defaultDate;
}

/**
 * Calculates block hours from STD and STA
 */
export function calculateBlockHours(std: string, sta: string): number {
  const [h1, m1] = std.split(':').map((x) => parseInt(x, 10) || 0);
  const [h2, m2] = sta.split(':').map((x) => parseInt(x, 10) || 0);

  let depMin = h1 * 60 + m1;
  let arrMin = h2 * 60 + m2;
  if (arrMin < depMin) {
    arrMin += 24 * 60; // Next day arrival
  }
  const diffMin = arrMin - depMin;
  const hours = diffMin / 60;
  return parseFloat(hours.toFixed(2));
}

/**
 * Expands a list of seasonal patterns into individual operational flight instances
 */
export function generateFlightsFromSeasonalPatterns(
  patterns: SeasonalFlightPattern[],
  customRange?: { start: string; end: string }
): Flight[] {
  const generated: Flight[] = [];
  const flightKeySet = new Set<string>();

  patterns.forEach((pattern, patternIdx) => {
    const startDateStr = customRange?.start || pattern.effectiveFrom || '2026-08-01';
    const endDateStr = customRange?.end || pattern.effectiveTo || '2026-08-31';

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

    const opDays = parseDaysOfOperation(pattern.daysOfOperation);
    const std = normalizeTimeStr(pattern.std, '08:00');
    const sta = normalizeTimeStr(pattern.sta, '09:30');
    const blockHours = pattern.blockHours || calculateBlockHours(std, sta) || 1.25;
    const aircraft = pattern.aircraft || (pattern.flightNumber.includes('50') || pattern.flightNumber.includes('73') ? 'B737' : 'Q400');
    const registration = pattern.registration || (aircraft === 'B737' ? '9J-ZAE' : '9J-ZAW');

    const curr = new Date(startDate);
    while (curr <= endDate) {
      // getDay() gives 0 for Sun, 1 for Mon ... 6 for Sat.
      // ISO day: 1 = Mon ... 7 = Sun
      const dayNum = curr.getDay() === 0 ? 7 : curr.getDay();

      if (opDays.includes(dayNum)) {
        const dateStr = curr.toISOString().split('T')[0];
        const uniqueKey = `${pattern.flightNumber.toUpperCase()}_${dateStr}_${pattern.departure.toUpperCase()}`;

        if (!flightKeySet.has(uniqueKey)) {
          flightKeySet.add(uniqueKey);

          generated.push({
            id: `flt-gen-${Date.now()}-${patternIdx}-${generated.length}`,
            flightNumber: pattern.flightNumber.toUpperCase().replace(/\s+/g, ''),
            date: dateStr,
            aircraft,
            registration,
            departure: pattern.departure.toUpperCase().trim(),
            arrival: pattern.arrival.toUpperCase().trim(),
            std,
            sta,
            blockHours,
            status: 'SCHEDULED',
            remarks: pattern.remarks || 'Generated from Commercial Seasonal Flight Schedule',
          });
        }
      }

      curr.setDate(curr.getDate() + 1);
    }
  });

  // Sort chronologically by date and STD
  return generated.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.std.localeCompare(b.std);
  });
}

/**
 * Intelligent Day Column Parser (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)
 * Supports "Yes", "No", "Y", "N", "1", "0", "True", "False", "X", etc.
 */
export function extractDaysFromDayColumns(row: any): number[] | null {
  const dayNames = [
    { num: 1, keys: ['monday', 'mon', 'mo', 'm', 'day 1', 'd1'] },
    { num: 2, keys: ['tuesday', 'tue', 'tu', 't', 'day 2', 'd2'] },
    { num: 3, keys: ['wednesday', 'wed', 'we', 'w', 'day 3', 'd3'] },
    { num: 4, keys: ['thursday', 'thu', 'th', 'day 4', 'd4'] },
    { num: 5, keys: ['friday', 'fri', 'fr', 'f', 'day 5', 'd5'] },
    { num: 6, keys: ['saturday', 'sat', 'sa', 's', 'day 6', 'd6'] },
    { num: 7, keys: ['sunday', 'sun', 'su', 'day 7', 'd7'] },
  ];

  const rowKeys = Object.keys(row).map((k) => k.toLowerCase().trim());
  const hasAnyDayCol = dayNames.some((d) =>
    d.keys.some((k) => rowKeys.includes(k))
  );

  if (!hasAnyDayCol) return null; // Fallback to Days of Operation string if no day columns

  const activeDays: number[] = [];

  dayNames.forEach((d) => {
    for (const k of Object.keys(row)) {
      const lowerK = k.toLowerCase().trim();
      if (d.keys.includes(lowerK)) {
        const val = String(row[k] || '').trim().toLowerCase();
        if (
          val === 'yes' ||
          val === 'y' ||
          val === '1' ||
          val === 'true' ||
          val === 'x' ||
          val === '✓' ||
          val === 'active'
        ) {
          activeDays.push(d.num);
        }
        break;
      }
    }
  });

  return activeDays.sort((a, b) => a - b);
}

/**
 * Intelligent CSV / Excel Parser for both Seasonal & Daily Flight Schedules
 */
export function parseFlightScheduleData(
  rows: any[],
  targetSeasonRange?: { start: string; end: string }
): {
  isSeasonal: boolean;
  flights: Flight[];
  seasonalPatterns: SeasonalFlightPattern[];
  totalExpanded: number;
} {
  if (!rows || rows.length === 0) {
    return { isSeasonal: false, flights: [], seasonalPatterns: [], totalExpanded: 0 };
  }

  // Detect whether rows contain seasonal columns like 'Days of Operation', 'Monday'..'Sunday', 'Effective Date', 'Dis Date'
  const firstRow = rows[0];
  const keys = Object.keys(firstRow).map((k) => k.toLowerCase().trim());

  const hasDayColumns = keys.some(
    (k) =>
      k.includes('monday') ||
      k.includes('tuesday') ||
      k.includes('wednesday') ||
      k.includes('thursday') ||
      k.includes('friday') ||
      k.includes('saturday') ||
      k.includes('sunday')
  );

  const hasDaysOfOp = keys.some(
    (k) =>
      k.includes('day of operation') ||
      k.includes('day of op') ||
      k.includes('days of op') ||
      k.includes('frequency') ||
      k.includes('freq') ||
      k.includes('days') ||
      k.includes('operating days') ||
      k.includes('dop')
  );

  const hasEffectiveRange = keys.some(
    (k) =>
      k.includes('effective') ||
      k.includes('dis date') ||
      k.includes('discontinue') ||
      k.includes('start date') ||
      k.includes('from date') ||
      k.includes('valid from') ||
      k.includes('period') ||
      k.includes('season')
  );

  const isSeasonal = hasDayColumns || hasDaysOfOp || hasEffectiveRange;

  if (isSeasonal) {
    const patterns: SeasonalFlightPattern[] = [];

    rows.forEach((row, idx) => {
      const getVal = (possibleKeys: string[]) => {
        for (const pk of possibleKeys) {
          for (const k of Object.keys(row)) {
            if (k.toLowerCase().trim() === pk.toLowerCase().trim() && row[k] !== undefined && row[k] !== '') {
              return String(row[k]).trim();
            }
          }
        }
        return '';
      };

      const fn = getVal([
        'Flight No',
        'Flight No.',
        'Flight Number',
        'flightNumber',
        'FLIGHT NO',
        'Flight',
        'Flt No',
        'FlightNo',
      ]);
      // Skip empty or separator rows (e.g., ",,,,,,,,,,,,,,,")
      if (!fn || !fn.trim() || fn.trim() === '-' || fn.trim().toLowerCase() === 'undefined') {
        return;
      }

      const dep = (
        getVal(['Departure Station', 'Departure', 'Origin', 'DEP', 'From', 'Sector From', 'Dep Airport', 'Dep Station']) ||
        'LUN'
      ).toUpperCase();
      const arr = (
        getVal(['Arrival Station', 'Arrival', 'Destination', 'ARR', 'To', 'Sector To', 'Arr Airport', 'Arr Station']) ||
        'HRE'
      ).toUpperCase();
      const std = normalizeTimeStr(getVal(['STD', 'Departure Time', 'std', 'DEP Time', 'ETD']), '08:00');
      const sta = normalizeTimeStr(getVal(['STA', 'Arrival Time', 'sta', 'ARR Time', 'ETA']), '09:30');

      // Check day columns (Monday ... Sunday)
      const dayColNums = extractDaysFromDayColumns(row);
      let daysOfOp = '';
      if (dayColNums !== null) {
        // If day columns exist but none are active (all No), this pattern is inactive / suspended
        if (dayColNums.length === 0) {
          return; // Skip inactive pattern row
        }
        daysOfOp = dayColNums.join('');
      } else {
        daysOfOp =
          getVal([
            'Days of Operation',
            'Days of Op',
            'Day of Operation',
            'Frequency',
            'Freq',
            'Days',
            'Operating Days',
            'DOP',
          ]) || '1234567';
      }

      const effFromRaw = getVal([
        'Effective Date',
        'Effective From',
        'Start Date',
        'From Date',
        'Valid From',
        'Eff From',
        'Eff Date',
        'Season Start',
      ]) || '11-Apr-2026';

      const effToRaw = getVal([
        'Dis Date',
        'Discontinue Date',
        'Effective To',
        'End Date',
        'To Date',
        'Valid To',
        'Eff To',
        'Season End',
      ]) || '4-Oct-2026';

      const effFrom = normalizeDateStr(effFromRaw, targetSeasonRange?.start || '2026-08-01');
      const effTo = normalizeDateStr(effToRaw, targetSeasonRange?.end || '2026-10-04');

      const acRaw = getVal(['Aircraft Type', 'Aircraft', 'Fleet', 'Fleet Aircraft', 'Equipment', 'EQP']) || 'DH8D';
      const aircraft: AircraftType =
        acRaw.toUpperCase().includes('737') || acRaw.toUpperCase().includes('B73') || acRaw.toUpperCase().includes('BOEING')
          ? 'B737'
          : 'Q400';

      const reg = getVal(['Registration', 'Tail', 'Reg', 'Tail Number']) || (aircraft === 'B737' ? '9J-ZAE' : '9J-ZAW');

      const blockRaw = getVal(['Block Time', 'Block', 'Block Hours', 'Flying Time']);
      let blockVal: number | undefined;
      if (blockRaw && blockRaw.includes(':')) {
        const [h, m] = blockRaw.split(':').map(Number);
        blockVal = parseFloat(((h || 0) + (m || 0) / 60).toFixed(2));
      } else if (blockRaw) {
        blockVal = parseFloat(blockRaw);
      }

      patterns.push({
        id: `pat-${idx}`,
        flightNumber: fn.toUpperCase().replace(/\s+/g, ''),
        departure: dep,
        arrival: arr,
        std,
        sta,
        daysOfOperation: daysOfOp,
        effectiveFrom: effFrom,
        effectiveTo: effTo,
        aircraft,
        registration: reg,
        blockHours: blockVal || calculateBlockHours(std, sta),
        remarks: getVal(['Remarks', 'Notes', 'Comment']) || `Zambia Airways ${dep}–${arr} Commercial Schedule`,
      });
    });

    const expandedFlights = generateFlightsFromSeasonalPatterns(patterns, targetSeasonRange);
    return {
      isSeasonal: true,
      flights: expandedFlights,
      seasonalPatterns: patterns,
      totalExpanded: expandedFlights.length,
    };
  }

  // Standard Day-by-Day flight schedule parsing
  const singleFlights: Flight[] = [];
  rows.forEach((row, idx) => {
    const getVal = (possibleKeys: string[]) => {
      for (const pk of possibleKeys) {
        for (const k of Object.keys(row)) {
          if (k.toLowerCase().trim() === pk.toLowerCase().trim() && row[k] !== undefined && row[k] !== '') {
            return String(row[k]).trim();
          }
        }
      }
      return '';
    };

    const fn = getVal(['Flight No', 'Flight No.', 'Flight Number', 'flightNumber', 'FLIGHT NO', 'Flight', 'Flt No', 'FlightNo']);
    if (!fn) return;

    const dateRaw = getVal(['Date', 'date', 'Flight Date', 'Date of Flight']) || '2026-08-01';
    const formattedDate = normalizeDateStr(dateRaw, '2026-08-01');

    const dep = (getVal(['Departure Station', 'Departure', 'Origin', 'DEP', 'From']) || 'LUN').toUpperCase();
    const arr = (getVal(['Arrival Station', 'Arrival', 'Destination', 'ARR', 'To']) || 'HRE').toUpperCase();
    const std = normalizeTimeStr(getVal(['STD', 'Departure Time', 'std']), '08:00');
    const sta = normalizeTimeStr(getVal(['STA', 'Arrival Time', 'sta']), '09:10');

    const blockRaw = getVal(['Block Time', 'Block', 'Block Hours']);
    let blockVal = 1.17;
    if (blockRaw && blockRaw.includes(':')) {
      const [h, m] = blockRaw.split(':').map(Number);
      blockVal = parseFloat(((h || 0) + (m || 0) / 60).toFixed(2));
    } else if (blockRaw) {
      blockVal = parseFloat(blockRaw) || 1.17;
    } else {
      blockVal = calculateBlockHours(std, sta);
    }

    const acRaw = getVal(['Aircraft Type', 'Aircraft', 'Fleet', 'Equipment']) || 'DH8D';
    const aircraft: AircraftType =
      acRaw.toUpperCase().includes('737') || acRaw.toUpperCase().includes('B73') ? 'B737' : 'Q400';
    const reg = getVal(['Registration', 'Tail', 'Reg']) || (aircraft === 'B737' ? '9J-ZAE' : '9J-ZAW');

    singleFlights.push({
      id: `flt-imp-${Date.now()}-${idx}`,
      flightNumber: fn.toUpperCase().replace(/\s+/g, ''),
      date: formattedDate,
      departure: dep,
      arrival: arr,
      std,
      sta,
      aircraft,
      registration: reg,
      blockHours: blockVal,
      status: 'SCHEDULED',
      remarks: getVal(['Remarks', 'Notes']),
    });
  });

  return {
    isSeasonal: false,
    flights: singleFlights,
    seasonalPatterns: [],
    totalExpanded: singleFlights.length,
  };
}

/**
 * Official Zambia Airways Commercial Department Flight Schedule Table (11-Apr-2026 to 4-Oct-2026)
 * Matches the exact 16-column format from the Zambia Airways Commercial Schedule Document:
 * Flight No | Aircraft Type | Departure Station | Arrival Station | STD | STA | Block Time | Effective Date | Dis Date | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday
 */
export const OFFICIAL_COMMERCIAL_FLIGHT_SCHEDULE_ROWS = [
  // 1-2: Harare Q400 Rotations
  { 'Flight No': 'ZN303', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'HRE', 'STD': '6:00', 'STA': '7:10', 'Block Time': '1:10', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'Yes', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'Yes', 'Sunday': 'No' },
  { 'Flight No': 'ZN302', 'Aircraft Type': 'DH8D', 'Departure Station': 'HRE', 'Arrival Station': 'LUN', 'STD': '7:55', 'STA': '9:05', 'Block Time': '1:10', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'Yes', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'Yes', 'Sunday': 'No' },

  // 3-6: JNB Morning B737 Rotations
  { 'Flight No': 'ZN305', 'Aircraft Type': 'B737', 'Departure Station': 'LUN', 'Arrival Station': 'JNB', 'STD': '7:20', 'STA': '9:25', 'Block Time': '2:20', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'Yes', 'Thursday': 'No', 'Friday': 'Yes', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN304', 'Aircraft Type': 'B737', 'Departure Station': 'JNB', 'Arrival Station': 'LUN', 'STD': '10:10', 'STA': '12:30', 'Block Time': '2:20', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'Yes', 'Thursday': 'No', 'Friday': 'Yes', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN305', 'Aircraft Type': 'B737', 'Departure Station': 'LUN', 'Arrival Station': 'JNB', 'STD': '7:25', 'STA': '9:30', 'Block Time': '2:20', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'Yes', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'Yes' },
  { 'Flight No': 'ZN304', 'Aircraft Type': 'B737', 'Departure Station': 'JNB', 'Arrival Station': 'LUN', 'STD': '10:10', 'STA': '12:30', 'Block Time': '2:20', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'Yes', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'Yes' },

  // 7-10: JNB Morning DH8D Contingency Options
  { 'Flight No': 'ZN305', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'JNB', 'STD': '7:20', 'STA': '9:25', 'Block Time': '2:45', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN304', 'Aircraft Type': 'DH8D', 'Departure Station': 'JNB', 'Arrival Station': 'LUN', 'STD': '10:10', 'STA': '12:30', 'Block Time': '2:45', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN305', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'JNB', 'STD': '7:25', 'STA': '10:10', 'Block Time': '2:45', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN304', 'Aircraft Type': 'DH8D', 'Departure Station': 'JNB', 'Arrival Station': 'LUN', 'STD': '10:55', 'STA': '13:40', 'Block Time': '2:45', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },

  // 11-16: JNB Evening Rotations
  { 'Flight No': 'ZN307', 'Aircraft Type': 'B737', 'Departure Station': 'LUN', 'Arrival Station': 'JNB', 'STD': '16:20', 'STA': '19:05', 'Block Time': '2:20', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN306', 'Aircraft Type': 'B737', 'Departure Station': 'JNB', 'Arrival Station': 'LUN', 'STD': '19:50', 'STA': '22:35', 'Block Time': '2:20', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN307', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'JNB', 'STD': '16:20', 'STA': '19:05', 'Block Time': '2:45', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'Yes', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'Yes', 'Sunday': 'No' },
  { 'Flight No': 'ZN306', 'Aircraft Type': 'DH8D', 'Departure Station': 'JNB', 'Arrival Station': 'LUN', 'STD': '19:50', 'STA': '22:35', 'Block Time': '2:45', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'Yes', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'Yes', 'Sunday': 'No' },
  { 'Flight No': 'ZN307', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'JNB', 'STD': '16:20', 'STA': '19:05', 'Block Time': '2:45', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN306', 'Aircraft Type': 'DH8D', 'Departure Station': 'JNB', 'Arrival Station': 'LUN', 'STD': '19:50', 'STA': '22:35', 'Block Time': '2:45', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },

  // 17-20: Ndola Morning Rotations
  { 'Flight No': 'ZN408', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'NLA', 'STD': '9:35', 'STA': '10:30', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN409', 'Aircraft Type': 'DH8D', 'Departure Station': 'NLA', 'Arrival Station': 'LUN', 'STD': '11:00', 'STA': '11:55', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN408', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'NLA', 'STD': '7:00', 'STA': '7:55', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN409', 'Aircraft Type': 'DH8D', 'Departure Station': 'NLA', 'Arrival Station': 'LUN', 'STD': '8:25', 'STA': '9:20', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },

  // 21-24: Ndola Evening Rotations
  { 'Flight No': 'ZN410', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'NLA', 'STD': '18:00', 'STA': '18:55', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'Yes', 'Tuesday': 'No', 'Wednesday': 'Yes', 'Thursday': 'No', 'Friday': 'Yes', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN411', 'Aircraft Type': 'DH8D', 'Departure Station': 'NLA', 'Arrival Station': 'LUN', 'STD': '19:25', 'STA': '20:20', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'Yes', 'Tuesday': 'No', 'Wednesday': 'Yes', 'Thursday': 'No', 'Friday': 'Yes', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN410', 'Aircraft Type': 'B737', 'Departure Station': 'LUN', 'Arrival Station': 'NLA', 'STD': '18:00', 'STA': '18:55', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN411', 'Aircraft Type': 'B737', 'Departure Station': 'NLA', 'Arrival Station': 'LUN', 'STD': '19:25', 'STA': '20:20', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },

  // 25-28: Ndola Afternoon Rotations
  { 'Flight No': 'ZN412', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'NLA', 'STD': '13:50', 'STA': '14:45', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'Yes', 'Sunday': 'No' },
  { 'Flight No': 'ZN413', 'Aircraft Type': 'DH8D', 'Departure Station': 'NLA', 'Arrival Station': 'LUN', 'STD': '15:15', 'STA': '16:10', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'Yes', 'Sunday': 'No' },
  { 'Flight No': 'ZN412', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'NLA', 'STD': '13:35', 'STA': '14:30', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'Yes', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN413', 'Aircraft Type': 'DH8D', 'Departure Station': 'NLA', 'Arrival Station': 'LUN', 'STD': '15:00', 'STA': '15:55', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'Yes', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },

  // 29-37: Lusaka - Ndola - Solwezi Domestic Triangles
  { 'Flight No': 'ZN414', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'NLA', 'STD': '7:00', 'STA': '7:55', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'Yes', 'Tuesday': 'No', 'Wednesday': 'Yes', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN414', 'Aircraft Type': 'DH8D', 'Departure Station': 'NLA', 'Arrival Station': 'SLI', 'STD': '8:25', 'STA': '9:10', 'Block Time': '0:45', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'Yes', 'Tuesday': 'No', 'Wednesday': 'Yes', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN414', 'Aircraft Type': 'DH8D', 'Departure Station': 'SLI', 'Arrival Station': 'LUN', 'STD': '9:40', 'STA': '10:45', 'Block Time': '1:05', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'Yes', 'Tuesday': 'No', 'Wednesday': 'Yes', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN414', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'NLA', 'STD': '9:35', 'STA': '10:30', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'Yes', 'Sunday': 'No' },
  { 'Flight No': 'ZN414', 'Aircraft Type': 'DH8D', 'Departure Station': 'NLA', 'Arrival Station': 'SLI', 'STD': '11:00', 'STA': '11:45', 'Block Time': '0:45', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'Yes', 'Sunday': 'No' },
  { 'Flight No': 'ZN414', 'Aircraft Type': 'DH8D', 'Departure Station': 'SLI', 'Arrival Station': 'LUN', 'STD': '12:15', 'STA': '13:20', 'Block Time': '1:05', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'Yes', 'Sunday': 'No' },
  { 'Flight No': 'ZN414', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'NLA', 'STD': '13:35', 'STA': '14:30', 'Block Time': '0:55', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'Yes', 'Saturday': 'No', 'Sunday': 'Yes' },
  { 'Flight No': 'ZN414', 'Aircraft Type': 'DH8D', 'Departure Station': 'NLA', 'Arrival Station': 'SLI', 'STD': '15:00', 'STA': '15:45', 'Block Time': '0:45', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'Yes', 'Saturday': 'No', 'Sunday': 'Yes' },
  { 'Flight No': 'ZN414', 'Aircraft Type': 'DH8D', 'Departure Station': 'SLI', 'Arrival Station': 'LUN', 'STD': '16:15', 'STA': '17:20', 'Block Time': '1:05', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'Yes', 'Saturday': 'No', 'Sunday': 'Yes' },

  // 38-47: Livingstone (LVI) Services
  { 'Flight No': 'ZN419', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'LVI', 'STD': '16:40', 'STA': '17:45', 'Block Time': '1:05', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'Yes', 'Sunday': 'No' },
  { 'Flight No': 'ZN418', 'Aircraft Type': 'DH8D', 'Departure Station': 'LVI', 'Arrival Station': 'LUN', 'STD': '18:15', 'STA': '19:20', 'Block Time': '1:05', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'Yes', 'Sunday': 'No' },
  { 'Flight No': 'ZN419', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'LVI', 'STD': '9:50', 'STA': '10:55', 'Block Time': '1:05', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'Yes', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN418', 'Aircraft Type': 'DH8D', 'Departure Station': 'LVI', 'Arrival Station': 'LUN', 'STD': '11:25', 'STA': '12:30', 'Block Time': '1:05', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'Yes', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN419', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'LVI', 'STD': '17:50', 'STA': '18:55', 'Block Time': '1:05', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'Yes' },
  { 'Flight No': 'ZN418', 'Aircraft Type': 'DH8D', 'Departure Station': 'LVI', 'Arrival Station': 'LUN', 'STD': '19:25', 'STA': '20:30', 'Block Time': '1:05', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'Yes' },
  { 'Flight No': 'ZN419', 'Aircraft Type': 'DH8D', 'Departure Station': 'LUN', 'Arrival Station': 'LVI', 'STD': '11:15', 'STA': '12:20', 'Block Time': '1:05', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'Yes', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN418', 'Aircraft Type': 'DH8D', 'Departure Station': 'LVI', 'Arrival Station': 'LUN', 'STD': '12:50', 'STA': '13:55', 'Block Time': '1:05', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'Yes', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN419', 'Aircraft Type': 'B737', 'Departure Station': 'LUN', 'Arrival Station': 'LVI', 'STD': '16:40', 'STA': '17:45', 'Block Time': '1:05', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN418', 'Aircraft Type': 'B737', 'Departure Station': 'LVI', 'Arrival Station': 'LUN', 'STD': '18:15', 'STA': '19:20', 'Block Time': '1:05', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },

  // 48-50: Lusaka - Nairobi - Dar Es Salaam - Lusaka Rotation (B737)
  { 'Flight No': 'ZN504', 'Aircraft Type': 'B737', 'Departure Station': 'LUN', 'Arrival Station': 'NBO', 'STD': '7:00', 'STA': '11:00', 'Block Time': '2:50', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'Yes', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN504', 'Aircraft Type': 'B737', 'Departure Station': 'NBO', 'Arrival Station': 'DAR', 'STD': '11:45', 'STA': '13:05', 'Block Time': '1:20', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'Yes', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },
  { 'Flight No': 'ZN504', 'Aircraft Type': 'B737', 'Departure Station': 'DAR', 'Arrival Station': 'LUN', 'STD': '13:50', 'STA': '15:20', 'Block Time': '2:20', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'Yes', 'Wednesday': 'No', 'Thursday': 'Yes', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'No' },

  // 51-53: Lusaka - Dar Es Salaam - Nairobi - Lusaka Return Rotation (B737)
  { 'Flight No': 'ZN524', 'Aircraft Type': 'B737', 'Departure Station': 'LUN', 'Arrival Station': 'DAR', 'STD': '13:35', 'STA': '17:05', 'Block Time': '2:20', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'Yes' },
  { 'Flight No': 'ZN524', 'Aircraft Type': 'B737', 'Departure Station': 'DAR', 'Arrival Station': 'NBO', 'STD': '17:50', 'STA': '19:10', 'Block Time': '1:20', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'Yes' },
  { 'Flight No': 'ZN524', 'Aircraft Type': 'B737', 'Departure Station': 'NBO', 'Arrival Station': 'LUN', 'STD': '19:55', 'STA': '21:55', 'Block Time': '2:50', 'Effective Date': '11-Apr-2026', 'Dis Date': '4-Oct-2026', 'Monday': 'No', 'Tuesday': 'No', 'Wednesday': 'No', 'Thursday': 'No', 'Friday': 'No', 'Saturday': 'No', 'Sunday': 'Yes' },
];

/**
 * Default standard commercial department seasonal flight patterns for Zambia Airways
 */
export const DEFAULT_COMMERCIAL_SEASONAL_SCHEDULE: SeasonalFlightPattern[] = [
  {
    flightNumber: 'ZN303',
    departure: 'LUN',
    arrival: 'HRE',
    std: '06:00',
    sta: '07:10',
    daysOfOperation: '2,4,6', // Tue, Thu, Sat
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'Q400',
    registration: '9J-ZAW',
    blockHours: 1.17,
    remarks: 'Lusaka to Harare Morning Rotation',
  },
  {
    flightNumber: 'ZN302',
    departure: 'HRE',
    arrival: 'LUN',
    std: '07:55',
    sta: '09:05',
    daysOfOperation: '2,4,6', // Tue, Thu, Sat
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'Q400',
    registration: '9J-ZAW',
    blockHours: 1.17,
    remarks: 'Harare to Lusaka Return Morning Rotation',
  },
  {
    flightNumber: 'ZN305',
    departure: 'LUN',
    arrival: 'JNB',
    std: '07:20',
    sta: '09:25',
    daysOfOperation: '1,3,5,7', // Mon, Wed, Fri, Sun
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'B737',
    registration: '9J-ZAE',
    blockHours: 2.33,
    remarks: 'Lusaka to Johannesburg Morning Boeing Service',
  },
  {
    flightNumber: 'ZN304',
    departure: 'JNB',
    arrival: 'LUN',
    std: '10:10',
    sta: '12:30',
    daysOfOperation: '1,3,5,7', // Mon, Wed, Fri, Sun
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'B737',
    registration: '9J-ZAE',
    blockHours: 2.33,
    remarks: 'Johannesburg to Lusaka Morning Boeing Return',
  },
  {
    flightNumber: 'ZN307',
    departure: 'LUN',
    arrival: 'JNB',
    std: '16:20',
    sta: '19:05',
    daysOfOperation: '2,4,6', // Tue, Thu, Sat
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'Q400',
    registration: '9J-ZAW',
    blockHours: 2.75,
    remarks: 'Lusaka to Johannesburg Evening Dash 8 Service',
  },
  {
    flightNumber: 'ZN306',
    departure: 'JNB',
    arrival: 'LUN',
    std: '19:50',
    sta: '22:35',
    daysOfOperation: '2,4,6', // Tue, Thu, Sat
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'Q400',
    registration: '9J-ZAW',
    blockHours: 2.75,
    remarks: 'Johannesburg to Lusaka Evening Dash 8 Return',
  },
  {
    flightNumber: 'ZN410',
    departure: 'LUN',
    arrival: 'NLA',
    std: '18:00',
    sta: '18:55',
    daysOfOperation: '1,3,5', // Mon, Wed, Fri
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'Q400',
    registration: '9J-ZAW',
    blockHours: 0.92,
    remarks: 'Lusaka to Ndola Evening Flight',
  },
  {
    flightNumber: 'ZN411',
    departure: 'NLA',
    arrival: 'LUN',
    std: '19:25',
    sta: '20:20',
    daysOfOperation: '1,3,5', // Mon, Wed, Fri
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'Q400',
    registration: '9J-ZAW',
    blockHours: 0.92,
    remarks: 'Ndola to Lusaka Evening Return',
  },
  {
    flightNumber: 'ZN504',
    departure: 'LUN',
    arrival: 'NBO',
    std: '07:00',
    sta: '11:00',
    daysOfOperation: '2,4', // Tue, Thu
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'B737',
    registration: '9J-ZAE',
    blockHours: 2.83,
    remarks: 'Lusaka to Nairobi Regional Boeing Rotation',
  },
  {
    flightNumber: 'ZN504',
    departure: 'NBO',
    arrival: 'DAR',
    std: '11:45',
    sta: '13:05',
    daysOfOperation: '2,4', // Tue, Thu
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'B737',
    registration: '9J-ZAE',
    blockHours: 1.33,
    remarks: 'Nairobi to Dar Es Salaam Boeing Sector',
  },
  {
    flightNumber: 'ZN504',
    departure: 'DAR',
    arrival: 'LUN',
    std: '13:50',
    sta: '15:20',
    daysOfOperation: '2,4', // Tue, Thu
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'B737',
    registration: '9J-ZAE',
    blockHours: 2.33,
    remarks: 'Dar Es Salaam to Lusaka Return Rotation',
  },
  {
    flightNumber: 'ZN524',
    departure: 'LUN',
    arrival: 'DAR',
    std: '13:35',
    sta: '17:05',
    daysOfOperation: '7', // Sunday
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'B737',
    registration: '9J-ZAE',
    blockHours: 2.33,
    remarks: 'Lusaka to Dar Es Salaam Sunday Boeing Flight',
  },
  {
    flightNumber: 'ZN524',
    departure: 'DAR',
    arrival: 'NBO',
    std: '17:50',
    sta: '19:10',
    daysOfOperation: '7', // Sunday
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'B737',
    registration: '9J-ZAE',
    blockHours: 1.33,
    remarks: 'Dar Es Salaam to Nairobi Sunday Boeing Sector',
  },
  {
    flightNumber: 'ZN524',
    departure: 'NBO',
    arrival: 'LUN',
    std: '19:55',
    sta: '21:55',
    daysOfOperation: '7', // Sunday
    effectiveFrom: '2026-04-11',
    effectiveTo: '2026-10-04',
    aircraft: 'B737',
    registration: '9J-ZAE',
    blockHours: 2.83,
    remarks: 'Nairobi to Lusaka Sunday Boeing Return',
  },
];
