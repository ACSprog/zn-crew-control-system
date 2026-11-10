import React, { useState } from 'react';
import {
  SystemUser,
  SystemUserRole,
  SystemUserPermissions,
} from '../types';
import {
  ShieldCheck,
  UserPlus,
  Users,
  Key,
  CheckCircle2,
  XCircle,
  Edit2,
  Search,
  UserCheck,
  Sliders,
  Sparkles,
  Lock,
  Unlock,
  AlertTriangle,
  Mail,
  Building,
  MapPin,
  Clock,
  ShieldAlert,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
  Copy,
  Terminal,
} from 'lucide-react';

import { PasswordModal } from '../components/PasswordModal';
import { sendPasswordReset } from '../utils/authService';
interface UserAccessViewProps {
  users: SystemUser[];
  currentUser: SystemUser;
  onSelectCurrentUser: (user: SystemUser) => void;
  onUpdateUsers: (updatedUsers: SystemUser[]) => void;
  onDeleteUser?: (userId: string) => void;
}

const ROLE_BADGES: Record<SystemUserRole, { label: string; color: string; bg: string }> = {
  SUPER_ADMIN: {
    label: 'Super Admin / IT',
    color: 'text-red-700',
    bg: 'bg-red-100 border-red-200',
  },
  ADMIN: {
    label: 'System Admin',
    color: 'text-red-700',
    bg: 'bg-red-100 border-red-200',
  },
  OCC_CONTROLLER: {
    label: 'OCC Controller',
    color: 'text-orange-800',
    bg: 'bg-orange-100 border-orange-200',
  },
  SCHEDULER: {
    label: 'Crew Scheduler',
    color: 'text-blue-800',
    bg: 'bg-blue-100 border-blue-200',
  },
  CHIEF_PILOT: {
    label: 'Chief Pilot / Line Mgt',
    color: 'text-purple-800',
    bg: 'bg-purple-100 border-purple-200',
  },
  FLIGHT_CREW: {
    label: 'Flight Crew (Self-Service)',
    color: 'text-emerald-800',
    bg: 'bg-emerald-100 border-emerald-200',
  },
  PILOT_CABIN: {
    label: 'Flight Crew',
    color: 'text-emerald-800',
    bg: 'bg-emerald-100 border-emerald-200',
  },
  AUDITOR: {
    label: 'Safety Auditor (Read-Only)',
    color: 'text-indigo-800',
    bg: 'bg-indigo-100 border-indigo-200',
  },
};

