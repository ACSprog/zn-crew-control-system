import React, { useState, useRef } from 'react';
import { CrewMember, AircraftType, CrewRole, CrewStatus, SystemUser } from '../types';
import { normalizeRole, sanitizeCrewMember } from '../utils/securityEngine';
import { parseCrewData, normalizeCrewRole } from '../utils/crewParser';
import Papa from 'papaparse';
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  Lock,
  SlidersHorizontal,
  Download,
  Upload,
  CheckCircle2,
  Clock,
  Award,
  FileCheck,
  Mail,
  Phone,
  MessageSquare,
} from 'lucide-react';

interface CrewDatabaseViewProps {
  crew: CrewMember[];
  onAddCrew: (member: Omit<CrewMember, 'id'>) => void;
  onUpdateCrew: (member: CrewMember) => void;
  onDeleteCrew: (id: string) => void;
  onClearAllCrew?: () => void;
  onImportCrew?: (crewList: CrewMember[]) => void;
  currentUser?: SystemUser;
}

export const CrewDatabaseView: React.FC<CrewDatabaseViewProps> = ({
  crew,
  onAddCrew,
  onUpdateCrew,
  onDeleteCrew,
  onClearAllCrew,
  onImportCrew,
  currentUser,
}) => {
  const userRole = normalizeRole(currentUser?.role || 'SUPER_ADMIN');
  const isAuditor = userRole === 'AUDITOR';
  const isFlightCrew = userRole === 'FLIGHT_CREW';
  const canEditDatabase = !isAuditor && !isFlightCrew;

  const [searchTerm, setSearchTerm] = useState('');
  const [aircraftFilter, setAircraftFilter] = useState<AircraftType | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<CrewRole | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<CrewStatus | 'ALL'>('ALL');
  const [importNotification, setImportNotification] = useState<{ msg: string; type: 'success' | 'info' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<CrewMember | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    staffNumber: '',
    name: '',
    role: 'Cabin Crew' as CrewRole,
    aircraft: 'Q400' as AircraftType,
    qualifications: ['Q400'] as string[],
    base: 'LUN',
    status: 'ACTIVE' as CrewStatus,
    seniority: 1,
    companyEmail: '',
    personalEmail: '',
    phone: '',
    whatsAppNumber: '',
    preferredChannel: 'WHATSAPP' as 'WHATSAPP' | 'EMAIL' | 'IN_APP' | 'ALL',
    whatsAppOptIn: true,
    licenseExpiry: '2027-06-30',
    medicalExpiry: '2027-06-30',
    simExpiry: '2027-06-30',
    septExpiry: '2027-06-30',
    crmExpiry: '2027-06-30',
    dgrExpiry: '2027-06-30',
    passportExpiry: '2028-12-31',
    airportPassExpiry: '2027-12-31',
    typeRating: 'Q400',
    trainingStatus: 'VALID' as 'VALID' | 'DUE_SOON' | 'EXPIRED',
    lineCheck: '2026-06-30',
    weeklyBlockHours: 0,
    monthlyBlockHours: 0,
    annualBlockHours: 0,
    monthlyDutyHours: 0,
    daysOff: 10,
    notes: '',
  });

  const [customQualInput, setCustomQualInput] = useState('');

  const QUALIFICATION_PRESETS = [
    { code: 'Q400', label: 'Q400 Fleet' },
    { code: 'B737', label: 'B737 Fleet' },
    { code: 'SCC', label: 'Senior Cabin Crew (SCC)' },
    { code: 'TRI', label: 'TRI (Type Rating Instructor)' },
    { code: 'TRE', label: 'TRE (Type Rating Examiner)' },
    { code: 'LTC', label: 'LTC (Line Training Captain)' },
    { code: 'DGR', label: 'DGR (Dangerous Goods)' },
    { code: 'SEPT', label: 'SEPT (Safety & Emergency)' },
    { code: 'CRM', label: 'CRM (Crew Resource Mgt)' },
  ];

  const handleOpenAddModal = (defaultRole: CrewRole = 'Captain') => {
    setEditingCrew(null);
    const rndId = Math.floor(1000 + Math.random() * 9000);
    const isCabin = defaultRole === 'Cabin Crew' || defaultRole === 'Senior Cabin Crew';
    
    let defaultTypeRating = 'Dash 8-Q400 Type Rated Captain';
    if (defaultRole === 'First Officer') defaultTypeRating = 'Dash 8-Q400 Type Rated First Officer';
    else if (defaultRole === 'Senior Cabin Crew') defaultTypeRating = 'Senior Cabin Crew Certified (Q400 Fleet)';
    else if (defaultRole === 'Cabin Crew') defaultTypeRating = 'Cabin Crew Certified (Q400 Fleet)';

    setFormData({
      staffNumber: `ZA-${rndId}`,
      name: '',
      role: defaultRole,
      aircraft: 'Q400',
      qualifications: defaultRole === 'Senior Cabin Crew' 
        ? ['Q400', 'SCC', 'SEPT', 'CRM', 'DGR'] 
        : ['Q400', 'SEPT', 'CRM', 'DGR'],
      base: 'LUN',
      status: 'ACTIVE',
      seniority: crew.length + 1,
      companyEmail: '',
      personalEmail: '',
      phone: '+260',
      whatsAppNumber: '+260',
      preferredChannel: 'WHATSAPP',
      whatsAppOptIn: true,
      licenseExpiry: '2027-06-30',
      medicalExpiry: '2027-06-30',
      simExpiry: '2027-06-30',
      septExpiry: '2027-06-30',
      crmExpiry: '2027-06-30',
      dgrExpiry: '2027-06-30',
      passportExpiry: '2028-12-31',
      airportPassExpiry: '2027-12-31',
      typeRating: defaultTypeRating,
      trainingStatus: 'VALID',
      lineCheck: '2027-06-30',
      weeklyBlockHours: 0,
      monthlyBlockHours: 0,
      annualBlockHours: 0,
      monthlyDutyHours: 0,
      daysOff: 10,
      notes: '',
    });
    setCustomQualInput('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (member: CrewMember) => {
    setEditingCrew(member);
    const existingQuals =
      member.qualifications && member.qualifications.length > 0
        ? member.qualifications
        : [member.aircraft];

    setFormData({
      staffNumber: member.staffNumber,
      name: member.name,
      role: member.role,
      aircraft: member.aircraft,
      qualifications: existingQuals,
      base: member.base,
      status: member.status,
      seniority: member.seniority,
      companyEmail: member.companyEmail || member.email || '',
      personalEmail: member.personalEmail || '',
      phone: member.mobileNumber || member.phone || '',
      whatsAppNumber: member.whatsAppNumber || member.phone || '',
      preferredChannel: member.preferredChannel || 'WHATSAPP',
      whatsAppOptIn: member.whatsAppOptIn !== false,
      licenseExpiry: member.licenseExpiry,
      medicalExpiry: member.medicalExpiry,
      simExpiry: member.simExpiry || '2027-06-30',
      septExpiry: member.septExpiry || '2027-06-30',
      crmExpiry: member.crmExpiry || '2027-06-30',
      dgrExpiry: member.dgrExpiry || '2027-06-30',
      passportExpiry: member.passportExpiry || '2028-12-31',
      airportPassExpiry: member.airportPassExpiry || '2027-12-31',
      typeRating: member.typeRating,
      trainingStatus: member.trainingStatus,
      lineCheck: member.lineCheck,
      weeklyBlockHours: member.weeklyBlockHours || 0,
      monthlyBlockHours: member.monthlyBlockHours,
      annualBlockHours: member.annualBlockHours || 0,
      monthlyDutyHours: member.monthlyDutyHours,
      daysOff: member.daysOff,
      notes: member.notes,
    });
    setCustomQualInput('');
    setIsModalOpen(true);
  };

  const handleToggleQual = (code: string) => {
    setFormData((prev) => {
      const exists = prev.qualifications.includes(code);
      let updated: string[];
      if (exists) {
        if (prev.qualifications.length === 1) return prev; // Keep at least one
        updated = prev.qualifications.filter((q) => q !== code);
      } else {
        updated = [...prev.qualifications, code];
      }

      // Sync primary aircraft type if only one fleet code is selected
      let primaryAc = prev.aircraft;
      if (updated.includes('Q400') && !updated.includes('B737')) primaryAc = 'Q400';
      else if (updated.includes('B737') && !updated.includes('Q400')) primaryAc = 'B737';

      return {
        ...prev,
        qualifications: updated,
        aircraft: primaryAc,
      };
    });
  };

  const handleAddCustomQual = () => {
    if (!customQualInput.trim()) return;
    const tag = customQualInput.trim().toUpperCase();
    if (!formData.qualifications.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        qualifications: [...prev.qualifications, tag],
      }));
    }
    setCustomQualInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const payload: Partial<CrewMember> = {
      ...formData,
      companyEmail: formData.companyEmail.trim(),
      email: formData.companyEmail.trim() || formData.personalEmail.trim() || undefined,
      personalEmail: formData.personalEmail.trim() || undefined,
      mobileNumber: formData.phone.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      whatsAppNumber: formData.whatsAppNumber.trim() || undefined,
      preferredChannel: formData.preferredChannel,
      whatsAppOptIn: formData.whatsAppOptIn,
      aircraft: formData.aircraft,
      qualifications: formData.qualifications.length > 0 ? formData.qualifications : [formData.aircraft],
    };

    if (editingCrew) {
      onUpdateCrew({
        ...editingCrew,
        ...payload,
      } as CrewMember);
    } else {
      const newMember: CrewMember = {
        id: `crew-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...(payload as any),
      };
      onAddCrew(newMember);
    }

    setIsModalOpen(false);
  };

  // Download Crew CSV Template with Contact Details & 4 Validities (Sim, SEPT, CRM, DGR)
  const handleDownloadTemplate = () => {
    const headers = [
      'Staff Number',
      'Name',
      'Role',
      'Fleet Aircraft',
      'Qualifications',
      'Base',
      'Status',
      'Company Email',
      'Personal Email',
      'Mobile Number',
      'WhatsApp Number',
      'Preferred Channel',
      'WhatsApp Opt In',
      'Simulator IR Expiry',
      'SEPT Expiry',
      'CRM Expiry',
      'DGR Expiry',
      'Medical Expiry',
      'License Expiry',
      'Passport Expiry',
      'Airport Pass Expiry',
      'Weekly Block Hours',
      'Monthly Block Hours',
      'Annual Block Hours',
    ];

    const sampleRows = [
      [
        'ZA-1001',
        'Capt. Mutale Mwila',
        'Captain',
        'Q400',
        'Q400, TRI, CRM, SEPT, DGR',
        'LUN',
        'ACTIVE',
        'mutale.mwila@zambiaairways.co.zm',
        'mutale.mwila@gmail.com',
        '+260977123456',
        '+260977123456',
        'WHATSAPP',
        'TRUE',
        '2027-08-31',
        '2027-09-15',
        '2027-10-30',
        '2027-11-20',
        '2027-06-30',
        '2027-12-31',
        '2028-12-31',
        '2027-12-31',
        '18.5',
        '65.0',
        '420.0',
      ],
      [
        'ZA-3002',
        'Thandiwe Phiri',
        'Senior Cabin Crew',
        'Q400',
        'Q400, B737, SCC, CRM, SEPT, DGR',
        'LUN',
        'ACTIVE',
        'thandiwe.phiri@zambiaairways.co.zm',
        'thandiwe.phiri@yahoo.com',
        '+260966234567',
        '+260966234567',
        'WHATSAPP',
        'TRUE',
        '2027-08-31',
        '2027-09-15',
        '2027-10-30',
        '2027-11-20',
        '2027-06-30',
        '2027-12-31',
        '2028-12-31',
        '2027-12-31',
        '15.0',
        '58.0',
        '380.0',
      ],
      [
        'ZA-3005',
        'Natasha Mulenga',
        'Cabin Crew',
        'B737',
        'B737, CRM, SEPT, DGR',
        'LUN',
        'ACTIVE',
        'natasha.mulenga@zambiaairways.co.zm',
        'natasha.m@gmail.com',
        '+260955345678',
        '+260955345678',
        'WHATSAPP',
        'TRUE',
        '2027-08-31',
        '2027-09-15',
        '2027-10-30',
        '2027-11-20',
        '2027-06-30',
        '2027-12-31',
        '2028-12-31',
        '2027-12-31',
        '12.0',
        '45.0',
        '290.0',
      ],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Zambia_Airways_Crew_Template_With_Contacts.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import with Duplicate Skipping & Robust Role/Qual Mapping
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        if (!rows || rows.length === 0) return;

        const parsedResult = parseCrewData(rows, crew);
        
        if (onImportCrew && parsedResult.crewList.length > 0) {
          onImportCrew(parsedResult.crewList);
        } else {
          parsedResult.crewList.forEach((c) => {
            onAddCrew(c);
          });
        }

        setImportNotification({
          msg: `Import complete: ${parsedResult.importedCount} crew members imported. ${parsedResult.duplicateCount} duplicate records skipped automatically.`,
          type: 'success',
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (err) => {
        setImportNotification({
          msg: `CSV Parse error: ${err.message}`,
          type: 'error',
        });
      },
    });
  };

  // Filter Crew Members
  const filteredCrew = crew.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.staffNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.base.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.qualifications && member.qualifications.some((q) => q.toLowerCase().includes(searchTerm.toLowerCase())));

    const matchesAircraft =
      aircraftFilter === 'ALL' ||
      member.aircraft === aircraftFilter ||
      (member.qualifications && member.qualifications.includes(aircraftFilter));

    const matchesRole = roleFilter === 'ALL' || member.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || member.status === statusFilter;

    return matchesSearch && matchesAircraft && matchesRole && matchesStatus;
  });

  const getRoleBadge = (role: CrewRole) => {
    switch (role) {
      case 'Captain':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'First Officer':
        return 'bg-sky-100 text-sky-900 border-sky-300';
      case 'Senior Cabin Crew':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'Cabin Crew':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv"
        className="hidden"
      />

      {/* Header Banner */}
      <div className="bg-[#2E2C2B] text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-5 h-5 text-[#F37C1C]" />
            <span className="text-xs font-bold text-[#F37C1C] uppercase tracking-widest font-mono">
              Zambia Airways Operations
            </span>
          </div>
          <h2 className="text-2xl font-black font-mono tracking-tight">Crew Registry &amp; Currency Management</h2>
          <p className="text-xs text-slate-300 mt-1">
            Independent crew category &amp; fleet qualification setup, complete 4-point currency tracking (Sim/IR, SEPT, CRM, DGR), and automatic duplicate skipping.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold font-mono transition-all border border-white/20 cursor-pointer"
            title="Download CSV Template with Sim, SEPT, CRM, and DGR currency columns"
          >
            <Download className="w-4 h-4 text-[#F37C1C]" />
            <span>Crew Template (.csv)</span>
          </button>

          {canEditDatabase ? (
            <>
              {crew.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to remove ALL crew members? This will clear the crew registry so you can insert your own data.')) {
                      if (onClearAllCrew) {
                        onClearAllCrew();
                      } else {
                        crew.forEach(c => onDeleteCrew(c.id));
                      }
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-bold font-mono transition-all border border-rose-500/40 cursor-pointer"
                  title="Purge all crew records to insert custom data"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Crew</span>
                </button>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold font-mono transition-all border border-white/20 cursor-pointer"
                title="Import CSV and auto-skip duplicate records"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Import Crew CSV</span>
              </button>

              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/20">
                <button
                  onClick={() => handleOpenAddModal('Captain')}
                  className="px-2.5 py-1.5 bg-[#F37C1C] hover:bg-[#d96711] text-white rounded-lg text-[11px] font-bold font-mono transition-all shadow-xs cursor-pointer flex items-center gap-1"
                  title="Add a new Captain"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Captain</span>
                </button>
                <button
                  onClick={() => handleOpenAddModal('First Officer')}
                  className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-bold font-mono transition-all shadow-xs cursor-pointer flex items-center gap-1"
                  title="Add a new First Officer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ First Officer</span>
                </button>
                <button
                  onClick={() => handleOpenAddModal('Cabin Crew')}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold font-mono transition-all shadow-xs cursor-pointer flex items-center gap-1"
                  title="Add a new Cabin Crew Member"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Cabin Crew</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 rounded-xl text-xs font-bold font-mono text-amber-300 border border-amber-500/30">
              <Lock className="w-3.5 h-3.5" />
              <span>Read-Only Compliance View</span>
            </div>
          )}
        </div>
      </div>

      {/* Notification Banner */}
      {importNotification && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{importNotification.msg}</span>
          </div>
          <button
            onClick={() => setImportNotification(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters and Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, staff ID, qualifications, or base..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F37C1C]"
          />
        </div>

        {/* Role, Aircraft, and Status Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="Captain">Captain</option>
            <option value="First Officer">First Officer</option>
            <option value="Senior Cabin Crew">Senior Cabin Crew</option>
            <option value="Cabin Crew">Cabin Crew</option>
          </select>

          <select
            value={aircraftFilter}
            onChange={(e) => setAircraftFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Aircraft Fleet</option>
            <option value="Q400">Q400 Fleet</option>
            <option value="B737">B737 Fleet</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="STANDBY">STANDBY</option>
            <option value="LEAVE">LEAVE</option>
            <option value="TRAINING">TRAINING</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
      </div>

      {/* Crew Table (Desktop md+) & Card Grid (Mobile <md) */}
      {/* 1. Mobile Card Grid (< 768px) */}
      <div className="block md:hidden space-y-3.5">
        {filteredCrew.map((rawMember) => {
          const member = sanitizeCrewMember(rawMember, userRole);
          const quals = member.qualifications || [member.aircraft];

          return (
            <div
              key={member.id}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-md space-y-3.5"
            >
              {/* Card Header: Avatar/Info & Category Badge */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 font-mono">
                      {member.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                      {member.staffNumber}
                    </span>
                    <span>• Base {member.base}</span>
                    <span>• #{member.seniority}</span>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border font-mono shrink-0 ${getRoleBadge(
                    member.role
                  )}`}
                >
                  {member.role}
                </span>
              </div>

              {/* Qualifications & Status */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-bold text-slate-400 font-mono mr-1">Fleet:</span>
                  {quals.map((q) => (
                    <span
                      key={q}
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                        q === 'Q400'
                          ? 'bg-sky-100 text-sky-800'
                          : q === 'B737'
                          ? 'bg-indigo-100 text-indigo-800'
                          : q === 'SCC'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {q}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      member.status === 'ACTIVE'
                        ? 'bg-emerald-500'
                        : member.status === 'STANDBY'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span className="font-bold text-slate-800 text-[11px] font-mono">
                    {member.status}
                  </span>
                </div>
              </div>

              {/* Key Currencies Grid */}
              <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  Currencies &amp; Validity
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="flex justify-between bg-white px-2 py-1 rounded border border-slate-100">
                    <span className="text-slate-500">Sim/IR:</span>
                    <span className="font-bold text-slate-900">{member.simExpiry || '2027-08-31'}</span>
                  </div>
                  <div className="flex justify-between bg-white px-2 py-1 rounded border border-slate-100">
                    <span className="text-slate-500">SEPT:</span>
                    <span className="font-bold text-slate-900">{member.septExpiry || '2027-09-15'}</span>
                  </div>
                  <div className="flex justify-between bg-white px-2 py-1 rounded border border-slate-100">
                    <span className="text-slate-500">CRM:</span>
                    <span className="font-bold text-slate-900">{member.crmExpiry || '2027-10-30'}</span>
                  </div>
                  <div className="flex justify-between bg-white px-2 py-1 rounded border border-slate-100">
                    <span className="text-slate-500">DGR:</span>
                    <span className="font-bold text-slate-900">{member.dgrExpiry || '2027-11-20'}</span>
                  </div>
                  <div className="flex justify-between bg-white px-2 py-1 rounded border border-slate-100">
                    <span className="text-slate-500">Medical:</span>
                    <span className="font-bold text-slate-900">{member.medicalExpiry}</span>
                  </div>
                  <div className="flex justify-between bg-white px-2 py-1 rounded border border-slate-100">
                    <span className="text-slate-500">License:</span>
                    <span className="font-bold text-slate-900">{member.licenseExpiry}</span>
                  </div>
                </div>
              </div>

              {/* FTL Block Hours Progress */}
              <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Weekly Block:</span>
                  <span className="font-bold text-slate-900">{member.weeklyBlockHours ?? 0}h / 30h</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Monthly Block:</span>
                  <span className="font-bold text-slate-900">{member.monthlyBlockHours ?? 0}h / 100h</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Annual Block:</span>
                  <span className="font-bold text-slate-900">{member.annualBlockHours ?? 0}h / 1000h</span>
                </div>
              </div>

              {/* Actions Footer */}
              {canEditDatabase ? (
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenEditModal(rawMember)}
                    className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold font-mono transition-colors active:scale-98"
                  >
                    <Edit2 className="w-4 h-4 text-slate-600" />
                    <span>Edit Record</span>
                  </button>
                  <button
                    onClick={() => onDeleteCrew(rawMember.id)}
                    className="min-h-[44px] px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold font-mono transition-colors flex items-center justify-center active:scale-98"
                    title="Delete Crew Member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-[10px] font-mono text-slate-400 font-bold text-center py-1 bg-slate-50 rounded-lg">
                  Read-Only Compliance Mode
                </div>
              )}
            </div>
          );
        })}

        {filteredCrew.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <UserCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800 font-mono">Crew Database Is Empty</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchTerm || aircraftFilter !== 'ALL' || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                  ? 'No crew records matched the selected filter criteria.'
                  : 'No crew records exist in the database. Add your flight deck and cabin crew members manually or import them via CSV.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Desktop Multi-Column Table (>= 768px md+) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-mono font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Staff &amp; Name</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Fleet &amp; Qualifications</th>
                <th className="px-4 py-3.5">Status &amp; Base</th>
                <th className="px-4 py-3.5">Key Currencies (Sim / SEPT / CRM / DGR)</th>
                <th className="px-4 py-3.5">Medical &amp; License</th>
                <th className="px-4 py-3.5">FTL Block (Wk / Mo / Yr)</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCrew.map((rawMember) => {
                const member = sanitizeCrewMember(rawMember, userRole);
                const quals = member.qualifications || [member.aircraft];

                return (
                  <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 font-mono">{member.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                        <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px] text-slate-700 font-bold">
                          {member.staffNumber}
                        </span>
                        <span>• Seniority #{member.seniority}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border font-mono ${getRoleBadge(member.role)}`}>
                        {member.role}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {quals.map((q) => (
                          <span
                            key={q}
                            className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                              q === 'Q400'
                                ? 'bg-sky-100 text-sky-800'
                                : q === 'B737'
                                ? 'bg-indigo-100 text-indigo-800'
                                : q === 'SCC'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {q}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            member.status === 'ACTIVE'
                              ? 'bg-emerald-500'
                              : member.status === 'STANDBY'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        <span className="font-bold text-slate-800 text-[11px]">{member.status}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        Base: <span className="font-bold text-slate-700">{member.base}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Sim/IR:</span>
                        <span className="font-semibold text-slate-900 bg-slate-100 px-1 rounded">{member.simExpiry || '2027-08-31'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">SEPT:</span>
                        <span className="font-semibold text-slate-900 bg-slate-100 px-1 rounded">{member.septExpiry || '2027-09-15'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">CRM:</span>
                        <span className="font-semibold text-slate-900 bg-slate-100 px-1 rounded">{member.crmExpiry || '2027-10-30'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">DGR:</span>
                        <span className="font-semibold text-slate-900 bg-slate-100 px-1 rounded">{member.dgrExpiry || '2027-11-20'}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">Medical:</span>
                        <span className="font-semibold text-slate-900">{member.medicalExpiry}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">License:</span>
                        <span className="font-semibold text-slate-900">{member.licenseExpiry}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-[11px]">
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Wk:</span>
                          <span className="font-bold text-slate-800">{member.weeklyBlockHours ?? 0}h / 30h</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Mo:</span>
                          <span className="font-bold text-slate-800">{member.monthlyBlockHours ?? 0}h / 100h</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Yr:</span>
                          <span className="font-bold text-slate-800">{member.annualBlockHours ?? 0}h / 1000h</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right space-x-1">
                      {canEditDatabase ? (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(rawMember)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Crew Member"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteCrew(rawMember.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Crew Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-400 font-bold px-2 py-1 bg-slate-100 rounded">
                          Read-Only
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredCrew.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <UserCheck className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800 font-mono">Crew Database Is Empty</p>
                        <p className="text-xs text-slate-500 max-w-md">
                          {searchTerm || aircraftFilter !== 'ALL' || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                            ? 'No crew records matched the selected filter criteria.'
                            : 'No crew records exist in the database. Add your flight deck and cabin crew members manually or import them via CSV.'}
                        </p>
                      </div>
                      {canEditDatabase && !searchTerm && aircraftFilter === 'ALL' && roleFilter === 'ALL' && statusFilter === 'ALL' && (
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => handleOpenAddModal('Cabin Crew')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F37C1C] hover:bg-[#d96711] text-white rounded-xl text-xs font-bold font-mono transition-all shadow-xs cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Crew Member</span>
                          </button>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold font-mono transition-all border border-slate-300 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Import CSV</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-mono">
                  {editingCrew ? 'Edit Crew Profile' : 'Add New Crew Member'}
                </h3>
                <p className="text-xs text-slate-500">
                  Independent selection of Crew Category &amp; Aircraft Fleet qualifications.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 mb-1">Staff Number / Employee ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.staffNumber}
                    onChange={(e) => setFormData({ ...formData, staffNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                {/* Independent Crew Category Selection */}
                <div className="col-span-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="block text-slate-900 font-bold uppercase font-mono text-[11px]">
                    1. Crew Category / Role (Independent Selection) *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['Captain', 'First Officer', 'Senior Cabin Crew', 'Cabin Crew'] as CrewRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => {
                            let newQuals = [...prev.qualifications];
                            if (r === 'Senior Cabin Crew') {
                              if (!newQuals.includes('SCC')) newQuals.push('SCC');
                            } else {
                              newQuals = newQuals.filter((q) => q !== 'SCC');
                            }
                            
                            let newRating = prev.typeRating;
                            const acName = prev.aircraft === 'B737' ? 'Boeing 737-800' : 'Dash 8-Q400';
                            if (r === 'Captain') newRating = `${acName} Type Rated Captain`;
                            else if (r === 'First Officer') newRating = `${acName} Type Rated First Officer`;
                            else if (r === 'Senior Cabin Crew') newRating = `Senior Cabin Crew Certified (${prev.aircraft} Fleet)`;
                            else if (r === 'Cabin Crew') newRating = `Cabin Crew Certified (${prev.aircraft} Fleet)`;

                            return {
                              ...prev,
                              role: r,
                              qualifications: newQuals,
                              typeRating: newRating,
                            };
                          });
                        }}
                        className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                          formData.role === r
                            ? 'bg-[#2E2C2B] text-white border-[#2E2C2B] shadow-sm'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Independent Aircraft & Operational Qualifications */}
                <div className="col-span-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-900 uppercase font-mono">
                      2. Aircraft Fleet &amp; Operational Qualifications (Multi-Select) *
                    </label>
                    <span className="text-[10px] text-[#F37C1C] font-mono font-bold">
                      {formData.qualifications.length} Selected
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Select the aircraft types (Q400, B737) and operational certifications (SCC, TRI, TRE, SEPT, CRM, DGR) this crew member is rated to operate:
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {QUALIFICATION_PRESETS.map((preset) => {
                      const isSelected = formData.qualifications.includes(preset.code);
                      return (
                        <button
                          key={preset.code}
                          type="button"
                          onClick={() => handleToggleQual(preset.code)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                            isSelected
                              ? 'bg-[#F37C1C] text-white border-[#F37C1C] shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-300'}`} />
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    <input
                      type="text"
                      placeholder="Add custom qualification code (e.g. LTC, CRM)..."
                      value={customQualInput}
                      onChange={(e) => setCustomQualInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomQual();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:border-[#F37C1C]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomQual}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                    >
                      + Add Tag
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Primary Base Airport</label>
                  <input
                    type="text"
                    value={formData.base}
                    onChange={(e) => setFormData({ ...formData, base: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="STANDBY">STANDBY</option>
                    <option value="LEAVE">LEAVE</option>
                    <option value="TRAINING">TRAINING</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                {/* Contact Information & Notification Channels */}
                <div className="col-span-2 pt-2 border-t border-slate-200">
                  <div className="text-xs font-bold text-slate-900 uppercase font-mono mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-[#F37C1C]" />
                      <span>Contact Details &amp; Notification Channels</span>
                    </div>
                    <span className="text-[11px] font-normal text-slate-500 lowercase">
                      (Used for automated WhatsApp &amp; Email roster alerts)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200 mb-2">
                    <div>
                      <label className="block text-slate-700 text-xs font-semibold mb-1 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-[#F37C1C]" />
                        <span>Company Email</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. name@zambiaairways.co.zm"
                        value={formData.companyEmail}
                        onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 text-xs font-semibold mb-1 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>Personal Email</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. personal@gmail.com"
                        value={formData.personalEmail}
                        onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 text-xs font-semibold mb-1 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>Mobile Number</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="+260 97X XXX XXX"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 text-xs font-semibold mb-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-emerald-600" />
                        <span>WhatsApp Number</span>
                      </label>
                      <input
                        type="tel"
                        placeholder="+260 97X XXX XXX (E.164)"
                        value={formData.whatsAppNumber}
                        onChange={(e) => setFormData({ ...formData, whatsAppNumber: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-slate-900 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 text-xs font-semibold mb-1">Preferred Channel</label>
                      <select
                        value={formData.preferredChannel}
                        onChange={(e) => setFormData({ ...formData, preferredChannel: e.target.value as any })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs"
                      >
                        <option value="WHATSAPP">WhatsApp Primary</option>
                        <option value="EMAIL">Email Primary</option>
                        <option value="IN_APP">In-App Only</option>
                        <option value="ALL">All Channels (WhatsApp + Email + In-App)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-5">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formData.whatsAppOptIn}
                          onChange={(e) => setFormData({ ...formData, whatsAppOptIn: e.target.checked })}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                        />
                        <span className="text-xs font-bold text-slate-800">WhatsApp Notification Opt-In Active</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 4 Mandatory Currency Validity Dates */}
                <div className="col-span-2 pt-2 border-t border-slate-200">
                  <div className="text-xs font-bold text-slate-900 uppercase font-mono mb-2 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#F37C1C]" />
                    <span>Currency Validities &amp; Document Expiry Checks</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 bg-sky-50/50 border border-sky-200 rounded-xl">
                      <label className="block text-sky-900 font-bold mb-1">Simulator / IR Validity *</label>
                      <input
                        type="date"
                        value={formData.simExpiry}
                        onChange={(e) => setFormData({ ...formData, simExpiry: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-sky-300 rounded-lg text-slate-900 font-mono"
                      />
                    </div>

                    <div className="p-2.5 bg-purple-50/50 border border-purple-200 rounded-xl">
                      <label className="block text-purple-900 font-bold mb-1">SEPT Validity *</label>
                      <input
                        type="date"
                        value={formData.septExpiry}
                        onChange={(e) => setFormData({ ...formData, septExpiry: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-purple-300 rounded-lg text-slate-900 font-mono"
                      />
                    </div>

                    <div className="p-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                      <label className="block text-emerald-900 font-bold mb-1">CRM Validity *</label>
                      <input
                        type="date"
                        value={formData.crmExpiry}
                        onChange={(e) => setFormData({ ...formData, crmExpiry: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-slate-900 font-mono"
                      />
                    </div>

                    <div className="p-2.5 bg-orange-50/50 border border-orange-200 rounded-xl">
                      <label className="block text-orange-900 font-bold mb-1">DGR (Dangerous Goods) *</label>
                      <input
                        type="date"
                        value={formData.dgrExpiry}
                        onChange={(e) => setFormData({ ...formData, dgrExpiry: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-orange-300 rounded-lg text-slate-900 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1">Medical Certificate Expiry</label>
                      <input
                        type="date"
                        value={formData.medicalExpiry}
                        onChange={(e) => setFormData({ ...formData, medicalExpiry: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 mb-1">License Expiry</label>
                      <input
                        type="date"
                        value={formData.licenseExpiry}
                        onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Accumulated Flight Time */}
                <div className="col-span-2 pt-2 border-t border-slate-200">
                  <div className="text-xs font-bold text-slate-900 uppercase font-mono mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#F37C1C]" />
                    <span>Accumulated Flight Time Limitations (FTL)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-700 mb-1">Weekly Block (Max 30h)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.weeklyBlockHours}
                        onChange={(e) => setFormData({ ...formData, weeklyBlockHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1">Monthly Block (Max 100h)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.monthlyBlockHours}
                        onChange={(e) => setFormData({ ...formData, monthlyBlockHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1">Annual Block (Max 1000h)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.annualBlockHours}
                        onChange={(e) => setFormData({ ...formData, annualBlockHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#F37C1C] hover:bg-[#d96711] text-white font-bold rounded-xl shadow-md cursor-pointer font-mono"
                >
                  {editingCrew ? 'Save Crew Changes' : 'Register Crew Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
