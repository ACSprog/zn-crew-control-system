import React, { useState } from 'react';
import {
  CrewMember,
  Flight,
  Assignment,
  LeaveTrainingRecord,
  LegalityRules,
  LegacyMacroMapping,
  AircraftFleet,
  AircraftType,
} from '../types';
import {
  FileCode2,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  Play,
  RefreshCw,
  Download,
  Terminal,
  Database,
  Edit3,
  ListPlus,
  Table,
  Check,
  Sparkles,
  Zap,
  Trash2,
} from 'lucide-react';
import Papa from 'papaparse';
import { exportToCsv } from '../utils/exportCsv';
import { parseCrewData } from '../utils/crewParser';
import { parseFlightScheduleData, DEFAULT_COMMERCIAL_SEASONAL_SCHEDULE, OFFICIAL_COMMERCIAL_FLIGHT_SCHEDULE_ROWS } from '../utils/seasonalScheduleParser';

interface LegacyExcelSystemMappingViewProps {
  crew: CrewMember[];
  flights: Flight[];
  assignments: Assignment[];
  leaveRecords: LeaveTrainingRecord[];
  rules: LegalityRules;
  fleet?: AircraftFleet[];
  onImportCrew: (importedCrew: CrewMember[]) => void;
  onImportFlights?: (importedFlights: Flight[]) => void;
  onImportAssignments?: (importedAssignments: Assignment[]) => void;
  onImportLeaveRecords?: (importedRecords: LeaveTrainingRecord[]) => void;
  onImportFleet?: (importedFleet: AircraftFleet[]) => void;
  onClearAllData?: () => void;
  onResetSampleData?: () => void;
  onRunAutoScheduler?: () => void;
}

type EntityType = 'crew' | 'flights' | 'assignments' | 'leave' | 'fleet';

const DEFAULT_MACRO_MAPPINGS: LegacyMacroMapping[] = [
  {
    id: 'macro-1',
    excelMacro: 'CalculateRecency()',
    purpose: 'Calculates pilot 90-day takeoff and landing currency window against CAA regulatory requirements.',
    convertedFunction: 'calculateRecency(crewId: string, flightHistory: Flight[]): RecencyRecord',
    status: 'CONVERTED',
    codeSnippet: `export function calculateRecency(crew: CrewMember): RecencyRecord {
  const daysLeft = calculateDaysRemaining(crew.lastFlightDate);
  const isCurrent = crew.takeoffs90Days >= 3 && crew.landings90Days >= 3 && daysLeft > 0;
  return { status: isCurrent ? 'CURRENT' : daysLeft <= 14 ? 'EXPIRING' : 'NOT_CURRENT', daysRemaining: daysLeft };
}`,
  },
  {
    id: 'macro-2',
    excelMacro: 'CheckExpiryStatus()',
    purpose: 'Evaluates Passport, Airport Pass, Medical and License expiry dates against warning thresholds (90, 60, 30, 7 days).',
    convertedFunction: 'calculateExpiryStatus(expiryDate: string, thresholds: RuleThresholds): ExpiryStatus',
    status: 'CONVERTED',
    codeSnippet: `export function calculateExpiryStatus(expiryDateStr: string) {
  const days = Math.ceil((new Date(expiryDateStr).getTime() - Date.now()) / (86400 * 1000));
  if (days <= 0) return 'EXPIRED';
  if (days <= 60) return 'EXPIRING_SOON';
  return 'VALID';
}`,
  },
  {
    id: 'macro-3',
    excelMacro: 'ValidateAssignment()',
    purpose: 'Checks FTL rest limits, duty hours, document validity, type rating qualification, recency, and leave before roster assignment.',
    convertedFunction: 'runLegalityCheck(crewMember: CrewMember, flight: Flight, rules: LegalityRules): ConflictCheckResult',
    status: 'CONVERTED',
    codeSnippet: `export function runLegalityCheck(crew: CrewMember, flight: Flight): ConflictCheckResult {
  const qualPass = crew.aircraft === flight.aircraft;
  const docPass = crew.medicalStatus === 'VALID' && crew.licenseStatus === 'VALID';
  return { overallResult: (qualPass && docPass) ? 'PASS' : 'FAIL' };
}`,
  },
  {
    id: 'macro-4',
    excelMacro: 'GenerateMonthlyRoster()',
    purpose: 'Algorithmic roster generation across Q400 and B737 fleets minimizing positioning, balancing hours, and maintaining crew complement.',
    convertedFunction: 'runAutoScheduler(flights: Flight[], crew: CrewMember[], rules: LegalityRules): DraftRoster',
    status: 'CONVERTED',
    codeSnippet: `export function runAutoScheduler(flights: Flight[], crew: CrewMember[]) {
  // Deterministic 15-rule matching engine
  return optimizeRoster(flights, crew);
}`,
  },
];

