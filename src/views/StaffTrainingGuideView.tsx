import React, { useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Download,
  HelpCircle,
  Clock,
  Shield,
  Award,
  Users,
  Cpu,
  Printer,
  ChevronRight,
  Flame,
  FileCheck2,
  Calendar,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Info,
  Zap,
  Plane,
  RotateCcw,
  CalendarOff,
  Database,
  Lock,
  Layers,
  Activity,
  Check,
  Building,
} from 'lucide-react';
import { ZambiaAirwaysLogo } from '../components/ZambiaAirwaysLogo';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'According to CAA Zambia FTL rules, what is the standard minimum required rest period prior to a Flight Duty Period (FDP)?',
    options: [
      '8 hours or the length of the preceding duty period',
      '10 hours or the length of the preceding duty period, whichever is greater',
      '12 hours fixed for all domestic flights',
      '6 hours if staying at base in Lusaka (LUN)',
    ],
    correctIndex: 1,
    explanation:
      'Standard CAA Flight Time Limitations require a minimum rest period of at least 10 hours or the duration of the preceding duty period (whichever is greater) to prevent crew fatigue.',
  },
  {
    id: 2,
    question: 'Under CAA ZCAR Part 8 and ICAO Annex 6, what are the pilot recency requirements for flight deck crew to operate revenue flights?',
    options: [
      'At least 1 flight per month on any aircraft type',
      'At least 3 takeoffs and 3 landings within the preceding 90 days on type (or approved simulator)',
      '100 block hours per calendar year',
      'A valid driver license and passport only',
    ],
    correctIndex: 1,
    explanation:
      'Pilots must maintain 90-day currency consisting of at least 3 takeoffs and 3 landings on the specific type rating (Q400 or B737) to remain legally qualified for revenue operations.',
  },
  {
    id: 3,
    question: 'How frequently must Line Checks be conducted for Flight Deck crew (Captains and First Officers) at Zambia Airways?',
    options: [
      'Every 3 months (quarterly)',
      'Every 12 calendar months per aircraft type rating',
      'Every 24 months during recency audit',
      'Only after 1,000 flight block hours',
    ],
    correctIndex: 1,
    explanation:
      'Line Checks are mandatory regulatory evaluations conducted every 12 months per aircraft type rating (Q400 / B737) by a certified Designated Check Pilot or Training Captain.',
  },
  {
    id: 4,
    question: 'When a crew member is registered for approved annual leave or simulator recurrent training in the Leave & Training module, how does the system respond?',
    options: [
      'It deletes the crew member profile permanently',
      'The Auto Scheduler and Legality Engine automatically exclude them from flight assignments during the specified date range',
      'It sends a fine notification to the crew member',
      'It allows overlapping flight assignments without warnings',
    ],
    correctIndex: 1,
    explanation:
      'Approved leave, simulator checks, and medical appointments trigger automatic availability exclusions, preventing the Auto Scheduler or manual dispatchers from booking overlapping flights.',
  },
  {
    id: 5,
    question: 'If a crew member reaches 100% of their monthly flight duty hour limit (100h) or 7-day limit (30h), what color alert is displayed in the Fatigue Monitoring Matrix?',
    options: ['Yellow (Caution)', 'Green (Normal)', 'Red (Limit Reached / Blocked)', 'Blue (Under Review)'],
    correctIndex: 2,
    explanation:
      'Red status indicates that the crew member has reached 100% of their regulatory planning duty limit and must not be assigned further duty without mandatory rest.',
  },
  {
    id: 6,
    question: 'What is the function of the "Auto Generate Draft Roster" engine in the OCC system?',
    options: [
      'It automatically sends flight tickets to passengers',
      'It runs a deterministic legality algorithm matching flights with qualified, rest-compliant crew while balancing fatigue',
      'It cancels unassigned flights automatically',
      'It deletes expired pilot licenses from the database',
    ],
    correctIndex: 1,
    explanation:
      'The Auto Scheduler algorithm matches open flight legs with available, qualified crew while strictly enforcing FTL rest, recency, and license validity rules.',
  },
  {
    id: 7,
    question: 'Where can OCC controllers import legacy Excel workbooks like "Recency Tracker.xlsm" or "Crew Hour Monitoring FD and CC.xlsm" and run converted VBA macros?',
    options: [
      'Settings -> Network Config',
      'Legacy Excel System Mapping module',
      'Audit Log tab',
      'Reports -> Printable PDF',
    ],
    correctIndex: 1,
    explanation:
      'The Legacy Excel System Mapping view allows direct drag-and-drop import, CSV text pasting, and automated macro conversion from legacy Excel workbooks into the unified web database.',
  },
  {
    id: 8,
    question: 'How are system actions, roster changes, and legality overrides secured in the Zambia Airways Crew Control System?',
    options: [
      'They are kept in temporary browser memory only',
      'Every action is recorded in an immutable Audit Log with SHA-256 integrity sealing and real-time cloud synchronization',
      'They are printed on paper at the end of each month',
      'They require no logging or tracking',
    ],
    correctIndex: 1,
    explanation:
      'The system records every operational change, manual override, line check renewal, and user switch in a cryptographic Audit Log with verified seals for CAA inspection.',
  },
];

interface ModuleInfo {
  id: string;
  name: string;
  icon: React.ElementType;
  badge: string;
  category: 'Operations' | 'Planning' | 'Compliance' | 'Administration';
  summary: string;
  keyFeatures: string[];
  sopReference: string;
}