export const UserAccessView: React.FC<UserAccessViewProps> = ({
  users,
  currentUser,
  onSelectCurrentUser,
  onUpdateUsers,
  onDeleteUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [deletingUserConfirm, setDeletingUserConfirm] = useState<SystemUser | null>(null);
  const [authModalTargetUser, setAuthModalTargetUser] = useState<SystemUser | null>(null);

  // Form State for Add/Edit
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSendPasswordReset = async () => {
    if (!editingUser) return;
    setResetStatus('sending');
    try {
      await sendPasswordReset(editingUser.email);
      setResetStatus('sent');
      setTimeout(() => setResetStatus('idle'), 5000);
    } catch (err) {
      console.error('[UserAccessView] Password reset email failed:', err);
      setResetStatus('error');
      setTimeout(() => setResetStatus('idle'), 5000);
    }
  };
  const [formStaffNumber, setFormStaffNumber] = useState('');
  const [formRole, setFormRole] = useState<SystemUserRole>('OCC_CONTROLLER');
  const [formDepartment, setFormDepartment] = useState('Operations Control Center');
  const [formBase, setFormBase] = useState('LUN');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formPermissions, setFormPermissions] = useState<SystemUserPermissions>({
    canEditRoster: true,
    canGenerateRoster: false,
    canManageCrew: true,
    canEditSettings: false,
    canResetData: false,
    canOverrideLegality: false,
    canManageUsers: false,
    canExportAudit: true,
  });

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.staffNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRoleFilter === 'ALL' || u.role === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormStaffNumber(`ZA-USR-${Math.floor(100 + Math.random() * 900)}`);
    setFormRole('OCC_CONTROLLER');
    setFormDepartment('Operations Control Center');
    setFormBase('LUN');
    setFormStatus('ACTIVE');
    setFormPermissions({
      canEditRoster: true,
      canGenerateRoster: false,
      canManageCrew: true,
      canEditSettings: false,
      canResetData: false,
      canOverrideLegality: false,
      canManageUsers: false,
      canExportAudit: true,
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (userToEdit: SystemUser) => {
    setEditingUser(userToEdit);
    setFormName(userToEdit.name);
    setFormEmail(userToEdit.email);
    setFormStaffNumber(userToEdit.staffNumber);
    setFormRole(userToEdit.role);
    setFormDepartment(userToEdit.department);
    setFormBase(userToEdit.base);
    setFormStatus(userToEdit.status === 'SUSPENDED' ? 'INACTIVE' : userToEdit.status);
    setFormPermissions({ ...userToEdit.permissions });
    setIsAddModalOpen(true);
  };

  const handleRoleChange = (newRole: SystemUserRole) => {
    setFormRole(newRole);
    // Set default standard permissions based on role presets
    if (newRole === 'SUPER_ADMIN' || newRole === 'ADMIN') {
      setFormPermissions({
        canEditRoster: true,
        canGenerateRoster: true,
        canManageCrew: true,
        canEditSettings: true,
        canResetData: true,
        canOverrideLegality: true,
        canManageUsers: true,
        canExportAudit: true,
        canApproveRosterEdits: true,
        canViewFullPii: true,
        canManageSecurity: true,
      });
    } else if (newRole === 'SCHEDULER' || newRole === 'OCC_CONTROLLER') {
      setFormPermissions({
        canEditRoster: true,
        canGenerateRoster: true,
        canManageCrew: true,
        canEditSettings: false,
        canResetData: false,
        canOverrideLegality: true,
        canManageUsers: false,
        canExportAudit: true,
        canApproveRosterEdits: false,
        canViewFullPii: true,
        canManageSecurity: false,
      });
    } else if (newRole === 'CHIEF_PILOT') {
      setFormPermissions({
        canEditRoster: false,
        canGenerateRoster: false,
        canManageCrew: false,
        canEditSettings: false,
        canResetData: false,
        canOverrideLegality: true,
        canManageUsers: false,
        canExportAudit: true,
        canApproveRosterEdits: true,
        canViewFullPii: true,
        canManageSecurity: false,
      });
    } else if (newRole === 'FLIGHT_CREW' || newRole === 'PILOT_CABIN') {
      setFormPermissions({
        canEditRoster: false,
        canGenerateRoster: false,
        canManageCrew: false,
        canEditSettings: false,
        canResetData: false,
        canOverrideLegality: false,
        canManageUsers: false,
        canExportAudit: false,
        canApproveRosterEdits: false,
        canViewFullPii: false,
        canManageSecurity: false,
      });
    } else if (newRole === 'AUDITOR') {
      setFormPermissions({
        canEditRoster: false,
        canGenerateRoster: false,
        canManageCrew: false,
        canEditSettings: false,
        canResetData: false,
        canOverrideLegality: false,
        canManageUsers: false,
        canExportAudit: true,
        canApproveRosterEdits: false,
        canViewFullPii: false,
        canManageSecurity: false,
      });
    }
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    const initials = formName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'ZA';

    if (editingUser) {
      // Update existing
      const updated = users.map((u) => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            name: formName,
            email: formEmail,
            staffNumber: formStaffNumber,
            role: formRole,
            department: formDepartment,
            base: formBase,
            status: formStatus,
            avatarInitials: initials,
            permissions: formPermissions,
          };
        }
        return u;
      });
      onUpdateUsers(updated);

      // If current logged-in user was edited, sync
      if (currentUser.id === editingUser.id) {
        const currentUpdated = updated.find((u) => u.id === editingUser.id);
        if (currentUpdated) onSelectCurrentUser(currentUpdated);
      }
    } else {
      // Add new
      const newUser: SystemUser = {
        id: `user-${Date.now()}`,
        staffNumber: formStaffNumber,
        name: formName,
        email: formEmail,
        role: formRole,
        department: formDepartment,
        base: formBase,
        status: formStatus,
        avatarInitials: initials,
        lastLogin: 'Just now',
        permissions: formPermissions,
      };
      onUpdateUsers([...users, newUser]);
    }

    setIsAddModalOpen(false);
  };

  const handleToggleUserStatus = (userToToggle: SystemUser) => {
    const newStatus = userToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = users.map((u) => (u.id === userToToggle.id ? { ...u, status: newStatus } : u));
    onUpdateUsers(updated);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-full">
      {/* Top Banner */}
      <div className="bg-[#2E2C2B] text-white p-6 rounded-xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-[#F37C1C]" />
            <span className="text-xs font-bold text-[#F37C1C] uppercase tracking-widest font-mono">
              Zambia Airways System Security
            </span>
          </div>
          <h1 className="text-xl font-black tracking-tight">User Access & Role-Based Permissions (RBAC)</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Manage system accounts, assign operational roles (Admin, Controller, Scheduler, Crew Viewer, Auditor), and configure granular access rights across the Crew Control System.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          disabled={!currentUser.permissions.canManageUsers}
          className="px-4 py-2 bg-[#F37C1C] hover:bg-[#D96B12] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add System User</span>
        </button>
      </div>

      {/* Permission Warning Banner if non-Admin */}
      {!currentUser.permissions.canManageUsers && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              You are currently logged in as <strong>{currentUser.name}</strong> ({ROLE_BADGES[currentUser.role].label}).
              User management actions are restricted to Administrators. You may switch active user in the top menu to test Admin capabilities.
            </span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Accounts</span>
          <div className="text-2xl font-black text-[#2E2C2B] mt-1">{users.length}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">System Administrators</span>
          <div className="text-2xl font-black text-red-600 mt-1">
            {users.filter((u) => u.role === 'ADMIN').length}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">OCC Duty Officers</span>
          <div className="text-2xl font-black text-orange-600 mt-1">
            {users.filter((u) => u.role === 'OCC_CONTROLLER').length}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Active Users</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {users.filter((u) => u.status === 'ACTIVE').length}
          </div>
        </div>
      </div>

      {/* Active User Quick Switch Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#2E2C2B] text-white font-bold flex items-center justify-center font-mono text-sm shadow-xs shrink-0">
            {currentUser.avatarInitials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">{currentUser.name}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${ROLE_BADGES[currentUser.role].bg} ${ROLE_BADGES[currentUser.role].color}`}>
                {ROLE_BADGES[currentUser.role].label}
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                Active Session
              </span>
            </div>
            <p className="text-[11px] text-slate-500">{currentUser.department} • {currentUser.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-600 font-mono">Switch Session User:</span>
          <select
            value={currentUser.id}
            onChange={(e) => {
              const target = users.find((u) => u.id === e.target.value);
              if (target && target.id !== currentUser.id) {
                setAuthModalTargetUser(target);
              }
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-[#F37C1C]"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                🔒 {u.name} ({ROLE_BADGES[u.role].label})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search name, staff ID or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#F37C1C]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-slate-400 font-bold font-mono uppercase shrink-0">Filter Role:</span>
          {['ALL', 'ADMIN', 'OCC_CONTROLLER', 'SCHEDULER', 'PILOT_CABIN', 'AUDITOR'].map((roleKey) => (
            <button
              key={roleKey}
              onClick={() => setSelectedRoleFilter(roleKey)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedRoleFilter === roleKey
                  ? 'bg-[#F37C1C] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {roleKey === 'ALL' ? 'All Roles' : ROLE_BADGES[roleKey as SystemUserRole]?.label || roleKey}
            </button>
          ))}
        </div>
      </div>

      {/* Users List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase font-mono tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-[#F37C1C]" />
            System User Accounts Directory
          </h2>
          <span className="text-xs text-slate-500 font-mono">Showing {filteredUsers.length} Users</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 font-mono font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="p-3">User & Staff ID</th>
                <th className="p-3">Operational Role</th>
                <th className="p-3">Department & Base</th>
                <th className="p-3">Key Privileges</th>
                <th className="p-3">Account Status</th>
                <th className="p-3">Last Active</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const isSelectedCurrent = u.id === currentUser.id;
                const badge = ROLE_BADGES[u.role];

                return (
                  <tr key={u.id} className={`hover:bg-slate-50/80 transition-colors ${isSelectedCurrent ? 'bg-orange-50/30' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#2E2C2B] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {u.avatarInitials}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {isSelectedCurrent && (
                              <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded">YOU</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.staffNumber} • {u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono border ${badge.bg} ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="font-medium text-slate-800">{u.department}</div>
                      <span className="text-[10px] text-slate-400 font-mono">Base: {u.base}</span>
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {u.permissions.canEditRoster && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-mono font-bold">Roster Edit</span>
                        )}
                        {u.permissions.canGenerateRoster && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[9px] font-mono font-bold">Auto Roster</span>
                        )}
                        {u.permissions.canManageCrew && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-mono font-bold">Crew Admin</span>
                        )}
                        {u.permissions.canEditSettings && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded text-[9px] font-mono font-bold">FTL Rules</span>
                        )}
                        {u.permissions.canManageUsers && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded text-[9px] font-mono font-bold">User Mgmt</span>
                        )}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {u.status}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
                          <Lock className="w-3 h-3 text-[#F37C1C]" />
                          <span>Protected</span>
                        </span>
                      </div>
                    </td>

                    <td className="p-3 text-slate-500 font-mono text-[11px]">
                      {u.lastLogin || 'Never'}
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            if (isSelectedCurrent) return;
                            setAuthModalTargetUser(u);
                          }}
                          disabled={isSelectedCurrent}
                          title={isSelectedCurrent ? 'Active Session User' : 'Unlock and switch active user session'}
                          className="px-2 py-1 bg-slate-100 hover:bg-[#2E2C2B] hover:text-white text-slate-700 disabled:opacity-50 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Lock className="w-3 h-3 text-[#F37C1C]" />
                          <span>{isSelectedCurrent ? 'Active' : 'Switch To'}</span>
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(u)}
                          disabled={!currentUser.permissions.canManageUsers && !isSelectedCurrent}
                          title="Edit User Name, Role, Permissions & Password"
                          className="p-1.5 text-slate-500 hover:text-[#F37C1C] hover:bg-orange-50 rounded transition-colors cursor-pointer disabled:opacity-30"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeletingUserConfirm(u)}
                          disabled={!currentUser.permissions.canManageUsers || isSelectedCurrent || users.length <= 1}
                          title={
                            isSelectedCurrent
                              ? 'Cannot delete active session user'
                              : users.length <= 1
                              ? 'Cannot delete last remaining system account'
                              : 'Delete user account'
                          }
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer disabled:opacity-20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <div className="font-bold text-slate-700 text-sm">No User Accounts Registered</div>
                    <p className="text-xs text-slate-400 mt-1">
                      The user accounts directory is currently empty. Use "+ Add System User" above to create administrator and operational staff accounts.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Access Capability Comparison Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs">
        <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
          <Key className="w-4 h-4 text-[#F37C1C]" />
          Role-Based Access Control (RBAC) Capabilities Matrix
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-mono font-bold uppercase border-y border-slate-200">
              <tr>
                <th className="p-3">System Action / Privilege</th>
                <th className="p-3 text-center text-red-700">Super Admin / IT</th>
                <th className="p-3 text-center text-blue-700">Crew Scheduler</th>
                <th className="p-3 text-center text-purple-700">Chief Pilot / Line Mgt</th>
                <th className="p-3 text-center text-emerald-700">Flight Crew (Self-Service)</th>
                <th className="p-3 text-center text-indigo-700">Safety Auditor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-3 font-bold text-slate-900">View Master Operational Rosters</td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center text-[11px] text-amber-700 font-bold">Own Roster Only</td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-900">Manual Duty Assignment & Roster Editing</td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center text-[11px] text-slate-400 font-bold">Approval Only</td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-900">Run Algorithmic Auto-Scheduler Engine</td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-900">Crew Data & Unmasked PII / Medical Access</td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center text-[11px] text-slate-400 font-bold">Self Only (Masked)</td>
                <td className="p-3 text-center text-[11px] text-slate-400 font-bold">Masked PII</td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-900">Approve Roster Published Changes</td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-900">Configure System FTL Rules & Thresholds</td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-900">Immutable Audit Log & Compliance Hash Chain</td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-900">Manage User Accounts & Access Permissions</td>
                <td className="p-3 text-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
                <td className="p-3 text-center"><XCircle className="w-4 h-4 text-slate-300 mx-auto" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#F37C1C]" />
                {editingUser ? 'Edit User & Access Rights' : 'Create New System User'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Mwansa Tembo"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Company Email *</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. m.tembo@zambiaairways.co.zm"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  />
                </div>

                                <div className="sm:col-span-2">
                  <label className="flex items-center gap-1.5 text-slate-700 mb-1">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Login Credentials</span>
                  </label>

                  {editingUser ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <p className="text-[11px] text-slate-500 font-sans normal-case font-normal leading-relaxed">
                        To change {editingUser.name}'s password, send them a reset link — they'll set a new
                        password themselves. Nobody, including admins, can see or set it directly.
                      </p>
                      <button
                        type="button"
                        onClick={handleSendPasswordReset}
                        disabled={resetStatus === 'sending'}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#2E2C2B] hover:bg-black disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-[#F37C1C]" />
                        <span>
                          {resetStatus === 'sending' ? 'Sending…' : 'Send Password Reset Email'}
                        </span>
                      </button>
                      {resetStatus === 'sent' && (
                        <p className="text-[10px] text-emerald-600 font-sans normal-case">
                          Reset email sent to {editingUser.email}.
                        </p>
                      )}
                      {resetStatus === 'error' && (
                        <p className="text-[10px] text-red-600 font-sans normal-case">
                          Could not send reset email. Check the address is correct and try again.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                      <p className="text-[11px] text-slate-400 font-sans normal-case font-normal leading-relaxed">
                        This form only saves {formName || "this person"}'s directory profile (name, role, department).
                        It does <strong className="text-slate-300">not</strong> create their actual login. To let them
                        sign in, run this command in your terminal (choose a real temporary password, then have them
                        change it on first login):
                      </p>
                      <div className="relative">
                        <pre className="text-[10px] text-emerald-400 font-mono whitespace-pre-wrap break-all bg-black/40 rounded-md p-2.5 pr-9">
{`node scripts/create-user.mjs \\
  --email=${formEmail || 'person@zambiaairways.co.zm'} \\
  --password=CHANGE_ME_TEMP_PASS \\
  --name="${formName || 'Full Name'}" \\
  --role=${formRole} \\
  --department="${formDepartment}" \\
  --staffNumber=${formStaffNumber || 'ZA-XXX'}`}
                        </pre>
                        <button
                          type="button"
                          onClick={() => {
                            const cmd = `node scripts/create-user.mjs --email=${formEmail || 'person@zambiaairways.co.zm'} --password=CHANGE_ME_TEMP_PASS --name="${formName || 'Full Name'}" --role=${formRole} --department="${formDepartment}" --staffNumber=${formStaffNumber || 'ZA-XXX'}`;
                            navigator.clipboard.writeText(cmd);
                            setCopiedCommand(true);
                            setTimeout(() => setCopiedCommand(false), 2000);
                          }}
                          className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Copy command"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {copiedCommand && <p className="text-[10px] text-emerald-400 font-sans normal-case">Copied to clipboard.</p>}
                      <p className="text-[10px] text-slate-500 font-sans normal-case font-normal">
                        Add <code className="text-slate-400">--emulator</code> to target your local test environment
                        instead of live production.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Staff / Employee ID *</label>
                  <input
                    type="text"
                    required
                    value={formStaffNumber}
                    onChange={(e) => setFormStaffNumber(e.target.value)}
                    placeholder="e.g. ZA-ADM-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Operational Role *</label>
                  <select
                    value={formRole}
                    onChange={(e) => handleRoleChange(e.target.value as SystemUserRole)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  >
                    <option value="SUPER_ADMIN">Super Admin / IT (System Configuration & Security)</option>
                    <option value="SCHEDULER">Crew Scheduler / Dispatcher (Full Roster Read/Write)</option>
                    <option value="CHIEF_PILOT">Line Management / Chief Pilot (Department Read-Only & Approvals)</option>
                    <option value="FLIGHT_CREW">Flight Crew (Restricted Individual Self-Service)</option>
                    <option value="AUDITOR">Safety Auditor / Inspector (Read-Only Compliance & History)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="e.g. Flight Operations"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Home Base</label>
                  <select
                    value={formBase}
                    onChange={(e) => setFormBase(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  >
                    <option value="LUN">LUN (Lusaka - KKIA)</option>
                    <option value="NLA">NLA (Ndola - Simon Mwansa Kapwepwe)</option>
                    <option value="LVI">LVI (Livingstone - Harry Mwaanga)</option>
                  </select>
                </div>
              </div>

              {/* Specific Granular Permissions Checkboxes */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-slate-600 uppercase font-mono tracking-wider block mb-1">
                  Granular Privilege Configuration
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-normal">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formPermissions.canEditRoster}
                      onChange={(e) => setFormPermissions({ ...formPermissions, canEditRoster: e.target.checked })}
                      className="rounded text-[#F37C1C]"
                    />
                    <span>Can Edit Roster Assignments</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formPermissions.canGenerateRoster}
                      onChange={(e) => setFormPermissions({ ...formPermissions, canGenerateRoster: e.target.checked })}
                      className="rounded text-[#F37C1C]"
                    />
                    <span>Can Run Auto Scheduler</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formPermissions.canManageCrew}
                      onChange={(e) => setFormPermissions({ ...formPermissions, canManageCrew: e.target.checked })}
                      className="rounded text-[#F37C1C]"
                    />
                    <span>Can Manage Crew Records</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formPermissions.canEditSettings}
                      onChange={(e) => setFormPermissions({ ...formPermissions, canEditSettings: e.target.checked })}
                      className="rounded text-[#F37C1C]"
                    />
                    <span>Can Edit FTL System Rules</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formPermissions.canManageUsers}
                      onChange={(e) => setFormPermissions({ ...formPermissions, canManageUsers: e.target.checked })}
                      className="rounded text-[#F37C1C]"
                    />
                    <span>Can Manage System Users</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formPermissions.canResetData}
                      onChange={(e) => setFormPermissions({ ...formPermissions, canResetData: e.target.checked })}
                      className="rounded text-[#F37C1C]"
                    />
                    <span>Can Reset System Database</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {editingUser && editingUser.id !== currentUser.id && users.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setDeletingUserConfirm(editingUser);
                    }}
                    className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-red-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete User</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#F37C1C] hover:bg-[#D96B12] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    {editingUser ? 'Save User Changes' : 'Create System Account'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUserConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete User Account</h3>
                <p className="text-xs text-slate-500 font-mono">Irreversible Security Action</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              Are you sure you want to permanently delete the account for <strong>{deletingUserConfirm.name}</strong> ({deletingUserConfirm.staffNumber}) with role <strong>{ROLE_BADGES[deletingUserConfirm.role].label}</strong>?
            </p>

            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-[11px] text-red-800">
              ⚠️ This user will no longer be able to log in or access Zambia Airways Crew Control System.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUserConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteUser) {
                    onDeleteUser(deletingUserConfirm.id);
                  } else {
                    const updated = users.filter((u) => u.id !== deletingUserConfirm.id);
                    onUpdateUsers(updated);
                  }
                  setDeletingUserConfirm(null);
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Password Unlock Modal */}
      <PasswordModal
        isOpen={!!authModalTargetUser}
        targetUser={authModalTargetUser}
        onClose={() => setAuthModalTargetUser(null)}
        onSuccess={(authenticatedUser) => {
          onSelectCurrentUser(authenticatedUser);
          setAuthModalTargetUser(null);
        }}
      />
    </div>
  );
};
