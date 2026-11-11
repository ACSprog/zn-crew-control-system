import React, { useState } from 'react';
import { Flight, AircraftType, FlightStatus, AircraftFleet } from '../types';
import { todayISO } from '../utils/dates';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Plane,
  Calendar,
  Clock,
  Filter,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  X,
  Sparkles,
} from 'lucide-react';
import Papa from 'papaparse';
import { FleetManagementModal } from '../components/FleetManagementModal';
import {
  parseFlightScheduleData,
  generateFlightsFromSeasonalPatterns,
  DEFAULT_COMMERCIAL_SEASONAL_SCHEDULE,
  OFFICIAL_COMMERCIAL_FLIGHT_SCHEDULE_ROWS,
} from '../utils/seasonalScheduleParser';

interface FlightDatabaseViewProps {
  flights: Flight[];
  fleet?: AircraftFleet[];
  onAddFlight: (flight: Omit<Flight, 'id'>) => void;
  onUpdateFlight: (flight: Flight) => void;
  onDeleteFlight: (id: string) => void;
  onImportFlights?: (importedFlights: Flight[]) => void;
  onSaveFleet?: (updatedFleet: AircraftFleet[]) => void;
  onClearAllData?: () => void;
}

export const FlightDatabaseView: React.FC<FlightDatabaseViewProps> = ({
  flights,
  fleet = [],
  onAddFlight,
  onUpdateFlight,
  onDeleteFlight,
  onImportFlights,
  onSaveFleet,
  onClearAllData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [aircraftFilter, setAircraftFilter] = useState<AircraftType | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFleetModalOpen, setIsFleetModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ recordsAdded: number; message: string } | null>(null);
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null);

  const [formData, setFormData] = useState({
    flightNumber: 'ZN101',
    date: todayISO(),
    aircraft: 'Q400' as AircraftType,
    registration: fleet.length > 0 ? fleet[0].registration : '',
    departure: 'LUN',
    arrival: 'NLA',
    std: '06:30',
    sta: '08:00',
    blockHours: 1.5,
    status: 'SCHEDULED' as FlightStatus,
  });

  const handleOpenAddModal = () => {
    const defaultAircraft: AircraftType = 'Q400';
    const matchingFleet = fleet.find(f => f.aircraftType === defaultAircraft);
    setEditingFlight(null);
    setFormData({
      flightNumber: `ZN${Math.floor(100 + Math.random() * 900)}`,
      date: todayISO(),
      aircraft: defaultAircraft,
      registration: matchingFleet ? matchingFleet.registration : (fleet.length > 0 ? fleet[0].registration : ''),
      departure: 'LUN',
      arrival: 'NLA',
      std: '06:30',
      sta: '08:00',
      blockHours: 1.5,
      status: 'SCHEDULED',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (flight: Flight) => {
    setEditingFlight(flight);
    setFormData({
      flightNumber: flight.flightNumber,
      date: flight.date,
      aircraft: flight.aircraft,
      registration: flight.registration,
      departure: flight.departure,
      arrival: flight.arrival,
      std: flight.std,
      sta: flight.sta,
      blockHours: flight.blockHours,
      status: flight.status,
    });
    setIsModalOpen(true);
  };

  const handleDownloadScheduleTemplate = () => {
    // Provide exact 16-column Zambia Airways Commercial Department seasonal flight schedule format
    const csvString = Papa.unparse(OFFICIAL_COMMERCIAL_FLIGHT_SCHEDULE_ROWS);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'Zambia_Airways_Commercial_Flight_Schedule_11Apr_04Oct.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadOfficialCommercialSchedule = () => {
    if (!onImportFlights) return;
    const scheduleResult = parseFlightScheduleData(OFFICIAL_COMMERCIAL_FLIGHT_SCHEDULE_ROWS);
    if (scheduleResult.flights.length > 0) {
      const uniqueFlights = scheduleResult.flights.filter(
        (nf) => !flights.some((f) => f.flightNumber === nf.flightNumber && f.date === nf.date && f.departure === nf.departure)
      );
      onImportFlights(uniqueFlights);
      setUploadFeedback({
        recordsAdded: uniqueFlights.length,
        message: `Official Zambia Airways Commercial Schedule Loaded: Generated ${uniqueFlights.length} operational flight sectors from ${scheduleResult.seasonalPatterns.length} commercial route patterns (11-Apr-2026 to 04-Oct-2026).`,
      });
    }
  };

  const handleScheduleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        if (!rows || rows.length === 0) return;

        const scheduleResult = parseFlightScheduleData(rows);
        if (scheduleResult.flights.length > 0 && onImportFlights) {
          // Filter out duplicates against existing flights
          const uniqueFlights = scheduleResult.flights.filter(
            (nf) => !flights.some((f) => f.flightNumber === nf.flightNumber && f.date === nf.date && f.departure === nf.departure)
          );
          onImportFlights(uniqueFlights);
          setUploadFeedback({
            recordsAdded: uniqueFlights.length,
            message: scheduleResult.isSeasonal
              ? `Commercial Seasonal Schedule Auto-Generated: Created ${uniqueFlights.length} operational flight sectors from ${scheduleResult.seasonalPatterns.length} commercial route patterns across the seasonal date range.`
              : `Successfully imported ${uniqueFlights.length} operational flight schedule rows.`,
          });
        } else {
          setUploadFeedback({
            recordsAdded: 0,
            message: 'No valid flight schedule rows found in the uploaded file.',
          });
        }
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingFlight) {
      onUpdateFlight({
        ...editingFlight,
        ...formData,
      });
    } else {
      onAddFlight(formData);
    }
    setIsModalOpen(false);
  };

  const filteredFlights = flights.filter((flight) => {
    const matchesSearch =
      flight.flightNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flight.departure.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flight.arrival.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flight.registration.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAircraft = aircraftFilter === 'ALL' || flight.aircraft === aircraftFilter;
    const matchesDate = !dateFilter || flight.date === dateFilter;

    return matchesSearch && matchesAircraft && matchesDate;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Controls Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Flight Schedule Database</h2>
            <p className="text-xs text-slate-500 font-medium">
              Showing {filteredFlights.length} of {flights.length} scheduled Zambia Airways flights
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsFleetModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#2E2C2B] hover:bg-black text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer font-mono"
            >
              <Plane className="w-4 h-4 text-[#F37C1C]" />
              <span>Manage Fleet ({fleet.length})</span>
            </button>

            <button
              onClick={handleDownloadScheduleTemplate}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              title="Download exact 16-column Zambia Airways Commercial Flight Schedule CSV"
            >
              <Download className="w-4 h-4 text-[#F37C1C]" />
              <span>Template CSV (16 Cols)</span>
            </button>

            <button
              onClick={handleLoadOfficialCommercialSchedule}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer font-mono"
              title="Auto-load official Zambia Airways seasonal flight schedule (11-Apr to 04-Oct 2026)"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F37C1C]" />
              <span>Load Commercial Schedule (Apr–Oct)</span>
            </button>

            <button
              onClick={() => {
                setUploadFeedback(null);
                setIsUploadModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Import Schedule CSV</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ADD NEW FLIGHT</span>
            </button>

            {onClearAllData && (
              <button
                onClick={() => {
                  if (window.confirm('Clear all database records across all pages to insert your own custom data?')) {
                    onClearAllData();
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-bold text-xs rounded-xl transition-all cursor-pointer"
                title="Wipe database to insert your own data"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>Clear Data</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search Flight No., Airport, Reg..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <select
              value={aircraftFilter}
              onChange={(e) => setAircraftFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="ALL">Filter Fleet: All Aircraft</option>
              <option value="Q400">Filter: Q400 Fleet</option>
              <option value="B737">Filter: B737 Fleet</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>
      </div>

      {/* Flight Schedule: Mobile Card Grid (< 768px) & Desktop Table (>= 768px) */}
      {/* 1. Mobile Cards (< 768px) */}
      <div className="block md:hidden space-y-3.5">
        {filteredFlights.map((flight) => (
          <div
            key={flight.id}
            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-md space-y-3"
          >
            {/* Header: Flight Number & Status */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base font-mono text-slate-900">
                  {flight.flightNumber}
                </span>
                <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-xs font-mono font-bold">
                  {flight.aircraft}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  ({flight.registration})
                </span>
              </div>

              <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                {flight.status}
              </span>
            </div>

            {/* Route & Times Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-500">Date:</span>{' '}
                <span className="font-bold text-slate-900">{flight.date}</span>
              </div>
              <div>
                <span className="text-slate-500">Route:</span>{' '}
                <span className="font-bold text-slate-900">{flight.departure} → {flight.arrival}</span>
              </div>
              <div>
                <span className="text-slate-500">STD / STA:</span>{' '}
                <span className="font-bold text-slate-900">{flight.std} - {flight.sta}</span>
              </div>
              <div>
                <span className="text-slate-500">Block:</span>{' '}
                <span className="font-bold text-slate-900">{flight.blockHours}h</span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
              <button
                onClick={() => handleOpenEditModal(flight)}
                className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold font-mono transition-colors active:scale-98"
              >
                <Edit2 className="w-4 h-4 text-slate-600" />
                <span>Edit Flight</span>
              </button>
              <button
                onClick={() => onDeleteFlight(flight.id)}
                className="min-h-[44px] px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold font-mono transition-colors flex items-center justify-center active:scale-98"
                title="Delete Flight"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filteredFlights.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            <Plane className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <div className="font-bold text-slate-700 text-sm">No Flight Monitoring Records Found</div>
            <p className="text-xs text-slate-400 mt-1">
              The flight monitoring schedule is currently empty. Use "Add Flight" or "Import CSV Schedule" to enter operational flights.
            </p>
          </div>
        )}
      </div>

      {/* 2. Desktop Flight Schedule Table (>= 768px) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-slate-500 uppercase bg-slate-100/80 border-b border-slate-200 font-mono">
              <tr>
                <th className="px-4 py-3.5">Flight No</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Aircraft & Reg</th>
                <th className="px-4 py-3.5">Route</th>
                <th className="px-4 py-3.5">STD / STA</th>
                <th className="px-4 py-3.5">Block Hours</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFlights.map((flight) => (
                <tr key={flight.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3.5 font-bold font-mono text-slate-900 text-sm">
                    {flight.flightNumber}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-700 font-semibold">
                    {flight.date}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-bold text-slate-900 font-mono">{flight.aircraft}</span>{' '}
                    <span className="text-slate-500 font-mono">({flight.registration})</span>
                  </td>
                  <td className="px-4 py-3.5 font-mono font-bold text-slate-800">
                    {flight.departure} → {flight.arrival}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-700">
                    {flight.std} - {flight.sta}
                  </td>
                  <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                    {flight.blockHours}h
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                      {flight.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-1">
                    <button
                      onClick={() => handleOpenEditModal(flight)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Edit Flight"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteFlight(flight.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Flight"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredFlights.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <Plane className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <div className="font-bold text-slate-700 text-sm">No Flight Monitoring Records Found</div>
                    <p className="text-xs text-slate-400 mt-1">
                      The flight monitoring schedule is currently empty. Use "Add Flight" or "Import CSV Schedule" to enter operational flights.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Flight Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">
                {editingFlight ? 'Edit Flight Details' : 'Add New Flight'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">Flight Number</label>
                  <input
                    type="text"
                    required
                    value={formData.flightNumber}
                    onChange={(e) => setFormData({ ...formData, flightNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Aircraft Fleet</label>
                  <select
                    value={formData.aircraft}
                    onChange={(e) => setFormData({ ...formData, aircraft: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                  >
                    <option value="Q400">Q400</option>
                    <option value="B737">B737</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Aircraft Registration</label>
                  <input
                    type="text"
                    required
                    value={formData.registration}
                    onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Departure Airport (STD)</label>
                  <input
                    type="text"
                    required
                    value={formData.departure}
                    onChange={(e) => setFormData({ ...formData, departure: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Arrival Airport (STA)</label>
                  <input
                    type="text"
                    required
                    value={formData.arrival}
                    onChange={(e) => setFormData({ ...formData, arrival: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">STD (HH:mm)</label>
                  <input
                    type="text"
                    required
                    value={formData.std}
                    onChange={(e) => setFormData({ ...formData, std: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">STA (HH:mm)</label>
                  <input
                    type="text"
                    required
                    value={formData.sta}
                    onChange={(e) => setFormData({ ...formData, sta: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-700 mb-1">Block Hours</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formData.blockHours}
                    onChange={(e) => setFormData({ ...formData, blockHours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                  />
                </div>
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
                  {editingFlight ? 'Update Flight' : 'Create Flight'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Upload Schedule CSV Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Import Flight Schedule CSV</h3>
                  <p className="text-xs text-slate-500 font-mono">Format: Date, Day, Aircraft Type, Flight No, Departure, Arrival, STD, STA, Block</p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center transition-colors bg-slate-50 space-y-3">
              <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">
                  Select your Zambia Airways Commercial Schedule CSV
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supports the official 16-column Commercial Format: <strong>Flight No</strong>, <strong>Aircraft Type</strong>, <strong>Departure Station</strong>, <strong>Arrival Station</strong>, <strong>STD</strong>, <strong>STA</strong>, <strong>Block Time</strong>, <strong>Effective Date</strong>, <strong>Dis Date</strong>, and day columns (<strong>Monday</strong> ... <strong>Sunday</strong>).
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md">
                  <Upload className="w-4 h-4" />
                  <span>Browse Schedule CSV File</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleScheduleCsvUpload}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleLoadOfficialCommercialSchedule}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#F37C1C]" />
                  <span>Load Official Schedule (Apr–Oct)</span>
                </button>
              </div>
            </div>

            {uploadFeedback && (
              <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Schedule Import Completed
                  </span>
                  <span>{uploadFeedback.recordsAdded} Flights Added</span>
                </div>
                <p className="text-slate-300 leading-relaxed">{uploadFeedback.message}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleDownloadScheduleTemplate}
                className="text-xs font-bold text-slate-600 hover:text-[#F37C1C] flex items-center gap-1.5 font-mono"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fleet Management Modal */}
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
