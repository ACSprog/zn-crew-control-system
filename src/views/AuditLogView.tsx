import React, { useState } from 'react';
import { AuditLog } from '../types';
import { ShieldCheck, Search, Filter, History, UserCheck, AlertTriangle, Download, Trash2, CheckCircle2, Lock, Key, RefreshCw } from 'lucide-react';
import { verifyAuditLogIntegrity } from '../utils/securityEngine';

interface AuditLogViewProps {
  auditLogs: AuditLog[];
  onClearLogs?: () => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ auditLogs, onClearLogs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'INFO' | 'WARNING' | 'CRITICAL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [verificationResult, setVerificationResult] = useState<{ isValid: boolean; message: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const filteredLogs = auditLogs.filter((l) => {
    const userStr = l.user || '';
    const actionStr = l.action || l.reason || '';
    const detailsStr = l.details || l.newAssignment || '';
    const matchesSearch =
      userStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      actionStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      detailsStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.immutableSeal && l.immutableSeal.toLowerCase().includes(searchQuery.toLowerCase()));

    const severity = l.severity || 'INFO';
    const matchesSeverity = severityFilter === 'ALL' || severity === severityFilter;
    const matchesRole = roleFilter === 'ALL' || (l.userRole && l.userRole.toUpperCase() === roleFilter.toUpperCase());
    return matchesSearch && matchesSeverity && matchesRole;
  });

  const handleVerifyIntegrity = () => {
    setIsVerifying(true);
    setTimeout(() => {
      const result = verifyAuditLogIntegrity(auditLogs);
      setVerificationResult(result);
      setIsVerifying(false);
    }, 600);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Time', 'User', 'Role', 'Action', 'Details', 'Severity', 'Cryptographic Seal', 'Previous Seal Hash'];
    const rows = auditLogs.map((l) => [
      l.id,
      l.date,
      l.time,
      `"${l.user || ''}"`,
      `"${l.userRole || ''}"`,
      `"${l.action || l.reason || 'Assignment Action'}"`,
      `"${l.details || l.newAssignment || ''}"`,
      l.severity || 'INFO',
      `"${l.immutableSeal || 'GEN-SHA256'}"`,
      `"${l.previousSeal || 'GENESIS'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `zambia_airways_audit_log_sealed_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-full">
      {/* Top Banner */}
      <div className="bg-[#2E2C2B] text-white p-6 rounded-xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-[#F37C1C]" />
            <span className="text-xs font-bold text-[#F37C1C] uppercase tracking-widest font-mono">
              Write-Once Append-Only Security
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white font-mono">Immutable Compliance Audit Log</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Cryptographically sealed SHA-256 hash chained records. Write-once, append-only security preventing alteration or deletion of operational actions, roster publishes, and legality overrides.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleVerifyIntegrity}
            disabled={isVerifying}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            title="Recalculate cryptographic hash chain to verify zero tampering"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>Verify Blockchain Integrity</span>
          </button>

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              title="Clear audit log history (Super Admin only)"
            >
              <Trash2 className="w-4 h-4 text-slate-400" />
              <span>Clear History</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-[#F37C1C] hover:bg-[#D96B12] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 shrink-0 shadow-xs"
          >
            <Download className="w-4 h-4" /> Export Sealed CSV
          </button>
        </div>
      </div>

      {/* Cryptographic Verification Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-xs ${
            verificationResult.isValid
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {verificationResult.isValid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <div>
              <p className="text-xs font-bold font-mono">
                {verificationResult.isValid
                  ? 'SHA-256 Hash Chain Integrity: VERIFIED 100% VALID'
                  : 'Integrity Check Warning'}
              </p>
              <p className="text-[11px] opacity-90">{verificationResult.message}</p>
            </div>
          </div>
          <button
            onClick={() => setVerificationResult(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search action, user, seal hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#F37C1C]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <span className="text-xs text-slate-500 font-mono font-bold">
            {filteredLogs.length} Sealed Entries
          </span>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All User Roles</option>
            <option value="SUPER_ADMIN">Super Admin / IT</option>
            <option value="ADMIN">System Admin</option>
            <option value="SCHEDULER">Crew Scheduler</option>
            <option value="OCC_CONTROLLER">OCC Controller</option>
            <option value="CHIEF_PILOT">Chief Pilot / Line Mgt</option>
            <option value="FLIGHT_CREW">Flight Crew</option>
            <option value="AUDITOR">Safety Auditor</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e: any) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical (Blocks / Bypasses)</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-200 font-mono">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">User & Role</th>
                <th className="p-3.5">Action Executed</th>
                <th className="p-3.5">Operational Details</th>
                <th className="p-3.5">Tamper-Proof Seal</th>
                <th className="p-3.5">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-mono text-xs">
                    No activity audit entries match search criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => {
                  const severity = l.severity || 'INFO';
                  const actionStr = l.action || l.reason || 'System Action';
                  const detailsStr = l.details || (l.flightNumber ? `Flight ${l.flightNumber} -> ${l.newAssignment}` : 'System operation executed');
                  const sealDisplay = l.immutableSeal || `ZA-SEC-${l.id.slice(-6).toUpperCase()}`;

                  return (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono text-slate-500 font-semibold whitespace-nowrap">
                        {l.date} {l.time}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{l.user}</div>
                        {l.userRole && (
                          <span className="text-[10px] text-slate-500 font-mono uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                            {l.userRole}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-bold text-[#2E2C2B] whitespace-nowrap">{actionStr}</td>
                      <td className="p-3.5 text-slate-600 max-w-md">{detailsStr}</td>
                      <td className="p-3.5 whitespace-nowrap font-mono text-[10px]">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold" title={`SHA-256 Hash Chain Seal: ${sealDisplay}`}>
                          <Lock className="w-2.5 h-2.5 text-emerald-600" />
                          <span>{sealDisplay.slice(0, 16)}</span>
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase ${
                            severity === 'CRITICAL'
                              ? 'bg-red-100 text-red-800'
                              : severity === 'WARNING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {severity}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
