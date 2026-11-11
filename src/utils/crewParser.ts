import { CrewMember, CrewRole, AircraftType, CrewStatus } from '../types';
import { documentStatus } from './legalityEngine';

/**
 * Intelligent Crew Role Normalizer
 * Recognizes all standard airline rank abbreviations and title descriptions
 */
export function normalizeCrewRole(rawRole: string | undefined, name = ''): CrewRole {
  const str = (rawRole || '').trim().toLowerCase();
  const nameLower = name.trim().toLowerCase();

  // 1. First Officer / Co-Pilot / SIC / P2 (Check FO early so First Officer is not confused with generic pilot)
  if (
    str === 'first officer' ||
    str === 'firstofficer' ||
    str === 'first-officer' ||
    str === 'first_officer' ||
    str === 'first off' ||
    str === 'first off.' ||
    str === '1st officer' ||
    str === '1st off' ||
    str === 'fo' ||
    str === 'f/o' ||
    str === 'f.o.' ||
    str === 'f.o' ||
    str === 'fo.' ||
    str === 'sic' ||
    str === 'p2' ||
    str.includes('first officer') ||
    str.includes('firstofficer') ||
    str.includes('first-officer') ||
    str.includes('first off') ||
    str.includes('1st officer') ||
    str.includes('co-pilot') ||
    str.includes('copilot') ||
    str.includes('co pilot') ||
    str.includes('second in command') ||
    str.includes('second officer') ||
    str.startsWith('fo ') ||
    str.startsWith('f/o ') ||
    str.startsWith('f.o. ') ||
    str.endsWith(' fo') ||
    str.endsWith(' f/o') ||
    nameLower.startsWith('fo ') ||
    nameLower.startsWith('f/o ') ||
    nameLower.startsWith('f.o. ') ||
    nameLower.startsWith('copilot ') ||
    nameLower.startsWith('co-pilot ') ||
    nameLower.includes('(fo)') ||
    nameLower.includes('(f/o)') ||
    nameLower.includes('(sic)') ||
    nameLower.includes('(p2)')
  ) {
    return 'First Officer';
  }

  // 2. Captain / Commander / PIC / P1 / Training Captain
  if (
    str === 'captain' ||
    str === 'capt' ||
    str === 'capt.' ||
    str === 'cpt' ||
    str === 'cpt.' ||
    str === 'commander' ||
    str === 'pic' ||
    str === 'p1' ||
    str === 'pilot in command' ||
    str === 'chief pilot' ||
    str === 'training captain' ||
    str === 'check captain' ||
    str === 'line captain' ||
    str === 'tri' ||
    str === 'tre' ||
    str === 'ltc' ||
    str.includes('captain') ||
    str.includes('capt') ||
    str.includes('cpt') ||
    str.includes('commander') ||
    str.includes('pilot in command') ||
    str.includes('chief pilot') ||
    str.includes('training captain') ||
    str.includes('check captain') ||
    str.includes('line captain') ||
    str.includes('tri') ||
    str.includes('tre') ||
    str.includes('ltc') ||
    nameLower.startsWith('capt.') ||
    nameLower.startsWith('capt ') ||
    nameLower.startsWith('captain ') ||
    nameLower.startsWith('cpt.') ||
    nameLower.startsWith('cpt ') ||
    nameLower.startsWith('commander ') ||
    nameLower.includes('(capt)') ||
    nameLower.includes('(cpt)') ||
    nameLower.includes('(pic)') ||
    nameLower.includes('(p1)') ||
    nameLower.includes('captain ')
  ) {
    return 'Captain';
  }

  // 3. Generic Pilot / Cockpit Crew (Differentiate by FO vs Captain cues)
  if (str.includes('pilot') || str.includes('flight deck') || str.includes('cockpit') || str.includes('flight crew')) {
    if (
      str.includes('first') ||
      str.includes('fo') ||
      str.includes('copilot') ||
      str.includes('sic') ||
      str.includes('p2') ||
      nameLower.includes('fo') ||
      nameLower.includes('copilot')
    ) {
      return 'First Officer';
    }
    return 'Captain';
  }

  // 4. Senior Cabin Crew / Purser / In-Flight Manager
  if (
    str === 'senior cabin crew' ||
    str === 'senior cabin' ||
    str === 'scc' ||
    str === 'purser' ||
    str.includes('senior cabin') ||
    str.includes('scc') ||
    str.includes('purser') ||
    str.includes('senior flight attendant') ||
    str.includes('lead cabin') ||
    str.includes('lead fa') ||
    str.includes('chief purser') ||
    str.includes('inflight manager') ||
    str.includes('in-flight manager') ||
    str.includes('cabin director') ||
    str.includes('ifm') ||
    nameLower.startsWith('scc ') ||
    nameLower.startsWith('purser ') ||
    nameLower.includes('(scc)') ||
    nameLower.includes('(purser)')
  ) {
    return 'Senior Cabin Crew';
  }

  // 5. Cabin Crew / Flight Attendant / Steward
  if (
    str === 'cabin crew' ||
    str === 'cabin' ||
    str === 'flight attendant' ||
    str === 'fa' ||
    str === 'cc' ||
    str === 'f/a' ||
    str === 'c/c' ||
    str.includes('cabin') ||
    str.includes('flight attendant') ||
    str.includes('attendant') ||
    str.includes('steward') ||
    str.includes('stewardess') ||
    str.includes('air hostess') ||
    str.includes('inflight') ||
    str.includes('fa ') ||
    str.includes('cc ') ||
    nameLower.includes('fa ') ||
    nameLower.includes('cc ')
  ) {
    return 'Cabin Crew';
  }

  // Default fallback based on name or keywords
  if (nameLower.includes('capt') || nameLower.includes('commander')) return 'Captain';
  if (nameLower.includes('fo ') || nameLower.includes('first off') || nameLower.includes('copilot')) return 'First Officer';
  if (nameLower.includes('purser') || nameLower.includes('senior')) return 'Senior Cabin Crew';

  // If unknown, default to Cabin Crew
  return 'Cabin Crew';
}

