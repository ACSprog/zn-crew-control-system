import React, { useState } from 'react';
import { CrewMember } from '../types';
import { FileCheck2, Search, Edit3 } from 'lucide-react';

interface DocumentTrackerViewProps {
  crew: CrewMember[];
  onUpdateCrew: (updatedMember: CrewMember) => void;
}

export const DocumentTrackerView: React.FC<DocumentTrackerViewProps> = ({ crew, onUpdateCrew }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED'>('ALL');

  // Edit Modal State
  const [selectedCrew, setSelectedCrew] = useState<CrewMember | null>(null);
  const [passportExp, setPassportExp] = useState('');
  const [airportPassExp, setAirportPassExp] = useState('');
  const [medicalExp, setMedicalExp] = useState('');
  const [licenseExp, setLicenseExp] = useState('');
  const [simExp, setSimExp] = useState('');
  const [septExp, setSeptExp] = useState('');
  const [crmExp, setCrmExp] = useState('');
  const [dgrExp, setDgrExp] = useState('');

  const now = new Date();

  const getDocStatus = (dateStr?: string) => {
    if (!dateStr) return { days: 0, status: 'EXPIRED' as const };
    const diff = new Date(dateStr).getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    if (days <= 0) return { days, status: 'EXPIRED' as const };
    if (days <= 60) return { days, status: 'EXPIRING_SOON' as const };
    return { days, status: 'VALID' as const };
  };

  const docRows = crew.map((c) => {
    const pStatus = getDocStatus(c.passportExpiry);
    const aStatus = getDocStatus(c.airportPassExpiry);
    const mStatus = getDocStatus(c.medicalExpiry);
    const lStatus = getDocStatus(c.licenseExpiry);
    const simStatus = getDocStatus(c.simExpiry);
    const septStatus = getDocStatus(c.septExpiry);
    const crmStatus = getDocStatus(c.crmExpiry);
    const dgrStatus = getDocStatus(c.dgrExpiry);

    return {
      crewMember: c,
      pStatus,
      aStatus,
      mStatus,
      lStatus,
      simStatus,
      septStatus,
      crmStatus,
      dgrStatus,
    };
  });

  const filteredRows = docRows.filter(
    ({
      crewMember,
      pStatus,
      aStatus,
      mStatus,
      lStatus,
      simStatus,
      septStatus,
      crmStatus,
      dgrStatus,
    }) => {
      const matchesSearch =
        crewMember.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        crewMember.staffNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        crewMember.role.toLowerCase().includes(searchQuery.toLowerCase());

      const statuses = [
        pStatus.status,
        aStatus.status,
        mStatus.status,
        lStatus.status,
        simStatus.status,
        septStatus.status,
        crmStatus.status,
        dgrStatus.status,
      ];
      const matchesStatus = statusFilter === 'ALL' || statuses.includes(statusFilter);

      return matchesSearch && matchesStatus;
    }
  );

  const handleEditDoc = (c: CrewMember) => {
    setSelectedCrew(c);
    setPassportExp(c.passportExpiry || '');
    setAirportPassExp(c.airportPassExpiry || '');
    setMedicalExp(c.medicalExpiry || '');
    setLicenseExp(c.licenseExpiry || '');
    setSimExp(c.simExpiry || '');
    setSeptExp(c.septExpiry || '');
    setCrmExp(c.crmExpiry || '');
    setDgrExp(c.dgrExpiry || '');
  };

  const handleSaveDocs = () => {
    if (!selectedCrew) return;
    const updated: CrewMember = {
      ...selectedCrew,
      passportExpiry: passportExp,
      passportStatus: getDocStatus(passportExp).status === 'VALID' ? 'VALID' : 'EXPIRING_SOON',
      airportPassExpiry: airportPassExp,
      airportPassStatus: getDocStatus(airportPassExp).status === 'VALID' ? 'VALID' : 'EXPIRING_SOON',
      medicalExpiry: medicalExp,
      medicalStatus: getDocStatus(medicalExp).status === 'VALID' ? 'VALID' : 'EXPIRING_SOON',
      licenseExpiry: licenseExp,
      licenseStatus: getDocStatus(licenseExp).status === 'VALID' ? 'VALID' : 'EXPIRING_SOON',
      simExpiry: simExp,
      simStatus: getDocStatus(simExp).status === 'VALID' ? 'VALID' : 'EXPIRING_SOON',
      septExpiry: septExp,
      septStatus: getDocStatus(septExp).status === 'VALID' ? 'VALID' : 'EXPIRING_SOON',
      crmExpiry: crmExp,
      crmStatus: getDocStatus(crmExp).status === 'VALID' ? 'VALID' : 'EXPIRING_SOON',
      dgrExpiry: dgrExp,
      dgrStatus: getDocStatus(dgrExp).status === 'VALID' ? 'VALID' : 'EXPIRING_SOON',
    };
    onUpdateCrew(updated);
    setSelectedCrew(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-full">
      {/* Top Banner */}
      <div className="bg-[#2E2C2B] text-white p-6 rounded-xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileCheck2 className="w-5 h-5 text-[#F37C1C]" />
            <span className="text-xs font-bold text-[#F37C1C] uppercase tracking-widest font-mono">
              Regulatory Compliance & Currency Monitoring
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Crew Document & Currency Tracker</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-3xl">
            Real-time tracking for Simulator/IR, SEPT, CRM, DGR, Medicals, Licenses, Passports, and Airport Passes. Auto-blocks non-compliant crew members from flight rosters.
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search crew name, ID, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#F37C1C]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Expiry Statuses</option>
            <option value="VALID">Valid (&gt;60 days)</option>
            <option value="EXPIRING_SOON">Expiring Soon (&lt;60 days)</option>
            <option value="EXPIRED">Expired (&lt;0 days)</option>
          </select>
        </div>
      </div>

      {/* Main Documents: Mobile Cards (< 768px) & Desktop Table (>= 768px) */}
      {/* 1. Mobile Cards (< 768px) */}
      <div className="block md:hidden space-y-3.5">
        {filteredRows.map(
          ({
            crewMember: c,
            mStatus,
            lStatus,
            simStatus,
            septStatus,
            crmStatus,
            dgrStatus,
          }) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-md space-y-3.5"
            >
              {/* Card Header: Crew Name, Staff No, Role */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <div className="font-extrabold text-sm text-slate-900 font-mono">{c.name}</div>
                  <div className="text-xs font-mono text-slate-500 mt-0.5">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-700">
                      {c.staffNumber}
                    </span>{' '}
                    • {c.role} • {c.aircraft}
                  </div>
                </div>

                <button
                  onClick={() => handleEditDoc(c)}
                  className="min-h-[40px] px-3 py-1.5 bg-slate-100 hover:bg-[#2E2C2B] hover:text-white text-slate-800 rounded-xl text-xs font-bold font-mono transition-colors flex items-center gap-1.5 active:scale-95 shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#F37C1C]" />
                  <span>Edit Dates</span>
                </button>
              </div>

              {/* Currency Badges Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {/* Simulator */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Simulator / IR</div>
                  <div className="font-bold text-slate-900 mt-0.5">{c.simExpiry || 'N/A'}</div>
                  {c.simExpiry && (
                    <span
                      className={`text-[10px] font-bold ${
                        simStatus.status === 'VALID'
                          ? 'text-emerald-600'
                          : simStatus.status === 'EXPIRING_SOON'
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {simStatus.days}d ({simStatus.status})
                    </span>
                  )}
                </div>

                {/* SEPT */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">SEPT Validity</div>
                  <div className="font-bold text-slate-900 mt-0.5">{c.septExpiry || 'N/A'}</div>
                  {c.septExpiry && (
                    <span
                      className={`text-[10px] font-bold ${
                        septStatus.status === 'VALID'
                          ? 'text-emerald-600'
                          : septStatus.status === 'EXPIRING_SOON'
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {septStatus.days}d ({septStatus.status})
                    </span>
                  )}
                </div>

                {/* CRM */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">CRM Validity</div>
                  <div className="font-bold text-slate-900 mt-0.5">{c.crmExpiry || 'N/A'}</div>
                  {c.crmExpiry && (
                    <span
                      className={`text-[10px] font-bold ${
                        crmStatus.status === 'VALID'
                          ? 'text-emerald-600'
                          : crmStatus.status === 'EXPIRING_SOON'
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {crmStatus.days}d ({crmStatus.status})
                    </span>
                  )}
                </div>

                {/* DGR */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">DGR Validity</div>
                  <div className="font-bold text-slate-900 mt-0.5">{c.dgrExpiry || 'N/A'}</div>
                  {c.dgrExpiry && (
                    <span
                      className={`text-[10px] font-bold ${
                        dgrStatus.status === 'VALID'
                          ? 'text-emerald-600'
                          : dgrStatus.status === 'EXPIRING_SOON'
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {dgrStatus.days}d ({dgrStatus.status})
                    </span>
                  )}
                </div>

                {/* Medical */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Medical Expiry</div>
                  <div className="font-bold text-slate-900 mt-0.5">{c.medicalExpiry || 'N/A'}</div>
                  <span
                    className={`text-[10px] font-bold ${
                      mStatus.status === 'VALID'
                        ? 'text-emerald-600'
                        : mStatus.status === 'EXPIRING_SOON'
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {mStatus.days}d ({mStatus.status})
                  </span>
                </div>

                {/* License */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">License Expiry</div>
                  <div className="font-bold text-slate-900 mt-0.5">{c.licenseExpiry || 'N/A'}</div>
                  <span
                    className={`text-[10px] font-bold ${
                      lStatus.status === 'VALID'
                        ? 'text-emerald-600'
                        : lStatus.status === 'EXPIRING_SOON'
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {lStatus.days}d ({lStatus.status})
                  </span>
                </div>
              </div>
            </div>
          )
        )}

        {filteredRows.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 font-mono text-xs">
            No crew document records found in the database.
          </div>
        )}
      </div>

      {/* 2. Desktop Documents Table (>= 768px) */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-200 font-mono text-[11px]">
              <tr>
                <th className="p-3">Staff ID</th>
                <th className="p-3">Crew Member</th>
                <th className="p-3">Simulator / IR</th>
                <th className="p-3">SEPT Validity</th>
                <th className="p-3">CRM Validity</th>
                <th className="p-3">DGR Validity</th>
                <th className="p-3">Medical Expiry</th>
                <th className="p-3">License Expiry</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredRows.map(
                ({
                  crewMember: c,
                  mStatus,
                  lStatus,
                  simStatus,
                  septStatus,
                  crmStatus,
                  dgrStatus,
                }) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-600">{c.staffNumber}</td>
                    <td className="p-3 font-bold text-slate-900">
                      <div>{c.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal font-mono">
                        {c.role} • {c.aircraft}
                      </div>
                    </td>

                    {/* Simulator / IR */}
                    <td className="p-3">
                      <div className="font-mono font-bold text-[11px]">{c.simExpiry || 'N/A'}</div>
                      {c.simExpiry && (
                        <span
                          className={`text-[10px] font-bold font-mono ${
                            simStatus.status === 'VALID'
                              ? 'text-emerald-600'
                              : simStatus.status === 'EXPIRING_SOON'
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {simStatus.days}d ({simStatus.status})
                        </span>
                      )}
                    </td>

                    {/* SEPT */}
                    <td className="p-3">
                      <div className="font-mono font-bold text-[11px]">{c.septExpiry || 'N/A'}</div>
                      {c.septExpiry && (
                        <span
                          className={`text-[10px] font-bold font-mono ${
                            septStatus.status === 'VALID'
                              ? 'text-emerald-600'
                              : septStatus.status === 'EXPIRING_SOON'
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {septStatus.days}d ({septStatus.status})
                        </span>
                      )}
                    </td>

                    {/* CRM */}
                    <td className="p-3">
                      <div className="font-mono font-bold text-[11px]">{c.crmExpiry || 'N/A'}</div>
                      {c.crmExpiry && (
                        <span
                          className={`text-[10px] font-bold font-mono ${
                            crmStatus.status === 'VALID'
                              ? 'text-emerald-600'
                              : crmStatus.status === 'EXPIRING_SOON'
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {crmStatus.days}d ({crmStatus.status})
                        </span>
                      )}
                    </td>

                    {/* DGR */}
                    <td className="p-3">
                      <div className="font-mono font-bold text-[11px]">{c.dgrExpiry || 'N/A'}</div>
                      {c.dgrExpiry && (
                        <span
                          className={`text-[10px] font-bold font-mono ${
                            dgrStatus.status === 'VALID'
                              ? 'text-emerald-600'
                              : dgrStatus.status === 'EXPIRING_SOON'
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {dgrStatus.days}d ({dgrStatus.status})
                        </span>
                      )}
                    </td>

                    {/* Medical Expiry */}
                    <td className="p-3">
                      <div className="font-mono font-bold text-[11px]">{c.medicalExpiry}</div>
                      <span
                        className={`text-[10px] font-bold font-mono ${
                          mStatus.status === 'VALID'
                            ? 'text-emerald-600'
                            : mStatus.status === 'EXPIRING_SOON'
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {mStatus.days}d ({mStatus.status})
                      </span>
                    </td>

                    {/* License Expiry */}
                    <td className="p-3">
                      <div className="font-mono font-bold text-[11px]">{c.licenseExpiry}</div>
                      <span
                        className={`text-[10px] font-bold font-mono ${
                          lStatus.status === 'VALID'
                            ? 'text-emerald-600'
                            : lStatus.status === 'EXPIRING_SOON'
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {lStatus.days}d ({lStatus.status})
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleEditDoc(c)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-[#2E2C2B] hover:text-white text-slate-700 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ml-auto"
                      >
                        <Edit3 className="w-3 h-3" /> Edit Dates
                      </button>
                    </td>
                  </tr>
                )
              )}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-mono text-xs">
                    No crew document records found in the database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Document Modal */}
      {selectedCrew && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              Update Currency & Document Validity Dates — {selectedCrew.name} ({selectedCrew.role})
            </h3>

            <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1">Simulator / IR Validity</label>
                <input
                  type="date"
                  value={simExp}
                  onChange={(e) => setSimExp(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">SEPT Validity</label>
                <input
                  type="date"
                  value={septExp}
                  onChange={(e) => setSeptExp(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">CRM Validity</label>
                <input
                  type="date"
                  value={crmExp}
                  onChange={(e) => setCrmExp(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">DGR (Dangerous Goods) Validity</label>
                <input
                  type="date"
                  value={dgrExp}
                  onChange={(e) => setDgrExp(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Medical Certificate Expiry</label>
                <input
                  type="date"
                  value={medicalExp}
                  onChange={(e) => setMedicalExp(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Flight Crew License Expiry</label>
                <input
                  type="date"
                  value={licenseExp}
                  onChange={(e) => setLicenseExp(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Passport Expiry</label>
                <input
                  type="date"
                  value={passportExp}
                  onChange={(e) => setPassportExp(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Airport Security Pass Expiry</label>
                <input
                  type="date"
                  value={airportPassExp}
                  onChange={(e) => setAirportPassExp(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedCrew(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDocs}
                className="px-4 py-2 bg-[#2E2C2B] text-white rounded-lg font-bold text-xs hover:bg-slate-800 cursor-pointer"
              >
                Save Currency Dates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
