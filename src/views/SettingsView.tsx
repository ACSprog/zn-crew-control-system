import React, { useState } from 'react';
import { LegalityRules, AircraftFleet } from '../types';
import { Sliders, RefreshCw, Save, CheckCircle2, ShieldAlert, Plane, Trash2, Database, Plus, Download, Upload } from 'lucide-react';
import { FleetManagementModal } from '../components/FleetManagementModal';

interface SettingsViewProps {
  rules: LegalityRules;
  fleet?: AircraftFleet[];
  onSaveRules: (newRules: LegalityRules) => void;
  onSaveFleet?: (updatedFleet: AircraftFleet[]) => void;
  onSaveAllData?: () => void;
  onExportBackup?: () => void;
  onImportBackup?: (jsonStr: string) => void;
  onClearAllData?: () => void;
  onResetSampleData?: () => void;
  canResetData?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  rules,
  fleet = [],
  onSaveRules,
  onSaveFleet,
  onSaveAllData,
  onExportBackup,
  onImportBackup,
  onClearAllData,
  onResetSampleData,
  canResetData = false,
}) => {
  const [formRules, setFormRules] = useState<LegalityRules>(rules);
  const [isSaved, setIsSaved] = useState(false);
  const [isFleetModalOpen, setIsFleetModalOpen] = useState(false);

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content && onImportBackup) {
        onImportBackup(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRules(formRules);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const q400Fleet = fleet.filter((f) => f.aircraft === 'Q400');
  const b737Fleet = fleet.filter((f) => f.aircraft === 'B737');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-rose-600" />
            Flight Time Limitations (FTL) Scheme Configuration
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Configure operational thresholds for Zambia Airways Civil Aviation Authority (CAA) rules.
          </p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-bold animate-bounce font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            SETTINGS SAVED TO LOCAL STORAGE
          </div>
        )}
      </div>

      {/* Mandatory Disclaimer */}
      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-amber-900 text-xs font-semibold">
        ⚠️ <strong>Aviation Regulatory Warning:</strong> "Operational limits must be configured and validated against the airline's approved FTL scheme."
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-6">
        <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 font-mono">
          OPERATIONAL FTL LIMIT PARAMETERS &amp; REGULATORY THRESHOLDS
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs font-semibold">
          {/* Weekly Block Hours Limit */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-slate-900 font-extrabold uppercase font-mono">
              Maximum Weekly Block Hours
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                required
                value={formRules.maxWeeklyBlockHours ?? 30}
                onChange={(e) =>
                  setFormRules({ ...formRules, maxWeeklyBlockHours: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-sm"
              />
              <span className="text-slate-500 font-mono">Hours</span>
            </div>
            <p className="text-[10px] text-slate-500 font-normal">
              Weekly cumulative flight block hours limitation (Default: 30 Hours).
            </p>
          </div>

          {/* Monthly Block Hours Limit */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-slate-900 font-extrabold uppercase font-mono">
              Maximum Monthly Block Hours
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                required
                value={formRules.maxMonthlyBlockHours ?? 100}
                onChange={(e) =>
                  setFormRules({ ...formRules, maxMonthlyBlockHours: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-sm"
              />
              <span className="text-slate-500 font-mono">Hours</span>
            </div>
            <p className="text-[10px] text-slate-500 font-normal">
              Monthly cumulative flight block hours limitation (Default: 100 Hours).
            </p>
          </div>

          {/* Annual Block Hours Limit */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-slate-900 font-extrabold uppercase font-mono">
              Maximum Annual Block Hours
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                required
                value={formRules.maxAnnualBlockHours ?? 1000}
                onChange={(e) =>
                  setFormRules({ ...formRules, maxAnnualBlockHours: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-sm"
              />
              <span className="text-slate-500 font-mono">Hours</span>
            </div>
            <p className="text-[10px] text-slate-500 font-normal">
              Annual cumulative flight block hours limitation (Default: 1,000 Hours).
            </p>
          </div>

          {/* Minimum Rest Hours */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-slate-900 font-extrabold uppercase font-mono">
              Minimum Rest Hours (Between Duties)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                required
                value={formRules.minRestHours ?? 10}
                onChange={(e) =>
                  setFormRules({ ...formRules, minRestHours: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-sm"
              />
              <span className="text-slate-500 font-mono">Hours</span>
            </div>
            <p className="text-[10px] text-slate-500 font-normal">
              Minimum mandatory rest between consecutive duty periods (Default: 10 Hours).
            </p>
          </div>

          {/* Maximum Duty Hours */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-slate-900 font-extrabold uppercase font-mono">
              Maximum Duty Period (FDP)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                required
                value={formRules.maxDutyHours ?? 12}
                onChange={(e) =>
                  setFormRules({ ...formRules, maxDutyHours: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-sm"
              />
              <span className="text-slate-500 font-mono">Hours</span>
            </div>
            <p className="text-[10px] text-slate-500 font-normal">
              Maximum single duty period duration limit (Default: 12 Hours).
            </p>
          </div>

          {/* Rolling 7-Day Continuous Rest */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-slate-900 font-extrabold uppercase font-mono">
              Rolling 7-Day Continuous Rest
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                required
                value={formRules.minRolling7DayRestHours ?? 24}
                onChange={(e) =>
                  setFormRules({ ...formRules, minRolling7DayRestHours: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-sm"
              />
              <span className="text-slate-500 font-mono">Hours</span>
            </div>
            <p className="text-[10px] text-slate-500 font-normal">
              Minimum continuous rest within any rolling 7 consecutive days (Default: 24 Hours).
            </p>
          </div>

          {/* Max Landings per Duty */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-slate-900 font-extrabold uppercase font-mono">
              Maximum Landings Per Duty
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                required
                value={formRules.maxLandingsPerDuty ?? 5}
                onChange={(e) =>
                  setFormRules({ ...formRules, maxLandingsPerDuty: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-sm"
              />
              <span className="text-slate-500 font-mono">Landings</span>
            </div>
            <p className="text-[10px] text-slate-500 font-normal">
              Maximum flight sectors/landings in one continuous duty period (Default: 5).
            </p>
          </div>

          {/* Max Ground Time Between Linked Sectors */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-slate-900 font-extrabold uppercase font-mono">
              Max Linked Sector Ground Time
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                required
                value={formRules.maxGroundTimeBetweenSectorsHours ?? 2.0}
                onChange={(e) =>
                  setFormRules({ ...formRules, maxGroundTimeBetweenSectorsHours: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-sm"
              />
              <span className="text-slate-500 font-mono">Hours</span>
            </div>
            <p className="text-[10px] text-slate-500 font-normal">
              Ground time threshold to link consecutive sectors on same aircraft (Default: &lt; 2.0h).
            </p>
          </div>

          {/* Max Consecutive Duties */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-slate-900 font-extrabold uppercase font-mono">
              Max Consecutive Duties
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                required
                value={formRules.maxConsecutiveDuties ?? 6}
                onChange={(e) =>
                  setFormRules({ ...formRules, maxConsecutiveDuties: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-sm"
              />
              <span className="text-slate-500 font-mono">Days</span>
            </div>
            <p className="text-[10px] text-slate-500 font-normal">
              Maximum consecutive duty days before mandatory 24h rest period.
            </p>
          </div>
        </div>

        {/* Crew Composition Requirements */}
        <div className="pt-4 border-t border-slate-100">
          <h4 className="text-sm font-bold text-slate-900 mb-3 font-mono">
            MANDATORY CREW COMPOSITION RULES
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Q400 Composition */}
            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 font-mono">Q400 Crew Composition</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono">
                  Dash-8 Fleet
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 text-[11px] font-bold mb-1">
                    Min Cabin Crew (CC)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formRules.q400CcCountReq ?? 2}
                    onChange={(e) =>
                      setFormRules({ ...formRules, q400CcCountReq: parseInt(e.target.value) || 2 })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg font-mono font-bold"
                  />
                  <span className="text-[10px] text-blue-700">Default: Min 2 CC</span>
                </div>
                <div>
                  <label className="block text-slate-700 text-[11px] font-bold mb-1">
                    Min Senior Cabin Crew (SCC)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formRules.q400SccCountReq ?? 1}
                    onChange={(e) =>
                      setFormRules({ ...formRules, q400SccCountReq: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg font-mono font-bold"
                  />
                  <span className="text-[10px] text-blue-700">Default: Min 1 SCC</span>
                </div>
              </div>
            </div>

            {/* B737 Composition */}
            <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-orange-900 font-mono">B737 Crew Composition</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-100 text-orange-800 rounded font-mono">
                  Boeing 737-800
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 text-[11px] font-bold mb-1">
                    Min Cabin Crew (CC)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formRules.b737CcCountReq ?? 4}
                    onChange={(e) =>
                      setFormRules({ ...formRules, b737CcCountReq: parseInt(e.target.value) || 4 })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-orange-300 rounded-lg font-mono font-bold"
                  />
                  <span className="text-[10px] text-orange-700">Default: Min 4 CC</span>
                </div>
                <div>
                  <label className="block text-slate-700 text-[11px] font-bold mb-1">
                    Min Senior Cabin Crew (SCC)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formRules.b737SccCountReq ?? 1}
                    onChange={(e) =>
                      setFormRules({ ...formRules, b737SccCountReq: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-orange-300 rounded-lg font-mono font-bold"
                  />
                  <span className="text-[10px] text-orange-700">Default: Min 1 SCC</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center pt-4 border-t border-slate-100">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 font-mono cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>SAVE OPERATIONAL RULES</span>
          </button>
        </div>
      </form>

      {/* Fleet Management Configuration Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 font-mono">
              <Plane className="w-5 h-5 text-[#F37C1C]" />
              ZAMBIA AIRWAYS FLEET &amp; AIRCRAFT REGISTER
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Manage active fleet models, tail number registrations, maintenance status, and base allocations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsFleetModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2E2C2B] hover:bg-black text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer font-mono"
          >
            <Plus className="w-4 h-4 text-[#F37C1C]" />
            <span>MANAGE FLEET &amp; TAIL NUMBERS ({fleet.length} AIRCRAFT)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Q400 Summary */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 font-mono">Dash 8-Q400 Fleet</span>
              <span className="px-2 py-0.5 bg-[#F37C1C]/10 text-[#F37C1C] border border-[#F37C1C]/30 rounded font-mono font-bold text-[10px]">
                {q400Fleet.length} Registered
              </span>
            </div>
            <div className="text-xs font-mono text-slate-600 space-y-1">
              <p>Tail Registrations: {q400Fleet.map((f) => f.registration).join(', ') || 'None registered'}</p>
              <p className="text-[11px] text-slate-500">
                Serviceable: {q400Fleet.filter((f) => f.status === 'SERVICEABLE').length} | Maintenance:{' '}
                {q400Fleet.filter((f) => f.status === 'MAINTENANCE').length}
              </p>
            </div>
          </div>

          {/* B737 Summary */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 font-mono">Boeing 737-800 Fleet</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded font-mono font-bold text-[10px]">
                {b737Fleet.length} Registered
              </span>
            </div>
            <div className="text-xs font-mono text-slate-600 space-y-1">
              <p>Tail Registrations: {b737Fleet.map((f) => f.registration).join(', ') || 'None registered'}</p>
              <p className="text-[11px] text-slate-500">
                Serviceable: {b737Fleet.filter((f) => f.status === 'SERVICEABLE').length} | Maintenance:{' '}
                {b737Fleet.filter((f) => f.status === 'MAINTENANCE').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Explicit Save & Backup Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 font-mono">
            <Save className="w-5 h-5 text-[#F37C1C]" />
            DATA PERSISTENCE &amp; BACKUP FILE EXPORT / IMPORT
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Explicitly save system changes to local database or export/import complete backup files (.json).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 block font-mono">1. Explicit Save</span>
              <p className="text-[11px] text-slate-500 mt-1">
                Force write all current crew, flights, assignments, fleet, and rules into persistent browser storage.
              </p>
            </div>
            {onSaveAllData && (
              <button
                type="button"
                onClick={onSaveAllData}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#2E2C2B] hover:bg-black text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer font-mono"
              >
                <Save className="w-4 h-4 text-[#F37C1C]" />
                <span>SAVE ALL DATA NOW</span>
              </button>
            )}
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 block font-mono">2. Download Backup (.json)</span>
              <p className="text-[11px] text-slate-500 mt-1">
                Export a complete JSON backup file of all crew database records, flights, and user accounts.
              </p>
            </div>
            {onExportBackup && (
              <button
                type="button"
                onClick={onExportBackup}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer font-mono"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>EXPORT BACKUP FILE</span>
              </button>
            )}
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 block font-mono">3. Restore Backup File</span>
              <p className="text-[11px] text-slate-500 mt-1">
                Upload a previously saved .json backup file to restore complete system database records.
              </p>
            </div>
            {onImportBackup && (
              <label className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-xs rounded-xl transition-all cursor-pointer font-mono border border-slate-300">
                <Upload className="w-4 h-4 text-slate-700" />
                <span>RESTORE FROM BACKUP</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Database Management & Data Wipe Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 font-mono">
            <Database className="w-5 h-5 text-slate-700" />
            DATABASE &amp; CUSTOM DATA INITIALIZATION
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Clear sample records to insert your own custom airline data, or restore default Zambia Airways demo data.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-800 block">Clear All System Records</span>
            <p className="text-[11px] text-slate-500 max-w-lg">
              Empties all flights, crew members, assignments, leave exclusions, and fleet registrations so you can start with a clean database and input your own data.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onClearAllData && (
              <button
                type="button"
                disabled={!canResetData}
                onClick={() => {
                  if (!canResetData) return;
                  if (
                    window.confirm(
                      'Are you sure you want to CLEAR ALL DATA across all pages? This permanently deletes every crew, flight, assignment, leave and fleet record from the live database for everyone. This cannot be undone.'
                    )
                  ) {
                    onClearAllData();
                  }
                }}
                title={canResetData ? undefined : 'Restricted to Admin accounts'}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer font-mono"
              >
                <Trash2 className="w-4 h-4" />
                <span>CLEAR ALL DATA (START BLANK)</span>
              </button>
            )}

{onResetSampleData && (
            <button
              type="button"
              onClick={onResetSampleData}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-all cursor-pointer font-mono"
            >
              <RefreshCw className="w-4 h-4 text-slate-600" />
              <span>RESTORE SAMPLE DEMO DATA</span>
            </button>
            )}
          </div>
        </div>
      </div>

      {/* Fleet Modal */}
      {onSaveFleet && (
        <FleetManagementModal
          isOpen={isFleetModalOpen}
          onClose={() => setIsFleetModalOpen(false)}
          fleet={fleet}
          onSaveFleet={onSaveFleet}
        />
      )}
    </div>
  );
};