const SYSTEM_MODULES: ModuleInfo[] = [
  {
    id: 'dashboard',
    name: 'OCC Operations Dashboard',
    icon: Activity,
    badge: 'Live Overview',
    category: 'Operations',
    summary: 'Executive flight operations control hub displaying live fleet status, flight movements, open crew assignments, and critical fatigue alerts.',
    keyFeatures: [
      'Fleet Aircraft Status (Dash 8 Q400 & Boeing 737-800)',
      'Today Flights departure schedule & crew readiness',
      'Fatigue & Recency alert counters (Rolling 7d / 28d breaches)',
      'Quick action shortcuts for shift handover & auto-dispatch',
    ],
    sopReference: 'SOP 101',
  },
  {
    id: 'roster',
    name: 'Master Roster Calendar',
    icon: Calendar,
    badge: 'Planning & Gantt',
    category: 'Planning',
    summary: 'Visual monthly and weekly crew scheduling board supporting drag-and-drop duty assignments, standby coverage, and visual flight leg inspection.',
    keyFeatures: [
      'Monthly, weekly, and daily timeline Gantt views',
      'Flight Deck vs Cabin Crew filtered scheduling tracks',
      'Color-coded duty statuses (Assigned, Standby, Training, Leave)',
      'One-click flight leg assignment editor with instant legality check',
    ],
    sopReference: 'SOP 102',
  },
  {
    id: 'recency',
    name: 'Pilot Recency & Currency Tracker',
    icon: RotateCcw,
    badge: 'CAA ZCAR Part 8',
    category: 'Compliance',
    summary: 'Dedicated 90-day currency tracker enforcing 3 takeoffs and 3 landings on aircraft type ratings for all Captains and First Officers.',
    keyFeatures: [
      '90-day rolling lookback window calculation',
      'Automated takeoff & landing counters from flight sector history',
      'Color-coded currency badges: Current, Due Soon (<14d), Expired',
      'Direct sector logging & CSV recency compliance audit export',
    ],
    sopReference: 'SOP 103',
  },
  {
    id: 'training',
    name: 'Crew Leave & Training Management',
    icon: CalendarOff,
    badge: 'Exclusions Engine',
    category: 'Planning',
    summary: 'Centralized registry for crew annual leave, recurrent simulator checks, medical renewals, and ground school training with auto-exclusion.',
    keyFeatures: [
      'Event scheduling across 8 categories (Annual Leave, Simulator, Sick, Medical, etc.)',
      'Auto-exclusion badge & banner feeding directly into the Auto-Scheduler',
      'Approved vs Pending authorization workflow',
      'Exclusion range conflict prevention during manual roster edits',
    ],
    sopReference: 'SOP 104',
  },
  {
    id: 'flights',
    name: 'Flight Monitoring & Sector Logging',
    icon: Plane,
    badge: 'Sector Dispatch',
    category: 'Operations',
    summary: 'Operational flight database maintaining scheduled sectors, STD/STA block times, aircraft registration assignments, and crew complements.',
    keyFeatures: [
      'Comprehensive route management (LUN, NLA, LVI, MFU, SLI, HRE, LLW, JNB, NBO)',
      'Multi-sector pairing and flight duty period (FDP) calculation',
      'Import / Export flight schedule CSV tools',
      'Real-time flight status tagging (Scheduled, Boarding, Airborne, Arrived)',
    ],
    sopReference: 'SOP 105',
  },
  {
    id: 'crew',
    name: 'Crew Database & Profile Registry',
    icon: Users,
    badge: 'Staff Registry',
    category: 'Administration',
    summary: 'Master directory of all flight deck and cabin crew with aircraft type ratings, seniority, base location, contact details, and qualifications.',
    keyFeatures: [
      'Dual-fleet type rating filtering (Q400 / B737-800 / Dual)',
      'Crew qualification matrix (Captain, First Officer, SCCM, CCM)',
      'Direct profile editing with staff number and contact records',
      'Cumulative flight hour totals and base tracking (Lusaka KKIA)',
    ],
    sopReference: 'SOP 101',
  },
  {
    id: 'linecheck',
    name: 'Line Check & Recurrent Evaluations',
    icon: FileCheck2,
    badge: '12-Month Validity',
    category: 'Compliance',
    summary: 'Mandatory annual line check tracker monitoring evaluation deadlines, Designated Check Pilot signatures, and recurrent check schedules.',
    keyFeatures: [
      '12-month rolling validity lookahead calendar',
      'Expiring in 30 / 60 / 90 days warning filters',
      'Check Pilot sign-off modal with evaluator staff ID recording',
      'One-click line check certificate renewal and audit logging',
    ],
    sopReference: 'SOP 105',
  },
  {
    id: 'fatigue',
    name: 'Fatigue Monitoring Matrix',
    icon: Flame,
    badge: 'FTL Safety',
    category: 'Compliance',
    summary: 'Real-time cumulative flight duty hour monitoring against CAA Zambia Flight Time Limitations across 7-day, 14-day, 28-day, and annual limits.',
    keyFeatures: [
      'Rolling 7-day block hours (Max 30h limit)',
      'Rolling 14-day duty hours (Max 60h limit)',
      'Rolling 28-day monthly block hours (Max 100h limit)',
      'Annual 1,000h cap monitoring with automatic roster blocking',
    ],
    sopReference: 'SOP 102',
  },
  {
    id: 'scheduler',
    name: 'Auto-Scheduler & Roster Optimizer',
    icon: Cpu,
    badge: 'Deterministic Engine',
    category: 'Planning',
    summary: 'Automated roster generation algorithm matching open flights with legal, qualified, and rested crew members in compliance with CAA FTL regulations.',
    keyFeatures: [
      'Multi-pass scheduling algorithm prioritizing fleet type rating and seniority',
      'Rest period enforcement (>10h between duties) and leave exclusions',
      'Optimization pass to balance cumulative flight hours among crew',
      'One-click draft generation with pre-compliance legality auditing',
    ],
    sopReference: 'SOP 102',
  },
  {
    id: 'legality',
    name: 'Legality Rule Engine & Conflict Checker',
    icon: Shield,
    badge: 'Strict Enforcement',
    category: 'Compliance',
    summary: 'Rule enforcement subsystem that validates every flight assignment against 14 CAA and airline flight safety parameters in real time.',
    keyFeatures: [
      'Instant detection of overlapping duties and double-bookings',
      'Insufficient rest warnings (<10h) between consecutive sectors',
      'Expired medical, license, or line check blocker',
      'Managerial override protocol with required justification note and audit log',
    ],
    sopReference: 'SOP 101',
  },
  {
    id: 'legacy-excel',
    name: 'Legacy Excel Mapping & VBA Automation',
    icon: Database,
    badge: 'Macro Engine',
    category: 'Administration',
    summary: 'Data migration and Excel synchronization bridge allowing import of .xlsx/.xlsm files, direct CSV pasting, and execution of converted VBA macros.',
    keyFeatures: [
      'Downloadable CSV template packages for Crew, Flights, and Roster',
      'Direct copy-paste parser for instant Excel text ingestion',
      'VBA Macro Engine running CalculateRecency(), CheckExpiryStatus(), etc.',
      'Live VBA Terminal outputting detailed execution logs and record counts',
    ],
    sopReference: 'SOP 106',
  },
  {
    id: 'users',
    name: 'User Access & RBAC Role Permissions',
    icon: Lock,
    badge: 'Security & Auth',
    category: 'Administration',
    summary: 'Role-Based Access Control module managing system users, login credentials, granular feature permissions, and active session switches.',
    keyFeatures: [
      '7 predefined operational roles (Super Admin, OCC Controller, Scheduler, Chief Pilot, etc.)',
      'Granular permission toggles (Roster edit, FTL rules, User management)',
      'Password protection and secure credentials update modal',
      'Active session persona switcher for multi-role operational testing',
    ],
    sopReference: 'SOP 107',
  },
  {
    id: 'assistant',
    name: 'Gemini AI OCC Flight Assistant',
    icon: Sparkles,
    badge: 'Intelligent AI',
    category: 'Operations',
    summary: 'Context-aware AI conversational assistant powered by Google Gemini, capable of answering FTL rules, querying available crew, and resolving dispatch questions.',
    keyFeatures: [
      'Natural language queries (e.g., "Which Captains are rested for flight ZN101?")',
      'Instant FTL regulation explanation and rest calculation breakdown',
      'Operational guidance for handling flight delays, aircraft swaps, and IROPS',
      'Safe fallback and structured responses for flight dispatchers',
    ],
    sopReference: 'SOP 108',
  },
  {
    id: 'audit',
    name: 'Cryptographic System Audit Log',
    icon: FileText,
    badge: 'Immutable Seals',
    category: 'Compliance',
    summary: 'Tamper-evident audit trail recording every roster change, manual override, user creation, and database sync with cryptographic hash seals.',
    keyFeatures: [
      'SHA-256 hash sealing for immutable record verification',
      'Detailed event context: User, Staff ID, Timestamp, Action, Severity',
      'Filterable by severity level (INFO, WARNING, CRITICAL)',
      'Exportable audit log for CAA regulatory oversight and internal safety reviews',
    ],
    sopReference: 'SOP 107',
  },
];

