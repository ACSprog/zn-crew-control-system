import React, { useState } from 'react';
import { LeaveTrainingRecord, CrewMember, LeaveTrainingType } from '../types';
import { addDaysISO, todayISO } from '../utils/dates';
import {
  CalendarOff,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Stethoscope,
  Plane,
  Clock,
  ShieldAlert,
} from 'lucide-react';

interface LeaveTrainingViewProps {
  leaveRecords: LeaveTrainingRecord[];
  crew: CrewMember[];
  onAddLeaveRecord: (record: Omit<LeaveTrainingRecord, 'id'>) => void;
  onDeleteLeaveRecord: (id: string) => void;
}

export const LeaveTrainingView: React.FC<LeaveTrainingViewProps> = ({
  leaveRecords,
  crew,
  onAddLeaveRecord,
  onDeleteLeaveRecord,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    crewId: crew[0]?.id || '',
    type: 'Annual Leave' as LeaveTrainingType,
    startDate: todayISO(),
    endDate: addDaysISO(5),
    description: '',
    approved: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.crewId) return;

    const crewMember = crew.find((c) => c.id === formData.crewId);
    onAddLeaveRecord({
      ...formData,
      crewName: crewMember?.name || 'Crew Member',
    });
    setIsModalOpen(false);
  };

  const getBadgeColor = (type: LeaveTrainingType) => {
    switch (type) {
      case 'Annual Leave':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Simulator':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Training':
      case 'Recurrent Training':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Medical':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Line Check':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Control */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-purple-600" />
            Crew Leave & Training Management
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Active exclusions automatically prevent scheduling during approved absence periods
          </p>
        </div>

        <button
          onClick={() => {
            if (crew.length > 0) setFormData({ ...formData, crewId: crew[0].id });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>SCHEDULE LEAVE / TRAINING</span>
        </button>
      </div>

      {/* Currently Excluded Crew Alert Box */}
      <div className="bg-gradient-to-r from-slate-900 to-purple-950 p-5 rounded-2xl text-white shadow-xl space-y-3 border border-purple-900/50">
        <div className="flex items-center gap-2 font-bold text-sm text-purple-300">
          <ShieldAlert className="w-4 h-4 text-purple-400" />
          AUTO-EXCLUDED CREW MEMBERS ({leaveRecords.filter((r) => r.approved).length})
        </div>
        <p className="text-xs text-slate-300">
          The deterministic scheduling engine enforces mandatory zero-assignment rules for all crew listed below during their registered dates.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {leaveRecords.filter((r) => r.approved).length === 0 ? (
            <div className="col-span-full py-2 text-xs text-purple-300/80 italic">
              No active leave or training exclusions registered. All qualified crew are available for flight assignments.
            </div>
          ) : (
            leaveRecords
              .filter((r) => r.approved)
              .map((rec) => {
                const crewMember = crew.find((c) => c.id === rec.crewId);
                return (
                  <div
                    key={rec.id}
                    className="bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/10 text-xs space-y-1"
                  >
                    <div className="font-bold text-white flex justify-between items-center">
                      <span>{rec.crewName || crewMember?.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                        {rec.type}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-purple-200">
                      {rec.startDate} → {rec.endDate}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Leave & Training Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-slate-500 uppercase bg-slate-100/80 border-b border-slate-200 font-mono">
              <tr>
                <th className="px-4 py-3.5">Crew Member</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Start Date</th>
                <th className="px-4 py-3.5">End Date</th>
                <th className="px-4 py-3.5">Description</th>
                <th className="px-4 py-3.5">Auto Exclusion Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaveRecords.map((record) => {
                const crewMember = crew.find((c) => c.id === record.crewId);
                return (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-slate-900 text-sm">
                      {record.crewName || crewMember?.name}
                      <div className="text-[10px] text-slate-500 font-mono font-normal">
                        {crewMember?.role} • {crewMember?.aircraft} ({crewMember?.base})
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${getBadgeColor(
                          record.type
                        )}`}
                      >
                        {record.type}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-mono font-bold text-slate-800">
                      {record.startDate}
                    </td>

                    <td className="px-4 py-3.5 font-mono font-bold text-slate-800">
                      {record.endDate}
                    </td>

                    <td className="px-4 py-3.5 text-slate-600 font-medium max-w-xs truncate">
                      {record.description || 'N/A'}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ACTIVE EXCLUSION ENFORCED
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => onDeleteLeaveRecord(record.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {leaveRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <CalendarOff className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <div className="font-bold text-slate-700 text-sm">
                      No Leave or Training Exclusions Registered
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      The leave and training registry is currently empty. Use "Schedule Leave / Training" above to register approved leave, simulator checks, or medical appointments.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Leave / Training Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">
                Register Crew Absence / Training Event
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1">Crew Member</label>
                <select
                  value={formData.crewId}
                  onChange={(e) => setFormData({ ...formData, crewId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold"
                >
                  {crew.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.staffNumber}) - {c.role} ({c.aircraft})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Event Type</label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as LeaveTrainingType })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                >
                  <option value="Annual Leave">Annual Leave</option>
                  <option value="Simulator">Simulator</option>
                  <option value="Training">Training</option>
                  <option value="Line Check">Line Check</option>
                  <option value="Medical">Medical</option>
                  <option value="Recurrent Training">Recurrent Training</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Notes / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Approved Annual Vacation / Sim Refresher JNB"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md"
                >
                  Register Exclusion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
