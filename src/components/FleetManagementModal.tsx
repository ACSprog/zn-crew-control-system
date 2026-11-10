import React, { useState } from 'react';
import { AircraftFleet, AircraftType } from '../types';
import { Plane, Plus, Trash2, Edit2, Save, X, CheckCircle2, AlertTriangle, Wrench, ShieldAlert } from 'lucide-react';

interface FleetManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  fleet: AircraftFleet[];
  onSaveFleet: (updatedFleet: AircraftFleet[]) => void;
}

export const FleetManagementModal: React.FC<FleetManagementModalProps> = ({
  isOpen,
  onClose,
  fleet,
  onSaveFleet,
}) => {
  const [localFleet, setLocalFleet] = useState<AircraftFleet[]>(fleet);
  const [editingRegistration, setEditingRegistration] = useState<string | null>(null);

  // Form State for Adding/Editing Aircraft
  const [aircraftType, setAircraftType] = useState<AircraftType>('Q400');
  const [registration, setRegistration] = useState('');
  const [status, setStatus] = useState<'SERVICEABLE' | 'MAINTENANCE' | 'AOG'>('SERVICEABLE');
  const [location, setLocation] = useState('LUN');
  const [activeCount, setActiveCount] = useState(1);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddOrUpdateAircraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registration.trim()) return;

    const formattedReg = registration.trim().toUpperCase();

    if (editingRegistration) {
      // Update existing
      const updated = localFleet.map((item) =>
        item.registration === editingRegistration
          ? {
              aircraft: aircraftType,
              registration: formattedReg,
              status,
              location: location.toUpperCase(),
              activeCount: Number(activeCount) || 1,
            }
          : item
      );
      setLocalFleet(updated);
      onSaveFleet(updated);
      setFeedbackMsg(`Updated aircraft ${formattedReg} in fleet register.`);
      setEditingRegistration(null);
    } else {
      // Check if registration exists
      if (localFleet.some((f) => f.registration === formattedReg)) {
        setFeedbackMsg(`Aircraft registration ${formattedReg} already exists in fleet!`);
        return;
      }

      const newItem: AircraftFleet = {
        aircraft: aircraftType,
        registration: formattedReg,
        status,
        location: location.toUpperCase() || 'LUN',
        activeCount: Number(activeCount) || 1,
      };

      const updated = [...localFleet, newItem];
      setLocalFleet(updated);
      onSaveFleet(updated);
      setFeedbackMsg(`Added aircraft ${formattedReg} to active Zambia Airways fleet.`);
    }

    // Reset Form
    setRegistration('');
    setAircraftType('Q400');
    setStatus('SERVICEABLE');
    setLocation('LUN');
    setActiveCount(1);

    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleEditClick = (item: AircraftFleet) => {
    setEditingRegistration(item.registration);
    setAircraftType(item.aircraft);
    setRegistration(item.registration);
    setStatus(item.status);
    setLocation(item.location || 'LUN');
    setActiveCount(item.activeCount || 1);
  };

  const handleDeleteClick = (reg: string) => {
    const updated = localFleet.filter((f) => f.registration !== reg);
    setLocalFleet(updated);
    onSaveFleet(updated);
    setFeedbackMsg(`Removed aircraft ${reg} from fleet register.`);
    if (editingRegistration === reg) setEditingRegistration(null);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const serviceableCount = localFleet.filter((f) => f.status === 'SERVICEABLE').length;
  const maintenanceCount = localFleet.filter((f) => f.status === 'MAINTENANCE').length;
  const aogCount = localFleet.filter((f) => f.status === 'AOG').length;

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#2E2C2B] text-white p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F37C1C]/20 border border-[#F37C1C]/40 text-[#F37C1C] flex items-center justify-center">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-white uppercase font-mono">
                Fleet Register &amp; Aircraft Configuration
              </h3>
              <p className="text-[11px] text-slate-300">
                Update fleet models, registrations, serviceable status, and operating base locations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Fleet Summary Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-[10px] font-bold text-slate-500 uppercase font-mono">Total Fleet</div>
              <div className="text-xl font-black text-slate-900 mt-1 font-mono">{localFleet.length}</div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="text-[10px] font-bold text-emerald-700 uppercase font-mono">Serviceable</div>
              <div className="text-xl font-black text-emerald-800 mt-1 font-mono">{serviceableCount}</div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="text-[10px] font-bold text-amber-700 uppercase font-mono">Maintenance</div>
              <div className="text-xl font-black text-amber-800 mt-1 font-mono">{maintenanceCount}</div>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <div className="text-[10px] font-bold text-red-700 uppercase font-mono">AOG Grounded</div>
              <div className="text-xl font-black text-red-800 mt-1 font-mono">{aogCount}</div>
            </div>
          </div>

          {feedbackMsg && (
            <div className="p-3 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Add / Edit Aircraft Form */}
          <form onSubmit={handleAddOrUpdateAircraft} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 uppercase font-mono flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#F37C1C]" />
                {editingRegistration ? `Editing Aircraft ${editingRegistration}` : 'Add New Aircraft to Fleet'}
              </span>
              {editingRegistration && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRegistration(null);
                    setRegistration('');
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-800 font-mono font-bold underline cursor-pointer"
                >
                  Cancel Editing
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Aircraft Type *</label>
                <select
                  value={aircraftType}
                  onChange={(e) => setAircraftType(e.target.value as AircraftType)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-[#F37C1C]"
                >
                  <option value="Q400">Dash 8 - Q400</option>
                  <option value="B737">Boeing 737-800</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Registration Tail *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9J-ZQA"
                  value={registration}
                  onChange={(e) => setRegistration(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800 focus:outline-none focus:border-[#F37C1C]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Service Status *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-[#F37C1C]"
                >
                  <option value="SERVICEABLE">SERVICEABLE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="AOG">AOG (GROUNDED)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Base / Station</label>
                <input
                  type="text"
                  placeholder="e.g. LUN"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-800 focus:outline-none focus:border-[#F37C1C]"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-[#F37C1C] hover:bg-[#D96B12] text-white font-bold text-xs rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingRegistration ? 'Save Update' : 'Add Aircraft'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Current Active Fleet Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase font-mono">
                Active Fleet List ({localFleet.length} Aircraft Registered)
              </h4>
            </div>

            {localFleet.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-mono text-xs">
                No aircraft registered in fleet yet. Use the form above or import fleet via CSV to add aircraft.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#2E2C2B] text-white font-mono text-[11px] uppercase">
                    <tr>
                      <th className="p-2.5">Aircraft Type</th>
                      <th className="p-2.5">Registration</th>
                      <th className="p-2.5">Operational Status</th>
                      <th className="p-2.5">Station Base</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white font-medium">
                    {localFleet.map((item) => {
                      const statusBadge =
                        item.status === 'SERVICEABLE'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : item.status === 'MAINTENANCE'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-red-100 text-red-800 border-red-200';

                      return (
                        <tr key={item.registration} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 font-bold text-slate-900">
                            {item.aircraft === 'Q400' ? 'Dash 8 - Q400' : 'Boeing 737-800'}
                          </td>
                          <td className="p-2.5 font-mono font-extrabold text-[#F37C1C]">
                            {item.registration}
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${statusBadge}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-slate-700">{item.location || 'LUN'}</td>
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleEditClick(item)}
                                className="p-1.5 text-slate-500 hover:text-[#F37C1C] hover:bg-orange-50 rounded transition-colors cursor-pointer"
                                title="Edit Aircraft Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(item.registration)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                title="Remove Aircraft from Fleet"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            💾 Changes are saved immediately to system database
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Done / Close
          </button>
        </div>
      </div>
    </div>
  );
};