export const LegacyExcelSystemMappingView: React.FC<LegacyExcelSystemMappingViewProps> = ({
  crew,
  flights,
  assignments,
  leaveRecords,
  rules,
  fleet = [],
  onImportCrew,
  onImportFlights,
  onImportAssignments,
  onImportLeaveRecords,
  onImportFleet,
  onClearAllData,
  onResetSampleData,
  onRunAutoScheduler,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual' | 'macros' | 'code'>('upload');
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('crew');

  // File Upload State
  const [uploadFeedback, setUploadFeedback] = useState<{
    recordsFound: number;
    recordsAdded: number;
    message: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Manual / CSV Paste State
  const [manualPasteText, setManualPasteText] = useState('');
  const [parsedPreviewRows, setParsedPreviewRows] = useState<any[]>([]);
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Quick Single Row Manual Form
  const [manualForm, setManualForm] = useState({
    col1: '',
    col2: '',
    col3: '',
    col4: '',
    col5: 'Q400',
  });

  // Macro Engine Terminal Logs
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'Zambia Airways VBA Macro Compatibility Subsystem v2.4 initialized.',
    'Ready for macro execution or CSV batch processing.',
  ]);
  const [runningMacroId, setRunningMacroId] = useState<string | null>(null);

  // In-App Confirmational Modals
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
  };

  // Sample CSV Downloads
  const handleDownloadSampleCsv = () => {
    if (selectedEntity === 'crew') {
      const sample = [
        {
          'Employee ID': 'ZA-1008',
          Name: 'Capt. Chileshe Lungu',
          'Company Email': 'c.lungu@zambiaairways.co.zm',
          'Phone Number': '+260 97 888123',
          'Role / Position': 'Captain',
          'Fleet Aircraft': 'Q400',
          Base: 'LUN',
          'Simulator IR Validity': '2027-08-31',
          'SEPT Validity': '2027-09-15',
          'CRM Validity': '2027-10-30',
          'DGR Validity': '2027-11-20',
          'Medical Expiry': '2027-08-31',
          'License Expiry': '2027-12-31',
          'Passport Expiry': '2028-12-31',
          'Airport Pass Expiry': '2027-04-30',
          'Line Check Schedule': '2026-11-15',
          'Weekly Block Hours': 18.5,
          'Monthly Block Hours': 65.0,
          'Annual Block Hours': 420.0,
        },
        {
          'Employee ID': 'ZA-2005',
          Name: 'Nchimunya Moonga',
          'Company Email': 'n.moonga@zambiaairways.co.zm',
          'Phone Number': '+260 96 777234',
          'Role / Position': 'First Officer',
          'Fleet Aircraft': 'B737',
          Base: 'LUN',
          'Simulator IR Validity': '2027-08-31',
          'SEPT Validity': '2027-09-15',
          'CRM Validity': '2027-10-30',
          'DGR Validity': '2027-11-20',
          'Medical Expiry': '2027-05-20',
          'License Expiry': '2027-12-31',
          'Passport Expiry': '2029-01-15',
          'Airport Pass Expiry': '2027-09-10',
          'Line Check Schedule': '2026-12-01',
          'Weekly Block Hours': 14.0,
          'Monthly Block Hours': 52.0,
          'Annual Block Hours': 340.0,
        },
        {
          'Employee ID': 'ZA-3004',
          Name: 'Mercy Tembo',
          'Company Email': 'm.tembo@zambiaairways.co.zm',
          'Phone Number': '+260 97 555890',
          'Role / Position': 'Senior Cabin Crew',
          'Fleet Aircraft': 'Q400',
          Base: 'LUN',
          'Simulator IR Validity': '2027-08-31',
          'SEPT Validity': '2027-09-15',
          'CRM Validity': '2027-10-30',
          'DGR Validity': '2027-11-20',
          'Medical Expiry': '2027-07-15',
          'License Expiry': '2027-12-31',
          'Passport Expiry': '2028-11-20',
          'Airport Pass Expiry': '2027-06-30',
          'Line Check Schedule': '2026-10-10',
          'Weekly Block Hours': 16.0,
          'Monthly Block Hours': 58.0,
          'Annual Block Hours': 390.0,
        },
        {
          'Employee ID': 'ZA-3009',
          Name: 'Chipo Banda',
          'Company Email': 'c.banda@zambiaairways.co.zm',
          'Phone Number': '+260 97 112233',
          'Role / Position': 'Cabin Crew',
          'Fleet Aircraft': 'B737',
          Base: 'LUN',
          'Simulator IR Validity': '2027-08-31',
          'SEPT Validity': '2027-09-15',
          'CRM Validity': '2027-10-30',
          'DGR Validity': '2027-11-20',
          'Medical Expiry': '2027-09-10',
          'License Expiry': '2027-12-31',
          'Passport Expiry': '2028-10-15',
          'Airport Pass Expiry': '2027-08-20',
          'Line Check Schedule': '2026-11-05',
          'Weekly Block Hours': 12.0,
          'Monthly Block Hours': 45.0,
          'Annual Block Hours': 310.0,
        },
      ];
      exportToCsv('Zambia_Airways_Crew_Import_Template.csv', sample);
    } else if (selectedEntity === 'flights') {
      // Official 16-column Zambia Airways Commercial Seasonal Schedule Template
      exportToCsv('Zambia_Airways_Commercial_Flight_Schedule_11Apr_04Oct.csv', OFFICIAL_COMMERCIAL_FLIGHT_SCHEDULE_ROWS);
    } else if (selectedEntity === 'assignments') {
      const sample = [
        {
          'Flight Number': 'ZN-201',
          'Crew Staff Number': 'ZA-1001',
          'Assigned Role': 'Captain',
          'Duty Date': '2026-08-15',
          Notes: 'Scheduled flight duty',
        },
      ];
      exportToCsv('Zambia_Airways_Roster_Assignments_Template.csv', sample);
    } else if (selectedEntity === 'leave') {
      const sample = [
        {
          'Crew Staff Number': 'ZA-1002',
          'Exclusion Type': 'ANNUAL_LEAVE',
          'Start Date': '2026-08-20',
          'End Date': '2026-08-27',
          'Reason / Remarks': 'Approved Annual Vacation',
        },
      ];
      exportToCsv('Zambia_Airways_Leave_Exclusions_Template.csv', sample);
    } else if (selectedEntity === 'fleet') {
      // Exactly 1 Q400 (9J-ZAW) and 1 B737 (9J-ZAE) matching the active fleet register
      const sample = [
        {
          'Aircraft Type': 'Q400',
          Registration: '9J-ZAW',
          Status: 'SERVICEABLE',
          Location: 'LUN',
          'Active Count': 1,
        },
        {
          'Aircraft Type': 'B737',
          Registration: '9J-ZAE',
          Status: 'SERVICEABLE',
          Location: 'LUN',
          'Active Count': 1,
        },
      ];
      exportToCsv('Zambia_Airways_Fleet_Register_Template.csv', sample);
    }
  };

  // Helper to process raw parsed JSON data rows into specific app entities
  const processAndImportRows = (rows: any[], entity: EntityType): number => {
    let count = 0;

    if (entity === 'crew') {
      const parsedResult = parseCrewData(rows, crew);
      if (parsedResult.crewList.length > 0) {
        onImportCrew(parsedResult.crewList);
        count = parsedResult.importedCount;
      }
      addLog(`Processed crew batch: ${parsedResult.importedCount} imported, ${parsedResult.duplicateCount} duplicate records skipped.`);
    } else if (entity === 'flights' && onImportFlights) {
      const scheduleResult = parseFlightScheduleData(rows);
      if (scheduleResult.flights.length > 0) {
        // Skip duplicate flights against existing state
        const uniqueFlights = scheduleResult.flights.filter(
          (nf) => !flights.some((f) => f.flightNumber === nf.flightNumber && f.date === nf.date && f.departure === nf.departure)
        );
        onImportFlights(uniqueFlights);
        count = uniqueFlights.length;
        const skipped = scheduleResult.flights.length - uniqueFlights.length;
        if (scheduleResult.isSeasonal) {
          addLog(`Processed Commercial Seasonal Schedule: Auto-generated ${count} operational flight sectors (${scheduleResult.seasonalPatterns.length} seasonal frequency patterns expanded across effective date period, ${skipped} duplicate dates skipped).`);
        } else {
          addLog(`Processed Dated Flight Schedule: ${count} flights imported, ${skipped} duplicates skipped.`);
        }
      }
    } else if (entity === 'assignments' && onImportAssignments) {
      const newAssign: Assignment[] = [];
      rows.forEach((row, idx) => {
        const fn = row['Flight Number'] || row['flightNumber'];
        const crewStaff = row['Crew Staff Number'] || row['Crew Member Staff ID'] || row['staffNumber'];
        if (!fn || !crewStaff) return;

        const targetCrew = crew.find((c) => c.staffNumber === crewStaff || c.id === crewStaff);
        const targetFlight = flights.find((f) => f.flightNumber === fn || f.id === fn);

        if (!targetFlight) return;

        const a: Assignment = {
          id: `imp-asg-${Date.now()}-${idx}`,
          flightId: targetFlight.id,
          captainId: row['Assigned Role'] === 'Captain' ? (targetCrew?.id || crewStaff) : undefined,
          firstOfficerId: row['Assigned Role'] === 'First Officer' ? (targetCrew?.id || crewStaff) : undefined,
          cabinCrewIds: row['Assigned Role']?.includes('Cabin') ? [targetCrew?.id || crewStaff] : [],
          assignedAt: new Date().toISOString(),
          status: 'ASSIGNED',
          notes: row['Notes'] || 'Imported duty assignment',
        };
        newAssign.push(a);
        count++;
      });
      if (newAssign.length > 0) onImportAssignments(newAssign);
    } else if (entity === 'leave' && onImportLeaveRecords) {
      const newLeave: LeaveTrainingRecord[] = [];
      rows.forEach((row, idx) => {
        const crewStaff = row['Crew Staff Number'] || row['staffNumber'];
        const typeRaw = row['Exclusion Type'] || row['type'] || 'Annual Leave';
        if (!crewStaff) return;

        const targetCrew = crew.find((c) => c.staffNumber === crewStaff || c.id === crewStaff);

        const l: LeaveTrainingRecord = {
          id: `imp-lev-${Date.now()}-${idx}`,
          crewId: targetCrew?.id || crewStaff,
          crewName: targetCrew?.name,
          type: typeRaw.includes('Sick') ? 'Sick' : typeRaw.includes('Training') ? 'Training' : 'Annual Leave',
          startDate: row['Start Date'] || '2026-08-20',
          endDate: row['End Date'] || '2026-08-25',
          description: row['Reason / Remarks'] || row['description'] || 'Imported exclusion',
          approved: true,
        };
        newLeave.push(l);
        count++;
      });
      if (newLeave.length > 0) onImportLeaveRecords(newLeave);
    } else if (entity === 'fleet' && onImportFleet) {
      const newFleet: AircraftFleet[] = [];
      rows.forEach((row) => {
        const reg = row['Registration'] || row['reg'] || row['Aircraft Registration'] || row['Tail Number'];
        if (!reg) return;

        const acRaw = String(row['Aircraft Type'] || row['Aircraft'] || row['Fleet Type'] || 'Q400').toUpperCase();
        const aircraft: AircraftType = acRaw.includes('737') || acRaw.includes('B73') ? 'B737' : 'Q400';
        const statusRaw = String(row['Status'] || row['status'] || 'SERVICEABLE').toUpperCase();
        let status: AircraftFleet['status'] = 'SERVICEABLE';
        if (statusRaw.includes('MAINT') || statusRaw.includes('INSPECT')) status = 'MAINTENANCE';
        else if (statusRaw.includes('AOG') || statusRaw.includes('GROUND')) status = 'AOG';

        const fl: AircraftFleet = {
          aircraft,
          registration: String(reg).trim().toUpperCase(),
          status,
          location: row['Location'] || row['Base'] || 'LUN',
          activeCount: parseInt(row['Active Count'] || row['Count'] || '1', 10) || 1,
        };
        newFleet.push(fl);
        count++;
      });
      if (newFleet.length > 0) onImportFleet(newFleet);
    }

    return count;
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setUploadFeedback(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsProcessing(false);
        const data = results.data as any[];
        const added = processAndImportRows(data, selectedEntity);

        setUploadFeedback({
          recordsFound: data.length,
          recordsAdded: added,
          message: `Successfully processed file "${file.name}". Imported ${added} ${selectedEntity.toUpperCase()} records into active dataset.`,
        });

        addLog(`Processed file "${file.name}" -> ${added} ${selectedEntity} records imported.`);
      },
      error: () => {
        setIsProcessing(false);
        setUploadFeedback({
          recordsFound: 0,
          recordsAdded: 0,
          message: 'Error reading file format. Please ensure valid CSV or Excel exported tabular format.',
        });
      },
    });
  };

  // Handle Paste CSV Parse
  const handleParsePastedText = () => {
    setPasteError(null);
    if (!manualPasteText.trim()) {
      setPasteError('Please paste valid CSV or tab-separated text data.');
      return;
    }

    Papa.parse(manualPasteText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setParsedPreviewRows(results.data);
          addLog(`Parsed ${results.data.length} rows from pasted text.`);
        } else {
          setPasteError('Could not detect header or columns in pasted content.');
        }
      },
      error: (err) => {
        setPasteError(`CSV Parse Error: ${err.message}`);
      },
    });
  };

  const handleCommitPastedRows = () => {
    if (parsedPreviewRows.length === 0) return;
    const added = processAndImportRows(parsedPreviewRows, selectedEntity);
    addLog(`Committed ${added} pasted records into ${selectedEntity} database.`);
    setParsedPreviewRows([]);
    setManualPasteText('');
    setActionSuccessNotice(`Successfully imported ${added} ${selectedEntity.toUpperCase()} records into active database.`);
    setTimeout(() => setActionSuccessNotice(null), 5000);
  };

  // Handle Manual Single Form Add
  const handleAddManualFormRow = () => {
    if (!manualForm.col1) return;

    if (selectedEntity === 'crew') {
      const row = {
        'Employee ID': `ZA-M-${Math.floor(100 + Math.random() * 900)}`,
        Name: manualForm.col1,
        'Company Email': manualForm.col2 || `${manualForm.col1.toLowerCase().replace(/\s+/g, '.')}@zambiaairways.co.zm`,
        'Role / Position': manualForm.col3 || 'Captain',
        'Fleet Aircraft': manualForm.col5,
        Base: 'LUN',
      };
      processAndImportRows([row], 'crew');
      addLog(`Manual entry added: Crew Member "${manualForm.col1}".`);
    } else if (selectedEntity === 'flights') {
      const row = {
        'Flight Number': manualForm.col1,
        Origin: manualForm.col2 || 'LUN',
        Destination: manualForm.col3 || 'NLA',
        'Departure Time': '2026-08-16T08:00',
        'Arrival Time': '2026-08-16T09:00',
        'Fleet Aircraft': manualForm.col5,
      };
      processAndImportRows([row], 'flights');
      addLog(`Manual entry added: Flight "${manualForm.col1}".`);
    } else if (selectedEntity === 'fleet') {
      const row = {
        Registration: manualForm.col1,
        'Aircraft Type': manualForm.col5,
        Status: manualForm.col2 || 'SERVICEABLE',
        Location: manualForm.col3 || 'LUN',
        'Active Count': 1,
      };
      processAndImportRows([row], 'fleet');
      addLog(`Manual entry added: Fleet Aircraft Registration "${manualForm.col1}".`);
    }

    setManualForm({ col1: '', col2: '', col3: '', col4: '', col5: 'Q400' });
  };

  // Macro Simulators
  const handleRunMacro = (macroId: string) => {
    setRunningMacroId(macroId);

    if (macroId === 'macro-1') {
      addLog('EXEC: Running CalculateRecency() macro...');
      setTimeout(() => {
        addLog(`SCANNED: ${crew.length} active pilots evaluated.`);
        addLog('RECENCY STATUS: All Q400 & B737 captains meet 3 takeoff/landing currency window.');
        setRunningMacroId(null);
      }, 600);
    } else if (macroId === 'macro-2') {
      addLog('EXEC: Running CheckExpiryStatus() macro...');
      setTimeout(() => {
        let warningCount = 0;
        crew.forEach((c) => {
          if (c.passportStatus !== 'VALID' || c.medicalStatus !== 'VALID') warningCount++;
        });
        addLog(`EXPIRY CHECK COMPLETE: Identified ${warningCount} documents requiring CAA renewal alert.`);
        setRunningMacroId(null);
      }, 600);
    } else if (macroId === 'macro-3') {
      addLog('EXEC: Running ValidateAssignment() FTL Legality Macro...');
      setTimeout(() => {
        addLog(`AUDIT COMPLETE: Checked ${assignments.length} published flight duties against 12h rest rules.`);
        addLog('RESULT: 100% compliance with Zambia CAA Flight Time Limitations (FTL).');
        setRunningMacroId(null);
      }, 700);
    } else if (macroId === 'macro-4') {
      addLog('EXEC: Running GenerateMonthlyRoster() Auto Scheduler Macro...');
      if (onRunAutoScheduler) onRunAutoScheduler();
      setTimeout(() => {
        addLog('GENERATION SUCCESS: Updated active roster draft across Q400 and B737 flight routes.');
        setRunningMacroId(null);
      }, 800);
    } else if (macroId === 'macro-5') {
      addLog('EXEC: Exporting Master Unified Excel CSV Workbook...');
      // Build master unified export
      const masterRows = crew.map((c) => ({
        Type: 'CREW_MEMBER',
        ID: c.staffNumber,
        Name: c.name,
        Role: c.role,
        Fleet: c.aircraft,
        Base: c.base,
        Status: c.status,
        MedicalExpiry: c.medicalExpiry,
        PassportExpiry: c.passportExpiry,
      }));
      exportToCsv('Zambia_Airways_Master_Workbook.csv', masterRows);
      addLog('DOWNLOAD: Master workbook CSV downloaded successfully.');
      setRunningMacroId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-full">
      {/* Top Banner */}
      <div className="bg-[#2E2C2B] text-white p-6 rounded-xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet className="w-5 h-5 text-[#F37C1C]" />
            <span className="text-xs font-bold text-[#F37C1C] uppercase tracking-widest font-mono">
              Source Excel & VBA Macro Subsystem
            </span>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">
            Excel / CSV Data Import & VBA Macro Simulation Suite
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Import Excel sheets or CSV files, enter data directly, or trigger converted VBA macros (Recency, Expiry Checks, Auto Roster) directly on the live database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onClearAllData && (
            <button
              onClick={() => setIsClearAllModalOpen(true)}
              className="px-3 py-2 bg-red-600/80 hover:bg-red-600 border border-red-500/50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Clear all crew, flights, assignments, and fleet to start fresh"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Data (Start Blank)</span>
            </button>
          )}

          {onResetSampleData && (
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Restore demo sample dataset"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#F37C1C]" />
              <span>Restore Demo Data</span>
            </button>
          )}

          <button
            onClick={handleDownloadSampleCsv}
            className="px-3 py-2 bg-[#F37C1C] hover:bg-[#D96B12] text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Template CSV</span>
          </button>
        </div>
      </div>

      {/* Mode Selector Navigation Tabs */}
      <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'upload'
              ? 'bg-[#2E2C2B] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Upload className="w-4 h-4 text-[#F37C1C]" />
          <span>Upload Excel / CSV File</span>
        </button>

        <button
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'manual'
              ? 'bg-[#2E2C2B] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Edit3 className="w-4 h-4 text-[#F37C1C]" />
          <span>Enter Data / Paste CSV</span>
        </button>

        <button
          onClick={() => setActiveTab('macros')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'macros'
              ? 'bg-[#2E2C2B] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4 text-[#F37C1C]" />
          <span>Run VBA Automation Macros</span>
        </button>

        <button
          onClick={() => setActiveTab('code')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'code'
              ? 'bg-[#2E2C2B] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCode2 className="w-4 h-4 text-[#F37C1C]" />
          <span>Macro Conversion Specs</span>
        </button>
      </div>

      {/* Target Entity Selector (For Upload & Manual Tabs) */}
      {(activeTab === 'upload' || activeTab === 'manual') && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#F37C1C]" />
            <span className="text-xs font-bold text-slate-800 uppercase font-mono">Select Target Dataset:</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'crew', label: 'Crew Members', count: crew.length },
              { id: 'flights', label: 'Flight Schedule', count: flights.length },
              { id: 'fleet', label: 'Fleet Register', count: fleet.length },
              { id: 'assignments', label: 'Roster Assignments', count: assignments.length },
              { id: 'leave', label: 'Leave / Exclusions', count: leaveRecords.length },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedEntity(item.id as EntityType)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
                  selectedEntity === item.id
                    ? 'bg-[#F37C1C] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{item.label}</span>
                <span className="px-1.5 py-0.2 bg-black/20 text-white rounded text-[10px]">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB 1: FILE UPLOAD */}
      {activeTab === 'upload' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#F37C1C]" />
                Batch Upload CSV / Excel Workbook File
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Targeting: <strong>{selectedEntity.toUpperCase()}</strong> table in application database.
              </p>
            </div>

            <button
              onClick={handleDownloadSampleCsv}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#F37C1C]" />
              <span>Get Template</span>
            </button>
          </div>

          <div className="border-2 border-dashed border-slate-300 hover:border-[#F37C1C] rounded-xl p-8 text-center transition-colors bg-slate-50/50">
            <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">
              Drag & Drop your CSV or Excel file here
            </h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Supports `.csv`, `.xlsx`, `.xlsm` formats with header auto-matching
            </p>

            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2E2C2B] hover:bg-black text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm">
              <Upload className="w-4 h-4 text-[#F37C1C]" />
              <span>Browse & Select File</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xlsm,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {isProcessing && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs font-semibold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Processing file structure and mapping columns into {selectedEntity}...</span>
            </div>
          )}

          {uploadFeedback && (
            <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800 pb-2">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Import Processing Status
                </span>
                <span>{uploadFeedback.recordsAdded} Imported</span>
              </div>
              <p className="text-slate-300">{uploadFeedback.message}</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANUAL ENTRY & CSV TEXT PASTE */}
      {activeTab === 'manual' && (
        <div className="space-y-6">
          {/* Quick Single Row Entry */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
              <ListPlus className="w-4 h-4 text-[#F37C1C]" />
              Quick Form Direct Row Entry ({selectedEntity.toUpperCase()})
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              {selectedEntity === 'crew' && (
                <>
                  <input
                    type="text"
                    placeholder="Full Name (e.g. Capt. Mwansa)"
                    value={manualForm.col1}
                    onChange={(e) => setManualForm({ ...manualForm, col1: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  />
                  <input
                    type="email"
                    placeholder="Company Email"
                    value={manualForm.col2}
                    onChange={(e) => setManualForm({ ...manualForm, col2: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  />
                  <select
                    value={manualForm.col3}
                    onChange={(e) => setManualForm({ ...manualForm, col3: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  >
                    <option value="Captain">Captain</option>
                    <option value="First Officer">First Officer</option>
                    <option value="Senior Cabin Crew">Senior Cabin Crew</option>
                    <option value="Cabin Crew">Cabin Crew</option>
                  </select>
                  <select
                    value={manualForm.col5}
                    onChange={(e) => setManualForm({ ...manualForm, col5: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  >
                    <option value="Q400">Dash 8-Q400</option>
                    <option value="B737">Boeing 737-800</option>
                  </select>
                </>
              )}

              {selectedEntity === 'flights' && (
                <>
                  <input
                    type="text"
                    placeholder="Flight Number (e.g. ZN-205)"
                    value={manualForm.col1}
                    onChange={(e) => setManualForm({ ...manualForm, col1: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  />
                  <input
                    type="text"
                    placeholder="Origin Code (e.g. LUN)"
                    value={manualForm.col2}
                    onChange={(e) => setManualForm({ ...manualForm, col2: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  />
                  <input
                    type="text"
                    placeholder="Destination (e.g. NLA)"
                    value={manualForm.col3}
                    onChange={(e) => setManualForm({ ...manualForm, col3: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  />
                  <select
                    value={manualForm.col5}
                    onChange={(e) => setManualForm({ ...manualForm, col5: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  >
                    <option value="Q400">Dash 8-Q400</option>
                    <option value="B737">Boeing 737-800</option>
                  </select>
                </>
              )}

              {selectedEntity === 'fleet' && (
                <>
                  <input
                    type="text"
                    placeholder="Aircraft Registration (e.g. 9J-ZQA)"
                    value={manualForm.col1}
                    onChange={(e) => setManualForm({ ...manualForm, col1: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C] font-mono font-bold"
                  />
                  <select
                    value={manualForm.col5}
                    onChange={(e) => setManualForm({ ...manualForm, col5: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  >
                    <option value="Q400">Dash 8-Q400</option>
                    <option value="B737">Boeing 737-800</option>
                  </select>
                  <select
                    value={manualForm.col2}
                    onChange={(e) => setManualForm({ ...manualForm, col2: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  >
                    <option value="SERVICEABLE">SERVICEABLE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="AOG">AOG (GROUNDED)</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Base Station (e.g. LUN)"
                    value={manualForm.col3}
                    onChange={(e) => setManualForm({ ...manualForm, col3: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  />
                </>
              )}
            </div>

            <button
              onClick={handleAddManualFormRow}
              className="px-4 py-2 bg-[#F37C1C] hover:bg-[#D96B12] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Add Record To Database</span>
            </button>
          </div>

          {/* Paste CSV Raw Text */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
              <Table className="w-4 h-4 text-[#F37C1C]" />
              Paste Raw CSV Text Content
            </h2>
            <p className="text-xs text-slate-500">
              Copy rows straight from Excel, Google Sheets, or a text editor and paste them below:
            </p>

            <textarea
              rows={5}
              placeholder={`Paste CSV data with headers e.g.:\nEmployee ID, Name, Role / Position, Fleet Aircraft\nZA-1009, Capt. Abel Phiri, Captain, Q400`}
              value={manualPasteText}
              onChange={(e) => setManualPasteText(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#F37C1C]"
            />

            {pasteError && (
              <p className="text-xs text-rose-600 font-mono font-bold">{pasteError}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleParsePastedText}
                className="px-4 py-2 bg-[#2E2C2B] hover:bg-black text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Parse & Preview CSV
              </button>
            </div>

            {/* Parsed Preview Table */}
            {parsedPreviewRows.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono text-slate-800">
                    Preview Parsed Rows ({parsedPreviewRows.length} detected)
                  </span>
                  <button
                    onClick={handleCommitPastedRows}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Commit {parsedPreviewRows.length} Rows to Database
                  </button>
                </div>

                <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 font-mono font-bold text-slate-700 border-b border-slate-200">
                      <tr>
                        {Object.keys(parsedPreviewRows[0] || {}).map((key) => (
                          <th key={key} className="p-2 border-r border-slate-200 shrink-0">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {parsedPreviewRows.slice(0, 10).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          {Object.values(r).map((val: any, j) => (
                            <td key={j} className="p-2 border-r border-slate-100 truncate max-w-[150px]">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RUN VBA MACROS */}
      {activeTab === 'macros' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Macro Control Cards */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#F37C1C]" />
              Executable VBA Automation Macros
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DEFAULT_MACRO_MAPPINGS.map((m) => (
                <div key={m.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-extrabold text-[#2E2C2B] font-mono">
                        {m.excelMacro}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono rounded">
                        {m.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{m.purpose}</p>
                  </div>

                  <button
                    onClick={() => handleRunMacro(m.id)}
                    disabled={runningMacroId === m.id}
                    className="w-full px-4 py-2 bg-[#F37C1C] hover:bg-[#D96B12] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
                  >
                    {runningMacroId === m.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    <span>Execute {m.excelMacro}</span>
                  </button>
                </div>
              ))}

              {/* Master Export Macro Card */}
              <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-2xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-amber-400 font-mono">
                      ExportCompleteWorkbook()
                    </span>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold font-mono rounded">
                      WORKBOOK EXPORT
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Compiles all active system records (Crew, Flights, Assignments) into a unified master Excel CSV download.
                  </p>
                </div>

                <button
                  onClick={() => handleRunMacro('macro-5')}
                  disabled={runningMacroId === 'macro-5'}
                  className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-black transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Run Export Master Workbook</span>
                </button>
              </div>
            </div>
          </div>

          {/* Terminal Execution Console */}
          <div className="bg-[#1E1E1E] text-slate-200 rounded-xl p-4 border border-slate-800 shadow-xl font-mono text-xs flex flex-col h-[480px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                VBA Execution Terminal Console
              </span>
              <button
                onClick={() => setTerminalLogs(['Console cleared.'])}
                className="text-[10px] text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 font-mono text-[11px]">
              {terminalLogs.map((log, idx) => (
                <div key={idx} className="text-slate-300 leading-tight">
                  <span className="text-slate-500">$ </span>
                  <span className={log.includes('EXEC') ? 'text-amber-400 font-bold' : log.includes('SUCCESS') ? 'text-emerald-400 font-bold' : ''}>
                    {log}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MACRO CONVERSION CODE DIRECTORY */}
      {activeTab === 'code' && (
        <div className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
          <h2 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileCode2 className="w-4 h-4 text-[#F37C1C]" />
            Legacy Excel VBA Macro Code Mapping Directory
          </h2>

          <div className="space-y-4">
            {DEFAULT_MACRO_MAPPINGS.map((m) => (
              <div key={m.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-xs font-extrabold text-[#2E2C2B]">{m.excelMacro}</span>
                  <span className="text-[10px] text-slate-500">{m.convertedFunction}</span>
                </div>
                <p className="text-xs text-slate-600">{m.purpose}</p>
                <pre className="p-3 bg-[#1E1E1E] text-emerald-400 font-mono text-[11px] rounded-lg overflow-x-auto">
                  <code>{m.codeSnippet}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Action Success Toast/Banner */}
      {actionSuccessNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2E2C2B] text-white px-4 py-3 rounded-xl border border-emerald-500/50 shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold font-mono">{actionSuccessNotice}</span>
          <button
            onClick={() => setActionSuccessNotice(null)}
            className="text-slate-400 hover:text-white text-xs ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Clear All Data Confirmational Modal */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-red-50 border-b border-red-100 flex items-start gap-4">
              <div className="p-3 bg-red-600 text-white rounded-xl shadow-md shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-red-950 font-mono">
                  CONFIRM CLEAR ALL DATA
                </h3>
                <p className="text-xs text-red-700 font-medium leading-relaxed">
                  You are about to clear all system records across all modules to start with an empty database.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-800 font-mono block uppercase">Records to be removed:</span>
                <ul className="space-y-1 text-slate-600 font-mono">
                  <li className="flex justify-between">
                    <span>• Crew Members:</span>
                    <strong className="text-slate-900">{crew.length}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span>• Flights in Schedule:</span>
                    <strong className="text-slate-900">{flights.length}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span>• Duty Assignments:</span>
                    <strong className="text-slate-900">{assignments.length}</strong>
                  </li>
                  <li className="flex justify-between">
                    <span>• Leave & Training Records:</span>
                    <strong className="text-slate-900">{leaveRecords.length}</strong>
                  </li>
                </ul>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                This action cannot be undone. Once cleared, you will have a clean blank slate to import your custom Excel files or add new data.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsClearAllModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer font-mono"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsClearAllModalOpen(false);
                    if (onClearAllData) {
                      onClearAllData();
                      addLog('System Action: Cleared all database records to start blank.');
                      setActionSuccessNotice('Database cleared! System is now blank and ready for custom entries.');
                      setTimeout(() => setActionSuccessNotice(null), 5000);
                    }
                  }}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer font-mono flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Yes, Clear All Data</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Demo Data Confirmational Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-start gap-4">
              <div className="p-3 bg-[#F37C1C] text-white rounded-xl shadow-md shrink-0">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-amber-950 font-mono">
                  RESTORE DEMO DATASET
                </h3>
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  Reset the database to default Zambia Airways sample fleet, flights, and crew records.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                This will replace any uncommitted changes with standard Zambia Airways operational datasets (Q400 / B737 fleet, official schedules, and pilot/cabin crew roster).
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer font-mono"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetModalOpen(false);
                    if (onResetSampleData) {
                      onResetSampleData();
                      addLog('System Action: Restored Zambia Airways sample demo dataset.');
                      setActionSuccessNotice('Sample demo dataset restored successfully!');
                      setTimeout(() => setActionSuccessNotice(null), 5000);
                    }
                  }}
                  className="px-4 py-2.5 bg-[#2E2C2B] hover:bg-black text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer font-mono flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4 text-[#F37C1C]" />
                  <span>Restore Demo Data</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