/**
 * Intelligent Aircraft Fleet Normalizer
 */
export function normalizeAircraftFleet(rawFleet: string | undefined, role?: CrewRole): AircraftType {
  const str = (rawFleet || '').toUpperCase();
  if (
    str.includes('737') ||
    str.includes('B73') ||
    str.includes('BOEING') ||
    str.includes('738') ||
    str.includes('B738')
  ) {
    return 'B737';
  }
  return 'Q400';
}

/**
 * Builds standard qualifications array based on role, fleet, and parsed qualifications.
 * Restricts qualifications strictly to the crew member's specific qualified fleet (e.g. Q400 or B737),
 * rather than assigning both fleets to everyone.
 */
export function buildQualifications(
  rawQuals: string | undefined,
  role: CrewRole,
  primaryAircraft: AircraftType
): string[] {
  const qualsSet = new Set<string>();

  if (rawQuals) {
    const rawUpper = rawQuals.toUpperCase();
    const tokens = rawQuals.split(/[,;/|]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
    tokens.forEach((t) => {
      if (t.includes('737') || t.includes('B73') || t.includes('BOEING')) qualsSet.add('B737');
      else if (t.includes('Q400') || t.includes('DH8') || t.includes('DASH')) qualsSet.add('Q400');
      else if (t.includes('DUAL') || t.includes('BOTH') || t.includes('ALL')) {
        qualsSet.add('Q400');
        qualsSet.add('B737');
      } else {
        qualsSet.add(t);
      }
    });

    // Check if raw text explicitly specified both aircraft types
    if (
      (rawUpper.includes('737') || rawUpper.includes('BOEING')) &&
      (rawUpper.includes('Q400') || rawUpper.includes('DH8') || rawUpper.includes('DASH'))
    ) {
      qualsSet.add('Q400');
      qualsSet.add('B737');
    }
  }

  // Ensure the primary qualified fleet is assigned
  qualsSet.add(primaryAircraft);

  // Mandatory airline recurrent training and safety certifications
  qualsSet.add('SEPT');
  qualsSet.add('CRM');
  qualsSet.add('DGR');

  // Senior Cabin Crew specific qualification endorsement
  if (role === 'Senior Cabin Crew') {
    qualsSet.add('SCC');
  }

  return Array.from(qualsSet);
}

/**
 * Parses raw crew database rows (from CSV/Excel) into typed CrewMember objects
 */
export function parseCrewData(
  rows: any[],
  existingCrew: CrewMember[] = []
): {
  crewList: CrewMember[];
  importedCount: number;
  duplicateCount: number;
} {
  const newCrewList: CrewMember[] = [];
  let importedCount = 0;
  let duplicateCount = 0;

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

    const name = getVal(['Name', 'Crew Name', 'name', 'Employee Name', 'Staff Name', 'Full Name']);
    if (!name) return;

    const staffNumber =
      getVal(['Staff Number', 'Employee ID', 'Staff ID', 'staffNumber', 'Emp ID', 'ID']) ||
      `ZA-${1000 + existingCrew.length + idx + 1}`;

    // Duplicate check against existing crew and current batch
    const isDuplicate =
      existingCrew.some(
        (c) =>
          c.staffNumber.toLowerCase() === staffNumber.toLowerCase() ||
          c.name.toLowerCase() === name.toLowerCase()
      ) ||
      newCrewList.some(
        (c) =>
          c.staffNumber.toLowerCase() === staffNumber.toLowerCase() ||
          c.name.toLowerCase() === name.toLowerCase()
      );

    if (isDuplicate) {
      duplicateCount++;
      return;
    }

    const roleRaw = getVal([
      'Role',
      'Role / Position',
      'Position',
      'Crew Category',
      'Rank',
      'Designation',
      'Title',
      'Job Title',
      'Job',
      'Category',
    ]);
    const role = normalizeCrewRole(roleRaw, name);

    const fleetRaw = getVal(['Fleet Aircraft', 'Aircraft', 'Fleet', 'Aircraft Type', 'Fleet Type']);
    const primaryAircraft = normalizeAircraftFleet(fleetRaw, role);

    const qualsRaw = getVal(['Qualifications', 'Ratings', 'Endorsements', 'Quals']);
    const qualifications = buildQualifications(qualsRaw || fleetRaw, role, primaryAircraft);

    const compEmail = getVal(['Company Email', 'companyEmail', 'email', 'Work Email', 'Email Address', 'Company Email Address']);
    const persEmail = getVal(['Personal Email', 'personalEmail', 'Home Email']);
    const mobileNum = getVal(['Mobile Number', 'Mobile', 'mobileNumber', 'phone', 'Phone Number', 'Phone', 'Cell', 'Telephone']);
    const waNum = getVal(['WhatsApp Number', 'whatsappNumber', 'whatsAppNumber', 'WhatsApp']) || mobileNum;

    const prefChannelRaw = getVal(['Preferred Channel', 'preferredChannel', 'Channel']).toUpperCase();
    let preferredChannel: 'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'ALL' = 'WHATSAPP';
    if (prefChannelRaw.includes('EMAIL')) preferredChannel = 'EMAIL';
    else if (prefChannelRaw.includes('APP')) preferredChannel = 'IN_APP';
    else if (prefChannelRaw.includes('ALL')) preferredChannel = 'ALL';

    const optInRaw = getVal(['WhatsApp Opt In', 'whatsAppOptIn', 'Opt In', 'WhatsApp Opt-In']).toLowerCase();
    const whatsAppOptIn = optInRaw !== 'false' && optInRaw !== '0' && optInRaw !== 'no';

    const newMember: CrewMember = {
      id: `crew-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
      staffNumber,
      name,
      role,
      aircraft: primaryAircraft,
      qualifications,
      base: getVal(['Base', 'Base Airport', 'Station', 'Home Base']) || 'LUN',
      status: (getVal(['Status', 'Duty Status']) as CrewStatus) || 'ACTIVE',
      seniority: existingCrew.length + importedCount + 1,
      companyEmail: compEmail || `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@zambiaairways.co.zm`,
      // Never invent an address: a guessed email could belong to someone else.
      email: (compEmail || persEmail || '').trim().toLowerCase(),
      personalEmail: persEmail,
      mobileNumber: mobileNum || '+260 97 100000',
      phone: mobileNum || '+260 97 100000',
      whatsAppNumber: waNum || '+260 97 100000',
      preferredChannel,
      whatsAppOptIn,
      simExpiry: getVal(['Simulator IR Expiry', 'Simulator IR Validity', 'Simulator', 'Sim Expiry', 'simExpiry']) || '',
      septExpiry: getVal(['SEPT Expiry', 'SEPT Validity', 'SEPT', 'septExpiry']) || '',
      crmExpiry: getVal(['CRM Expiry', 'CRM Validity', 'CRM', 'crmExpiry']) || '',
      dgrExpiry: getVal(['DGR Expiry', 'DGR Validity', 'DGR', 'dgrExpiry']) || '',
      medicalExpiry: getVal(['Medical Expiry', 'Medical', 'medicalExpiry']) || '',
      licenseExpiry: getVal(['License Expiry', 'License', 'licenseExpiry']) || '',
      passportExpiry: getVal(['Passport Expiry', 'passportExpiry']) || '',
      airportPassExpiry: getVal(['Airport Pass Expiry', 'airportPassExpiry']) || '',
      typeRating: qualifications.join(', ') || (role.includes('Cabin') ? 'Cabin Crew Certified' : 'Type Rated'),
      trainingStatus: 'VALID', // recalculated below from the actual dates
      lineCheck: getVal(['Line Check Schedule', 'Line Check', 'lineCheck']) || '',
      weeklyBlockHours: parseFloat(getVal(['Weekly Block Hours', 'weeklyBlockHours'])) || 0,
      monthlyBlockHours: parseFloat(getVal(['Monthly Block Hours', 'monthlyBlockHours'])) || 0,
      annualBlockHours: parseFloat(getVal(['Annual Block Hours', 'annualBlockHours'])) || 0,
      monthlyDutyHours: parseFloat(getVal(['Monthly Duty Hours', 'monthlyDutyHours'])) || 0,
      daysOff: 10,
      notes: 'Imported into Zambia Airways Crew Database',
    };

    // Training status from the real dates: anything missing/expired = EXPIRED,
    // anything expiring within 60 days = DUE_SOON.
    {
      const isPilot = newMember.role === 'Captain' || newMember.role === 'First Officer';
      const required = [
        newMember.licenseExpiry, newMember.medicalExpiry, newMember.septExpiry,
        newMember.crmExpiry, newMember.dgrExpiry, ...(isPilot ? [newMember.simExpiry] : []),
      ];
      const now = new Date();
      const soon = new Date(now.getTime() + 60 * 24 * 3600 * 1000);
      const states = required.map((d) => documentStatus(d, now));
      if (states.some((st) => st !== 'VALID')) newMember.trainingStatus = 'EXPIRED';
      else if (required.some((d) => documentStatus(d, soon) === 'EXPIRED')) newMember.trainingStatus = 'DUE_SOON';
    }

    newCrewList.push(newMember);
    importedCount++;
  });

  return {
    crewList: newCrewList,
    importedCount,
    duplicateCount,
  };
}