export const StaffTrainingGuideView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'modules' | 'roles' | 'sop' | 'qrc' | 'quiz'>('modules');
  const [selectedRole, setSelectedRole] = useState<'occ' | 'roster' | 'admin' | 'chief' | 'crew' | 'compliance' | 'sysadmin'>('occ');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectAnswer = (qId: number, optionIdx: number) => {
    if (showQuizResults) return;
    setQuizAnswers((prev) => ({ ...prev, [qId]: optionIdx }));
  };

  const handleResetQuiz = () => {
    setQuizAnswers({});
    setShowQuizResults(false);
  };

  const calculateScore = () => {
    let score = 0;
    QUIZ_QUESTIONS.forEach((q) => {
      if (quizAnswers[q.id] === q.correctIndex) {
        score++;
      }
    });
    return score;
  };

  const handlePrintManual = () => {
    window.print();
  };

  const filteredModules = SYSTEM_MODULES.filter((m) => {
    const matchesCategory = selectedCategory === 'ALL' || m.category === selectedCategory;
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.keyFeatures.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-full">
      {/* Top Header Banner */}
      <div className="bg-[#2E2C2B] text-white p-6 rounded-xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="w-5 h-5 text-[#F37C1C]" />
            <span className="text-xs font-bold text-[#F37C1C] uppercase tracking-widest font-mono">
              Zambia Airways Operational Training & Standards Manual
            </span>
          </div>
          <h1 className="text-xl font-black tracking-tight">
            Staff Training Manual & System Operating Guide
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
            Comprehensive system documentation covering all 14 operational modules, Pilot Recency (90-day currency), Crew Leave & Training Exclusions, Standard Operating Procedures (SOP 101–108), CAA Zambia FTL compliance matrix, and interactive staff competency evaluation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrintManual}
            className="px-4 py-2 bg-[#F37C1C] hover:bg-[#D96B12] text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF Manual</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setActiveTab('modules')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'modules' ? 'bg-[#F37C1C] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>System Modules Directory</span>
          </button>

          <button
            onClick={() => setActiveTab('roles')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'roles' ? 'bg-[#F37C1C] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Role-Based Training</span>
          </button>

          <button
            onClick={() => setActiveTab('sop')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'sop' ? 'bg-[#F37C1C] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>SOP Workflows (101–108)</span>
          </button>

          <button
            onClick={() => setActiveTab('qrc')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'qrc' ? 'bg-[#F37C1C] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Quick Reference & FTL</span>
          </button>

          <button
            onClick={() => setActiveTab('quiz')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'quiz' ? 'bg-[#F37C1C] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Competency Quiz</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search guides, modules & SOPs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#F37C1C]"
          />
        </div>
      </div>

      {/* TAB 0: ALL SYSTEM MODULES DIRECTORY */}
      {activeTab === 'modules' && (
        <div className="space-y-6">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase font-mono">Filter by Category:</span>
              {['ALL', 'Operations', 'Planning', 'Compliance', 'Administration'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#2E2C2B] text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Showing {filteredModules.length} of {SYSTEM_MODULES.length} Modules
            </span>
          </div>

          {/* Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredModules.map((mod) => {
              const IconComp = mod.icon;
              return (
                <div
                  key={mod.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition-shadow space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-orange-50 text-[#F37C1C] border border-orange-200 flex items-center justify-center">
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-900 leading-snug">{mod.name}</h3>
                          <span className="text-[10px] text-slate-400 font-mono">{mod.category}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">
                        {mod.badge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{mod.summary}</p>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-wider">
                        Key Capabilities:
                      </div>
                      <ul className="space-y-1 text-slate-700 text-xs">
                        {mod.keyFeatures.map((feat, fIdx) => (
                          <li key={fIdx} className="flex items-start gap-1.5 text-[11px] leading-tight">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-mono">Reference: {mod.sopReference}</span>
                    <span className="text-[#F37C1C] font-bold flex items-center gap-1 font-mono">
                      Integrated Module <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 1: ROLE-BASED TRAINING MODULES */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sub-role selector sidebar */}
          <div className="lg:col-span-3 space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono px-1">
              Select Operational Role
            </h3>

            <button
              onClick={() => setSelectedRole('occ')}
              className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedRole === 'occ'
                  ? 'border-[#F37C1C] bg-orange-50/60 text-[#2E2C2B] font-bold shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#2E2C2B] text-[#F37C1C] flex items-center justify-center font-bold text-xs">
                  OCC
                </div>
                <div>
                  <div className="text-xs font-bold">OCC Flight Controller</div>
                  <div className="text-[10px] text-slate-500">Fleet & Roster Operations</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => setSelectedRole('roster')}
              className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedRole === 'roster'
                  ? 'border-[#F37C1C] bg-orange-50/60 text-[#2E2C2B] font-bold shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                  SCH
                </div>
                <div>
                  <div className="text-xs font-bold">Crew Scheduler</div>
                  <div className="text-[10px] text-slate-500">Auto Roster & Optimization</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => setSelectedRole('admin')}
              className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedRole === 'admin'
                  ? 'border-[#F37C1C] bg-orange-50/60 text-[#2E2C2B] font-bold shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  ADM
                </div>
                <div>
                  <div className="text-xs font-bold">Crew Admin & Records</div>
                  <div className="text-[10px] text-slate-500">Line Checks & Medicals</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => setSelectedRole('chief')}
              className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedRole === 'chief'
                  ? 'border-[#F37C1C] bg-orange-50/60 text-[#2E2C2B] font-bold shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                  CPT
                </div>
                <div>
                  <div className="text-xs font-bold">Chief Pilot & Flight Ops</div>
                  <div className="text-[10px] text-slate-500">Recency & Line Check Sign-off</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => setSelectedRole('crew')}
              className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedRole === 'crew'
                  ? 'border-[#F37C1C] bg-orange-50/60 text-[#2E2C2B] font-bold shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                  CRW
                </div>
                <div>
                  <div className="text-xs font-bold">Flight Crew (Self-Service)</div>
                  <div className="text-[10px] text-slate-500">Personal Portal & Roster Sign</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => setSelectedRole('compliance')}
              className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedRole === 'compliance'
                  ? 'border-[#F37C1C] bg-orange-50/60 text-[#2E2C2B] font-bold shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                  CAA
                </div>
                <div>
                  <div className="text-xs font-bold">Compliance & Audit</div>
                  <div className="text-[10px] text-slate-500">CAA Regulations & Audit Logs</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={() => setSelectedRole('sysadmin')}
              className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                selectedRole === 'sysadmin'
                  ? 'border-[#F37C1C] bg-orange-50/60 text-[#2E2C2B] font-bold shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-[#F37C1C] flex items-center justify-center font-bold text-xs">
                  SYS
                </div>
                <div>
                  <div className="text-xs font-bold">System Admin & IT</div>
                  <div className="text-[10px] text-slate-500">Access Roles & Excel/VBA Sync</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Role Training Detailed Card */}
          <div className="lg:col-span-9 bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-2xs">
            {selectedRole === 'occ' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-[#F37C1C] uppercase tracking-wider font-mono">
                      Role Module 1 • Flight Operations Controller
                    </span>
                    <h2 className="text-lg font-black text-[#2E2C2B] mt-0.5">
                      OCC Controller Daily Operations & Real-Time Monitoring
                    </h2>
                  </div>
                  <span className="px-3 py-1 bg-[#2E2C2B] text-white text-xs font-mono font-bold rounded-md">
                    Target: OCC Duty Officers
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      1. Shift Handover & Operational Dashboard
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      At shift startup, open the <strong>OCC Dashboard</strong> to inspect active aircraft status (Dash 8 Q400 vs Boeing 737), open flight sectors, and pending crew legality conflicts.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#F37C1C]" />
                      2. Real-Time Flight Duty Monitoring
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Track departures and arrivals on <strong>Flight Monitoring</strong>. Ensure duty times do not exceed CAA maximum Flight Duty Periods (FDP) and minimum 10h rest periods are respected.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      3. Managing Irregular Operations (IROPS)
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      In case of weather delays or aircraft swaps, open the <strong>Roster Calendar</strong> to reassign eligible reserve/standby crew while verifying recency and line check validity.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      4. Utilizing the Gemini AI OCC Assistant
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Use the <strong>AI Assistant</strong> view to ask questions like <em>"Which Captain is cleared for Q400 flight ZN101?"</em> or <em>"Explain flight crew rest calculations."</em>
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-orange-50/70 rounded-xl border border-orange-200 text-xs text-[#2E2C2B] space-y-1">
                  <span className="font-extrabold uppercase font-mono text-[10px] text-[#F37C1C]">
                    Key Rule for OCC Duty Officers:
                  </span>
                  <p>
                    Never manually assign a flight if the Legality Rules Engine flags a <strong>FDP Overlap</strong>, <strong>Insufficient Rest (&lt;10h)</strong>, or <strong>Expired Pilot Recency / Line Check</strong>. The system strictly blocks illegal assignments unless an authorized managerial override is recorded with justification in the Audit Log.
                  </p>
                </div>
              </div>
            )}

            {selectedRole === 'roster' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider font-mono">
                      Role Module 2 • Crew Scheduling Specialist
                    </span>
                    <h2 className="text-lg font-black text-[#2E2C2B] mt-0.5">
                      Roster Generation, Optimization & Standby Management
                    </h2>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-900 text-xs font-mono font-bold rounded-md">
                    Target: Roster Planners
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-[#F37C1C]" />
                      Step 1: Running the Auto Scheduler Engine
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Navigate to <strong>Auto Scheduler</strong>. Click <em>"Run Auto Scheduler Engine"</em> to generate an initial legal roster matching aircraft type ratings (Q400 / B737), role compatibility (CPT, FO, SCCM, CCM), and non-overlapping schedules.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-emerald-600" />
                      Step 2: Roster Optimization & Fatigue Balance
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Click <em>"Optimize Existing Roster"</em> to balance cumulative flight hours among crew members, minimize fatigue spikes, and ensure fair distribution of night duties across the roster period.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      Step 3: Managing Exclusions (Leave & Simulator Training)
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Before publishing the monthly roster, ensure all approved leave, simulator recurrent training, and medical appointments are registered in <strong>Crew Leave & Training</strong> to automatically exclude unavailable personnel.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedRole === 'admin' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-mono">
                      Role Module 3 • Crew Admin & Document Compliance
                    </span>
                    <h2 className="text-lg font-black text-[#2E2C2B] mt-0.5">
                      Managing Line Checks, Medicals, Passports & Expiry Tracking
                    </h2>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-900 text-xs font-mono font-bold rounded-md">
                    Target: Crew Records Admin
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-[#F37C1C]" />
                      Line Check Tracking
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Use the <strong>Line Check Tracker</strong> to monitor mandatory annual line checks. Record new completion dates and evaluator signatures to extend validity by 12 months.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      Document Expiry Matrix
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Check <strong>License & Documents</strong> weekly. Filter by <em>"Expired"</em> or <em>"Expiring in 30 Days"</em> for Passports, CAA Licenses, Medical Class 1 certificates, and Airport Security Passes.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 md:col-span-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Database className="w-4 h-4 text-purple-600" />
                      Legacy Excel Workbook Synchronization
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      If staff update external spreadsheets like <em>"Recency Tracker.xlsm"</em> or <em>"Crew Hour Monitoring.xlsm"</em>, upload them via <strong>Legacy Excel System Mapping</strong> to auto-update crew database fields without manual re-entry.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedRole === 'chief' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider font-mono">
                      Role Module 4 • Chief Pilot & Flight Operations Management
                    </span>
                    <h2 className="text-lg font-black text-[#2E2C2B] mt-0.5">
                      Pilot Recency Tracking, Simulator Check Sign-Off & Standards
                    </h2>
                  </div>
                  <span className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-mono font-bold rounded-md">
                    Target: Chief Pilot / Flight Ops Line Managers
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-[#F37C1C]" />
                      90-Day Pilot Currency Oversight
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Review the <strong>Pilot Recency Tracker</strong> to confirm all Captains and First Officers have logged 3 takeoffs and 3 landings in the last 90 days. Schedule simulator currency refresher sessions for pilots nearing expiry.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-600" />
                      Annual Line Check Evaluation Sign-off
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Conduct and approve annual line checks on revenue routes. Sign off evaluations digitally with Check Pilot Staff IDs to renew 12-month type rating currency.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedRole === 'crew' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider font-mono">
                      Role Module 5 • Flight Deck & Cabin Crew Self-Service
                    </span>
                    <h2 className="text-lg font-black text-[#2E2C2B] mt-0.5">
                      Personal Portal, Duty Acknowledgment & Expiry Awareness
                    </h2>
                  </div>
                  <span className="px-3 py-1 bg-teal-100 text-teal-900 text-xs font-mono font-bold rounded-md">
                    Target: Pilots & Cabin Crew
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-teal-600" />
                      1. Viewing Published Personal Rosters
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Access the <strong>Personal Crew Portal</strong> to view upcoming flight pairings, report times at KKIA Lusaka, standby assignments, and scheduled off-days.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-emerald-600" />
                      2. Roster Acknowledgment Sign-Off
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Electronically acknowledge monthly roster publications to confirm readiness and verify duty legality under CAA ZCAR Part 8 regulations.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedRole === 'compliance' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider font-mono">
                      Role Module 6 • Flight Safety & CAA Quality Audit
                    </span>
                    <h2 className="text-lg font-black text-[#2E2C2B] mt-0.5">
                      CAA Zambia Regulatory Compliance & Immutable Audit Logs
                    </h2>
                  </div>
                  <span className="px-3 py-1 bg-purple-100 text-purple-900 text-xs font-mono font-bold rounded-md">
                    Target: Safety, Standards & CAA Quality Inspectors
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Flame className="w-4 h-4 text-red-600" />
                      Fatigue Monitoring Matrix Oversight
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Inspect the <strong>Fatigue Monitoring Matrix</strong> for any crew members exceeding 100% of rolling 7-day (30h), 14-day (60h), or 28-day (100h) block flight limits.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#2E2C2B]" />
                      Cryptographic Audit Log Verification
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Review the <strong>Audit Log</strong> for immutable records of all roster updates, override approvals, line check renewals, and system data resets with verified SHA-256 seals.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedRole === 'sysadmin' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-900 uppercase tracking-wider font-mono">
                      Role Module 7 • System Administrator & IT Lead
                    </span>
                    <h2 className="text-lg font-black text-[#2E2C2B] mt-0.5">
                      User Access Control, Excel Data Pipeline & VBA Macro Engine
                    </h2>
                  </div>
                  <span className="px-3 py-1 bg-slate-900 text-white text-xs font-mono font-bold rounded-md">
                    Target: IT & System Administrators
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#F37C1C]" />
                      1. User Access & RBAC Configuration
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Navigate to <strong>User Access & Roles</strong> to manage accounts, configure granular permissions, and test active sessions.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Download className="w-4 h-4 text-blue-600" />
                      2. CSV Excel Template Pipeline
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      In <strong>Legacy Excel System Mapping</strong>, use <em>"Download Template CSV"</em> for standardized headers across Crew, Flights, Assignments, and Exclusions.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      3. Batch Upload & Direct CSV Paste
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Upload `.csv` or `.xlsx` files directly, or paste text directly from Excel/Sheets with tabular field preview before committing.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-purple-600" />
                      4. VBA Macro Subsystem Execution
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Trigger converted VBA macros (<em>CalculateRecency()</em>, <em>CheckExpiryStatus()</em>, <em>ValidateAssignment()</em>) and monitor outputs in the live VBA Terminal.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STANDARD OPERATING PROCEDURES (SOPs) */}
      {activeTab === 'sop' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-2xs">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#F37C1C] uppercase tracking-wider font-mono">
                  Zambia Airways OCC Flight Operations Manual
                </span>
                <h2 className="text-lg font-black text-[#2E2C2B]">
                  Standard Operating Procedures (SOP 101 – 108)
                </h2>
              </div>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded text-xs font-mono font-bold">
                Doc Ref: ZA-OCC-SOP-2026-V3
              </span>
            </div>

            <div className="space-y-6">
              {/* SOP 101 */}
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-[#2E2C2B] text-white font-mono text-xs font-black rounded">
                      SOP 101
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      Shift Handover, Operational Dashboard & Flight Readiness Verification
                    </h3>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded font-mono">
                    Daily Handover
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p><strong>Purpose:</strong> To ensure all revenue flights departing Lusaka (LUN), Ndola (NLA), Livingstone (LVI), Solwezi (SLI), Mfuwe (MFU), Harare (HRE), Lilongwe (LLW), Johannesburg (JNB), and Nairobi (NBO) have fully qualified, rested, and currency-compliant crew.</p>
                  <ol className="list-decimal list-inside space-y-1 font-sans pl-2 text-slate-700">
                    <li>Log into Zambia Airways Crew Control System with authorized credentials.</li>
                    <li>Check the <strong>OCC Dashboard</strong> for unassigned sectors, pending legality conflicts, and active fleet availability.</li>
                    <li>Verify all scheduled crew have completed the mandatory 10 hours minimum rest period before sign-in.</li>
                    <li>Confirm zero unresolved legality conflicts in the <strong>Legality Conflict Rule Engine</strong> view.</li>
                    <li>Verify cloud database connection indicator shows green <em>"Live Sync Connected"</em>.</li>
                  </ol>
                </div>
              </div>

              {/* SOP 102 */}
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-blue-700 text-white font-mono text-xs font-black rounded">
                      SOP 102
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      Automated Roster Generation, Fatigue Balancing & Standby Coverage
                    </h3>
                  </div>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded font-mono">
                    Planning & Roster
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p><strong>Purpose:</strong> Standardized execution of the multi-pass Auto-Scheduler algorithm to generate legal, fatigue-balanced monthly and weekly rosters.</p>
                  <ol className="list-decimal list-inside space-y-1 font-sans pl-2 text-slate-700">
                    <li>Open <strong>Auto Scheduler</strong> and click <em>"Run Auto Scheduler Engine"</em> to match open flights with available crew.</li>
                    <li>Inspect pre-generation compliance checks to verify zero missing type ratings (Q400 vs B737).</li>
                    <li>Run <em>"Optimize Existing Roster"</em> to balance cumulative duty hours and minimize positioning.</li>
                    <li>Designate home standby reserves (1 Captain, 1 First Officer, 2 Cabin Crew per fleet type) for emergency coverage.</li>
                    <li>Publish finalized roster to the <strong>Master Roster Calendar</strong> and Personal Crew Portals.</li>
                  </ol>
                </div>
              </div>

              {/* SOP 103 */}
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-[#F37C1C] text-white font-mono text-xs font-black rounded">
                      SOP 103
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      Pilot Recency & Takeoff/Landing Currency Tracking (90-Day Rule)
                    </h3>
                  </div>
                  <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded font-mono">
                    CAA ZCAR Part 8
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p><strong>Purpose:</strong> Strict enforcement of the 90-day currency requirement (3 takeoffs and 3 landings on type) under CAA Zambia ZCAR Part 8 & ICAO Annex 6.</p>
                  <ol className="list-decimal list-inside space-y-1 font-sans pl-2 text-slate-700">
                    <li>Navigate to the <strong>Pilot Recency Tracker</strong> module.</li>
                    <li>Filter by aircraft type (Dash 8 Q400 / Boeing 737-800) and review currency status badges.</li>
                    <li>Identify any flight deck crew marked <em>"DUE SOON (&lt;14 Days)"</em> or <em>"EXPIRED"</em>.</li>
                    <li>Schedule currency flights on revenue sectors or book an approved Level D Flight Simulator check.</li>
                    <li>Log completed sectors via <em>"Log Recency Sector"</em> to update rolling takeoff and landing tallies.</li>
                    <li>Export recency compliance reports for Flight Operations management and CAA audits.</li>
                  </ol>
                </div>
              </div>

              {/* SOP 104 */}
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-purple-700 text-white font-mono text-xs font-black rounded">
                      SOP 104
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      Crew Leave Scheduling, Simulator Recurrent Training & Exclusions
                    </h3>
                  </div>
                  <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded font-mono">
                    Availability Engine
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p><strong>Purpose:</strong> Registering crew non-flying events (Annual Leave, Simulator recurrent training, Sick Leave, Medical Class 1 examinations) and activating automatic roster exclusion.</p>
                  <ol className="list-decimal list-inside space-y-1 font-sans pl-2 text-slate-700">
                    <li>Open <strong>Crew Leave & Training</strong>.</li>
                    <li>Click <em>"Schedule Leave / Training"</em> to open the booking modal.</li>
                    <li>Select crew member, event category (Annual Leave, Simulator, Recurrent Ground School, Medical), and date range.</li>
                    <li>Toggle <em>"Approved / Confirmed"</em> status to activate automatic exclusion in the scheduling engine.</li>
                    <li>Verify the crew member is listed in the <strong>Auto-Excluded Crew</strong> banner.</li>
                  </ol>
                </div>
              </div>

              {/* SOP 105 */}
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-emerald-700 text-white font-mono text-xs font-black rounded">
                      SOP 105
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      Line Check Evaluation Renewal, Evaluator Sign-off & Expiry Oversight
                    </h3>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded font-mono">
                    12-Month Check
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p><strong>Purpose:</strong> Ensuring all flight deck crew maintain valid annual line checks per CAA regulations.</p>
                  <ol className="list-decimal list-inside space-y-1 font-sans pl-2 text-slate-700">
                    <li>Open <strong>Line Check Tracker</strong> and review the 30-day lookahead calendar.</li>
                    <li>Identify pilots whose line check expires within 30 days.</li>
                    <li>Coordinate with Chief Pilot / Training Captain to schedule an evaluator on a revenue sector.</li>
                    <li>Upon check completion, select <em>"Update Line Check"</em> and record evaluator staff ID and evaluation score.</li>
                    <li>System automatically recalculates next expiry (+12 months) and logs the event in the Audit Log.</li>
                  </ol>
                </div>
              </div>

              {/* SOP 106 */}
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-amber-700 text-white font-mono text-xs font-black rounded">
                      SOP 106
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      Importing & Syncing Legacy Excel Spreadsheets with VBA Macro Execution
                    </h3>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded font-mono">
                    Data Pipeline
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p><strong>Purpose:</strong> Seamless integration of legacy workbooks ("Recency Tracker.xlsm", "Crew Hour Monitoring FD and CC.xlsm", "Fatigue Monitoring.xlsm").</p>
                  <ol className="list-decimal list-inside space-y-1 font-sans pl-2 text-slate-700">
                    <li>Navigate to <strong>Legacy Excel System Mapping</strong>.</li>
                    <li>Select dataset type (Crew, Flights, Roster, or Leave Exclusions) or download standard CSV template.</li>
                    <li>Upload the `.xlsx` / `.csv` file, or switch to <strong>"Enter Data / Paste CSV"</strong> for direct text paste.</li>
                    <li>Preview parsed columns and click <em>"Import Mapped Records into System Database"</em>.</li>
                    <li>Execute automated VBA macro routines (<code>CalculateRecency()</code>, <code>CheckExpiryStatus()</code>) and review terminal logs.</li>
                  </ol>
                </div>
              </div>

              {/* SOP 107 */}
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-slate-900 text-white font-mono text-xs font-black rounded">
                      SOP 107
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      User Role Management, RBAC Access Controls & Cryptographic Audit Logs
                    </h3>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded font-mono">
                    Security & RBAC
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p><strong>Purpose:</strong> Managing system access levels, role-based permissions (RBAC), and active user identity switches.</p>
                  <ol className="list-decimal list-inside space-y-1 font-sans pl-2 text-slate-700">
                    <li>Access the <strong>User Access & Roles</strong> module (restricted to Super Admin / IT roles).</li>
                    <li>Click <em>"+ Add System User"</em> to create staff accounts with appropriate roles and permissions.</li>
                    <li>To test role restrictions, use the <strong>Active Persona Switcher</strong> in the top header.</li>
                    <li>Ensure all passwords adhere to company complexity standards (minimum 8 characters, numbers, and symbols).</li>
                    <li>Inspect the <strong>System Audit Log</strong> to verify tamper-evident SHA-256 cryptographic seals for all actions.</li>
                  </ol>
                </div>
              </div>

              {/* SOP 108 */}
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-indigo-700 text-white font-mono text-xs font-black rounded">
                      SOP 108
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      Gemini AI OCC Flight Assistant Usage & Operational Inquiry Protocols
                    </h3>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded font-mono">
                    AI Assistant
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p><strong>Purpose:</strong> Safe and effective utilization of the Gemini-powered OCC Assistant for fast decision support during flight dispatch and irregular operations.</p>
                  <ol className="list-decimal list-inside space-y-1 font-sans pl-2 text-slate-700">
                    <li>Open <strong>AI Assistant</strong> from the left sidebar navigation.</li>
                    <li>Ask natural language operational questions (e.g. <em>"Explain the 90-day recency rule for Dash 8 Captains"</em> or <em>"Suggest rested First Officers for flight ZN303"</em>).</li>
                    <li>Review AI responses and cross-reference with the active <strong>Legality Rule Engine</strong>.</li>
                    <li>Do not input sensitive passenger personal identifying data into free-text prompts.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: QUICK REFERENCE CARDS & FTL LIMITS */}
      {activeTab === 'qrc' && (
        <div className="space-y-6">
          {/* FTL Limitations Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#F37C1C]" />
                <h2 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-wider">
                  CAA Zambia Flight Time Limitations (FTL) Summary Card
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-mono">Source: CAA Zambia Flight Operations Regulations & ICAO Annex 6</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-mono font-bold uppercase border-y border-slate-200">
                  <tr>
                    <th className="p-3">Limitation Metric</th>
                    <th className="p-3">Standard FTL Limit</th>
                    <th className="p-3">Action Required on Breach</th>
                    <th className="p-3">System Enforcement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Minimum Rest Period</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">10 Hours or Preceding Duty Length (whichever is greater)</td>
                    <td className="p-3 text-slate-600">Delay flight or replace crew member</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px] font-mono">Strict Block</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Maximum Daily Flight Duty Period (FDP)</td>
                    <td className="p-3 font-mono font-bold text-slate-800">12 Hours (standard 2-pilot crew)</td>
                    <td className="p-3 text-slate-600">Split duty or assign relief crew</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px] font-mono">Strict Block</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Pilot Recency Currency</td>
                    <td className="p-3 font-mono font-bold text-slate-800">3 Takeoffs & 3 Landings in 90 Days</td>
                    <td className="p-3 text-slate-600">Simulator check or supervised sector</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px] font-mono">Ground Pilot</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Max Rolling 7-Day Flight Hours</td>
                    <td className="p-3 font-mono font-bold text-slate-800">30 Block Hours</td>
                    <td className="p-3 text-slate-600">Assign non-flying administrative duty</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px] font-mono">Warning Flag</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Max Rolling 14-Day Duty Hours</td>
                    <td className="p-3 font-mono font-bold text-slate-800">60 Duty Hours</td>
                    <td className="p-3 text-slate-600">Mandatory 36h continuous rest</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px] font-mono">Warning Flag</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Max Rolling 28-Day Flight Hours</td>
                    <td className="p-3 font-mono font-bold text-slate-800">100 Block Hours</td>
                    <td className="p-3 text-slate-600">Mandatory roster blackout period</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px] font-mono">Strict Block</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Max Calendar Year Flight Hours</td>
                    <td className="p-3 font-mono font-bold text-slate-800">1,000 Block Hours</td>
                    <td className="p-3 text-slate-600">Annual duty restriction</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px] font-mono">Strict Block</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Line Check Validity</td>
                    <td className="p-3 font-mono font-bold text-slate-800">12 Calendar Months</td>
                    <td className="p-3 text-slate-600">Conduct check with certified evaluator</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px] font-mono">Ground Pilot</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Medical Certificate Validity</td>
                    <td className="p-3 font-mono font-bold text-slate-800">Class 1 (12m / 6m over age 40)</td>
                    <td className="p-3 text-slate-600">Mandatory medical renewal examination</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px] font-mono">Ground Pilot</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Contacts & Fleet Base info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider flex items-center gap-2">
                <Info className="w-4 h-4 text-[#F37C1C]" />
                Zambia Airways OCC Fleet Specifications
              </h3>
              <ul className="text-xs text-slate-600 space-y-2 font-sans">
                <li>• <strong>De Havilland Dash 8 Q400:</strong> Turboprop Regional. Standard Crew Complement: 2 Flight Deck (1 Captain + 1 First Officer), 2 Cabin Crew (1 Senior Cabin Crew Member + 1 Cabin Crew Member). Domestic & Regional network: LUN, NLA, LVI, MFU, SLI, HRE, LLW.</li>
                <li>• <strong>Boeing 737-800:</strong> Jet Medium Haul. Standard Crew Complement: 2 Flight Deck (1 Captain + 1 First Officer), 4 Cabin Crew (1 Senior Cabin Crew Member + 3 Cabin Crew Members). Regional & Trunk routes: LUN, NLA, JNB, NBO.</li>
              </ul>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2E2C2B]" />
                OCC Control Center Directory & Base Operations
              </h3>
              <ul className="text-xs text-slate-600 space-y-1.5 font-sans">
                <li>• <strong>OCC Duty Manager:</strong> +260 211 254 321 | occ@zambiaairways.co.zm</li>
                <li>• <strong>Crew Scheduling Desk:</strong> +260 211 254 322 | scheduling@zambiaairways.co.zm</li>
                <li>• <strong>Chief Pilot / Flight Standards:</strong> +260 211 254 325 | standards@zambiaairways.co.zm</li>
                <li>• <strong>Main Operations Base:</strong> Kenneth Kaunda International Airport (KKIA / LUN), Lusaka, Zambia</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: KNOWLEDGE VERIFICATION QUIZ */}
      {activeTab === 'quiz' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-bold text-[#F37C1C] uppercase tracking-wider font-mono">
                Interactive Operational Competency Check
              </span>
              <h2 className="text-lg font-black text-[#2E2C2B]">
                Staff Training Evaluation & Certification Quiz
              </h2>
            </div>

            {showQuizResults ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-500 uppercase font-mono">Your Score</span>
                  <div className="text-xl font-black text-emerald-600">
                    {calculateScore()} / {QUIZ_QUESTIONS.length} ({Math.round((calculateScore() / QUIZ_QUESTIONS.length) * 100)}%)
                  </div>
                </div>
                <button
                  onClick={handleResetQuiz}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retake Quiz
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowQuizResults(true)}
                disabled={Object.keys(quizAnswers).length < QUIZ_QUESTIONS.length}
                className="px-4 py-2 bg-[#F37C1C] hover:bg-[#D96B12] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" /> Submit Answers
              </button>
            )}
          </div>

          <div className="space-y-6">
            {QUIZ_QUESTIONS.map((q, idx) => {
              const selectedOpt = quizAnswers[q.id];
              const isSubmitted = showQuizResults;
              const isCorrect = selectedOpt === q.correctIndex;

              return (
                <div
                  key={q.id}
                  className={`p-5 rounded-xl border transition-all ${
                    isSubmitted
                      ? isCorrect
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-red-300 bg-red-50/40'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="w-6 h-6 rounded-full bg-[#2E2C2B] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 leading-snug mt-0.5">
                      {q.question}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9">
                    {q.options.map((opt, optIdx) => {
                      const isChosen = selectedOpt === optIdx;
                      let btnStyle = 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100';

                      if (isSubmitted) {
                        if (optIdx === q.correctIndex) {
                          btnStyle = 'border-emerald-500 bg-emerald-100 font-bold text-emerald-900';
                        } else if (isChosen && optIdx !== q.correctIndex) {
                          btnStyle = 'border-red-500 bg-red-100 font-bold text-red-900';
                        }
                      } else if (isChosen) {
                        btnStyle = 'border-[#F37C1C] bg-orange-50 font-bold text-[#2E2C2B]';
                      }

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectAnswer(q.id, optIdx)}
                          className={`text-left p-3 rounded-lg border text-xs transition-all cursor-pointer ${btnStyle}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {isSubmitted && (
                    <div className="mt-3 pl-9 text-xs font-medium text-slate-700 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold font-mono text-[11px]">
                        {isCorrect ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Correct Answer!
                          </span>
                        ) : (
                          <span className="text-red-700 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Incorrect Answer
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 text-[11px] bg-white p-2.5 rounded border border-slate-200 italic">
                        {q.explanation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
