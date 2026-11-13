import React, { useEffect, useState } from 'react';
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
  ShieldOff,
  Smartphone,
  FlaskConical,
  Ban,
  CircleCheck,
  Loader2,
  LockOpen,
} from 'lucide-react';

import { PasswordModal } from '../components/PasswordModal';
import {
  addAccount,
  assignableRoles,
  canManageAccount,
  canManageUsers,
  cancelSuperAdminAction,
  describePendingAction,
  enableRequire2fa,
  getRequire2fa,
  loadSignInLocks,
  needsConfirmation,
  removeAccount,
  requestSuperAdminAction,
  reset2faCommand,
  sendAccountPasswordReset,
  setAccountBlocked,
  setAccountTwoFactor,
  updateAccount,
  updateOwnProfile,
  type AddAccountResult,
} from '../utils/accounts';
import type { PendingAdminAction } from '../utils/authService';
import { DEFAULT_TEST_DOMAIN, getTestModeSettings, removeAllTestAccounts, setTestMode } from '../utils/testMode';

/** Account fields stored on users/{uid} that aren't part of the SystemUser type. */
type AccountRow = SystemUser & {
  twoFactor?: 'on' | 'off';
  twoFactorEnrolled?: boolean;
  mustChangePassword?: boolean;
  pendingAction?: PendingAdminAction;
  testAccount?: boolean;
};
interface UserAccessViewProps {
  users: SystemUser[];
  currentUser: SystemUser;
  onSelectCurrentUser: (user: SystemUser) => void;
  onUpdateUsers: (updatedUsers: SystemUser[]) => void;
  onDeleteUser?: (userId: string) => void;
  /** Record an account change in the audit log and show a message */
  onAccountAction?: (message: string, audit?: { action: string; details: string; severity?: 'INFO' | 'WARNING' | 'CRITICAL' }) => void;
}

const ROLE_OPTION_TEXT: Record<SystemUserRole, string> = {
  SUPER_ADMIN: 'Super Admin / IT (System Configuration & Security)',
  ADMIN: 'System Admin (Manages users below Admin)',
  OCC_CONTROLLER: 'OCC Controller / Duty Officer (Roster Read/Write & Overrides)',
  SCHEDULER: 'Crew Scheduler / Dispatcher (Full Roster Read/Write)',
  CHIEF_PILOT: 'Line Management / Chief Pilot (Department Read-Only & Approvals)',
  FLIGHT_CREW: 'Flight Crew (Restricted Individual Self-Service)',
  PILOT_CABIN: 'Flight Crew – Pilot / Cabin (Own Roster Only)',
  AUDITOR: 'Safety Auditor / Inspector (Read-Only Compliance & History)',
};

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
  onAccountAction,
}) => {
  const iManageUsers = canManageUsers(currentUser);
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
  const [locks, setLocks] = useState<Record<string, { failures: number; locked: boolean }>>({});
  const [require2faAll, setRequire2faAll] = useState(false);
  const [securityMsg, setSecurityMsg] = useState<string | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<(AddAccountResult & { email: string; name: string }) | null>(null);
  const [copiedTemp, setCopiedTemp] = useState(false);

  const notify = (message: string, action?: string, details?: string, severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO') =>
    onAccountAction?.(message, action ? { action, details: details || message, severity } : undefined);

  // Wrong-password lock status and the "2FA for everyone" setting
  const emailsKey = users.map((u) => u.email).join('|');
  useEffect(() => {
    if (!iManageUsers) return;
    loadSignInLocks(users.map((u) => u.email)).then(setLocks);
    getRequire2fa().then(setRequire2faAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailsKey, iManageUsers]);

  const lockOf = (u: SystemUser) => locks[(u.email || '').toLowerCase()];

  // ---- Test Mode (testers create their own accounts) ----
  const [testModeOn, setTestModeOn] = useState(false);
  const [testDomain, setTestDomain] = useState(DEFAULT_TEST_DOMAIN);
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const testAccounts = users.filter((u) => (u as AccountRow).testAccount === true);
  useEffect(() => {
    getTestModeSettings().then((t) => {
      setTestModeOn(t.testMode);
      setTestDomain(t.testSignupDomain);
    });
  }, []);

  const handleTestMode = async (on: boolean) => {
    if (
      on &&
      !window.confirm(
        `Turn on Test Mode?\n\nAnyone with ${testDomain ? `an @${testDomain}` : 'ANY'} email address can then create their own Crew Control account (not an admin role) from the sign-in page.`
      )
    )
      return;
    setTestBusy(true);
    setTestMsg(null);
    try {
      await setTestMode(on, testDomain, currentUser.email);
      setTestModeOn(on);
      setTestMsg({
        kind: 'ok',
        text: on
          ? `Test Mode is on. Testers can use "Create a test account" on the sign-in page.`
          : 'Test Mode is off. No new test accounts can be created; existing ones still work until removed.',
      });
      notify(
        on ? 'Test Mode switched on.' : 'Test Mode switched off.',
        on ? 'Test Mode On' : 'Test Mode Off',
        `${currentUser.name} switched Test Mode ${on ? `on (sign-up domain: ${testDomain || 'any'})` : 'off'}.`,
        'WARNING'
      );
    } catch (e) {
      setTestMsg({ kind: 'error', text: (e as Error).message });
    } finally {
      setTestBusy(false);
    }
  };

  const handleRemoveTestAccounts = async () => {
    if (!window.confirm(`Remove Crew Control access for all ${testAccounts.length} test account(s)?`)) return;
    setTestBusy(true);
    setTestMsg(null);
    try {
      const n = await removeAllTestAccounts(users as AccountRow[], currentUser.id);
      setTestMsg({ kind: 'ok', text: `Removed access for ${n} test account(s).` });
      notify(`Removed ${n} test account(s).`, 'Test Accounts Removed', `${currentUser.name} removed ${n} self-registered test account(s).`, 'WARNING');
    } catch (e) {
      setTestMsg({ kind: 'error', text: (e as Error).message });
    } finally {
      setTestBusy(false);
    }
  };

  const twoFactorBadge = (u: AccountRow) => {
    const required = u.twoFactor === 'on' || (require2faAll && u.twoFactor !== 'off');
    if (u.twoFactorEnrolled) return { label: '2FA ON', cls: 'bg-emerald-100 text-emerald-800' };
    if (required) return { label: '2FA SET-UP PENDING', cls: 'bg-amber-100 text-amber-800' };
    return { label: '2FA OFF', cls: 'bg-slate-100 text-slate-500' };
  };

  const runAccountAction = async (fn: () => Promise<void>) => {
    setAccountBusy(true);
    setAccountError(null);
    setAccountInfo(null);
    try {
      await fn();
    } catch (e) {
      setAccountError((e as Error).message);
    } finally {
      setAccountBusy(false);
    }
  };
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

  // ---- Row actions (same buttons as the QSA Reporting System) ----
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [listNotice, setListNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [resetFor, setResetFor] = useState<AccountRow | null>(null);
  const [resetCopied, setResetCopied] = useState(false);

  const twoFactorOn = (u: AccountRow) =>
    u.twoFactorEnrolled === true || u.twoFactor === 'on' || (require2faAll && u.twoFactor !== 'off');

  const runRowAction = async (u: SystemUser, fn: () => Promise<void>) => {
    setBusyRowId(u.id);
    setListNotice(null);
    try {
      await fn();
    } catch (e) {
      setListNotice({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusyRowId(null);
    }
  };

  const rowSendReset = (u: SystemUser) => {
    const locked = lockOf(u)?.locked;
    if (
      !window.confirm(
        locked
          ? `Unlock ${u.name} and email ${u.email} a link to set a new password?`
          : `Email ${u.email} a link to set a new password?`
      )
    )
      return;
    runRowAction(u, async () => {
      const wasLocked = await sendAccountPasswordReset(u.email);
      if (wasLocked) {
        setLocks((l) => {
          const next = { ...l };
          delete next[u.email.toLowerCase()];
          return next;
        });
      }
      setListNotice({
        kind: 'ok',
        text: wasLocked
          ? `${u.name} is unlocked and a password reset email was sent to ${u.email}. It comes from Firebase and may land in spam.`
          : `Password reset email sent to ${u.email}. It comes from Firebase and may land in spam.`,
      });
      notify(
        wasLocked ? `Unlocked ${u.name}.` : `Reset email sent to ${u.email}.`,
        wasLocked ? 'Account Unlocked' : 'Password Reset Sent',
        `${currentUser.name} ${wasLocked ? 'unlocked and ' : ''}sent a password reset email to ${u.email}.`
      );
    });
  };

  const rowTwoFactor = (u: AccountRow) => {
    const mode: 'on' | 'off' = twoFactorOn(u) ? 'off' : 'on';
    if (
      !window.confirm(
        mode === 'off'
          ? `Stop 2FA for ${u.name}?\n\nThey will sign in with just their password. If they already use an authenticator app, it is asked for one last time at their next sign-in and then removed.\n\nIf their phone is lost they can't give that last code: use "Reset 2FA" instead.`
          : `Start 2FA for ${u.name}?\n\nThey will be asked to set up an authenticator app (Google or Microsoft Authenticator) straight away, or at their next sign-in, and then enter its code every time they sign in.`
      )
    )
      return;
    runRowAction(u, async () => {
      await setAccountTwoFactor(u, mode);
      setListNotice({
        kind: 'ok',
        text:
          mode === 'off'
            ? `2FA stopped for ${u.name}. Only their account is affected.`
            : `2FA started for ${u.name}. They set up their authenticator app at their next sign-in.`,
      });
      notify(
        mode === 'on' ? `2FA started for ${u.name}.` : `2FA stopped for ${u.name}.`,
        mode === 'on' ? '2FA Started For User' : '2FA Stopped For User',
        `${currentUser.name} ${mode === 'on' ? 'required' : 'switched off'} two-step sign-in for ${u.email}.`,
        'WARNING'
      );
    });
  };

  const rowBlock = (u: AccountRow) => {
    const block = u.status === 'ACTIVE';
    const superTarget = block && needsConfirmation(u);
    if (
      !window.confirm(
        !block
          ? `Unblock ${u.name}? They will be able to sign in again as ${ROLE_BADGES[u.role].label}.`
          : superTarget
            ? `${u.name} is a Super Admin. Send them a request to approve being blocked?`
            : `Block ${u.name}? They are signed out immediately and can't sign in until unblocked.`
      )
    )
      return;
    runRowAction(u, async () => {
      if (superTarget) {
        await requestSuperAdminAction(u, 'block', undefined, { uid: currentUser.id, email: currentUser.email });
        setListNotice({ kind: 'ok', text: `Request sent. ${u.name} must approve being blocked.` });
        notify(`Request sent to ${u.name}.`, 'Super Admin Change Requested', `${currentUser.name} asked ${u.email} to approve being blocked.`, 'WARNING');
        return;
      }
      await setAccountBlocked(u, block);
      setListNotice({ kind: 'ok', text: block ? `${u.name} is blocked.` : `${u.name} is unblocked.` });
      notify(
        block ? `${u.name} is blocked.` : `${u.name} is unblocked.`,
        block ? 'User Blocked' : 'User Unblocked',
        `${currentUser.name} ${block ? 'blocked' : 'unblocked'} ${u.email}.`,
        'WARNING'
      );
    });
  };

  const handleSendPasswordReset = async () => {
    if (!editingUser) return;
    setResetStatus('sending');
    try {
      const wasLocked = await sendAccountPasswordReset(editingUser.email);
      setResetStatus('sent');
      if (wasLocked) setLocks((l) => {
        const next = { ...l };
        delete next[editingUser.email.toLowerCase()];
        return next;
      });
      notify(
        wasLocked ? `Unlocked ${editingUser.name} and sent a password reset email.` : `Password reset email sent to ${editingUser.email}.`,
        wasLocked ? 'Account Unlocked' : 'Password Reset Sent',
        `${currentUser.name} ${wasLocked ? 'unlocked and ' : ''}sent a password reset email to ${editingUser.email}.`
      );
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
    setCreatedResult(null);
    setAccountError(null);
    setAccountInfo(null);
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
    setCreatedResult(null);
    setAccountError(null);
    setAccountInfo(null);
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

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingUser) {
      const isSelf = editingUser.id === currentUser.id;
      await runAccountAction(async () => {
        if (isSelf) {
          // Own account: display details only (role/status/2FA are changed by another admin)
          const isCrewLogin = editingUser.role === 'FLIGHT_CREW' || editingUser.role === 'PILOT_CABIN';
          await updateOwnProfile(editingUser.id, {
            name: formName,
            department: formDepartment,
            base: formBase,
            ...(isCrewLogin ? {} : { staffNumber: formStaffNumber }),
          });
          notify('Your profile was updated.', 'Profile Updated', `${currentUser.name} updated their own profile details.`);
          setIsAddModalOpen(false);
          return;
        }
        if (!canManageAccount(currentUser, editingUser)) {
          throw new Error('You can only manage accounts below your own level.');
        }
        await updateAccount(editingUser, {
          name: formName,
          staffNumber: formStaffNumber,
          department: formDepartment,
          base: formBase,
          role: formRole,
          permissions: formPermissions,
        });
        if (needsConfirmation(editingUser) && formRole !== editingUser.role) {
          await requestSuperAdminAction(editingUser, 'role', formRole, { uid: currentUser.id, email: currentUser.email });
          notify(
            `Request sent: ${editingUser.name} must approve changing their role.`,
            'Super Admin Change Requested',
            `${currentUser.name} asked ${editingUser.email} to approve a role change to ${formRole}.`,
            'WARNING'
          );
        } else {
          notify(
            `Saved ${formName}'s account.`,
            'User Account Updated',
            `${currentUser.name} updated ${editingUser.email}: role ${formRole}.`,
            formRole !== editingUser.role ? 'WARNING' : 'INFO'
          );
        }
        setIsAddModalOpen(false);
      });
      return;
    }

    // New account: real login with a temporary password + profile + welcome email
    await runAccountAction(async () => {
      const result = await addAccount(
        {
          name: formName,
          email: formEmail,
          staffNumber: formStaffNumber,
          role: formRole,
          department: formDepartment,
          base: formBase,
          permissions: formPermissions,
        },
        currentUser.email || currentUser.name
      );
      setCreatedResult({ ...result, email: formEmail.trim().toLowerCase(), name: formName });
      notify(
        `Created ${formName}'s login.`,
        'User Account Created',
        `${currentUser.name} created ${formEmail} with role ${formRole}.`,
        'WARNING'
      );
    });
  };

  const handleBlockToggle = async (target: AccountRow) => {
    const block = target.status === 'ACTIVE';
    await runAccountAction(async () => {
      if (block && needsConfirmation(target)) {
        await requestSuperAdminAction(target, 'block', undefined, { uid: currentUser.id, email: currentUser.email });
        setAccountInfo(`Request sent. ${target.name} must approve being blocked.`);
        notify(`Request sent to ${target.name}.`, 'Super Admin Change Requested', `${currentUser.name} asked ${target.email} to approve being blocked.`, 'WARNING');
        return;
      }
      await setAccountBlocked(target, block);
      setFormStatus(block ? 'INACTIVE' : 'ACTIVE');
      setEditingUser({ ...target, status: block ? 'INACTIVE' : 'ACTIVE' });
      notify(
        block ? `${target.name} is blocked.` : `${target.name} is unblocked.`,
        block ? 'User Blocked' : 'User Unblocked',
        `${currentUser.name} ${block ? 'blocked' : 'unblocked'} ${target.email}.`,
        'WARNING'
      );
    });
  };

  const handleTwoFactor = async (target: AccountRow, mode: 'on' | 'off') => {
    await runAccountAction(async () => {
      await setAccountTwoFactor(target, mode);
      setEditingUser({ ...(target as SystemUser), twoFactor: mode } as SystemUser);
      setAccountInfo(
        mode === 'on'
          ? `${target.name} must set up an authenticator app at their next sign-in (straight away if signed in now).`
          : `${target.name} will sign in with just their password. If they had an authenticator app, it is asked once more and then removed.`
      );
      notify(
        mode === 'on' ? `2FA started for ${target.name}.` : `2FA stopped for ${target.name}.`,
        mode === 'on' ? '2FA Started For User' : '2FA Stopped For User',
        `${currentUser.name} ${mode === 'on' ? 'required' : 'switched off'} two-step sign-in for ${target.email}.`,
        'WARNING'
      );
    });
  };

  const handleWithdrawRequest = async (target: AccountRow) => {
    await runAccountAction(async () => {
      await cancelSuperAdminAction(target);
      setEditingUser({ ...(target as SystemUser), pendingAction: undefined } as SystemUser);
      setAccountInfo('Request withdrawn.');
    });
  };

  const handleRequire2faAll = async () => {
    setSecurityMsg(null);
    try {
      await enableRequire2fa(currentUser.email);
      setRequire2faAll(true);
      notify('2FA is now required for everyone.', '2FA Required For Everyone', `${currentUser.name} required two-step sign-in for all users.`, 'CRITICAL');
    } catch (e) {
      setSecurityMsg((e as Error).message);
    }
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
          disabled={!iManageUsers}
          className="px-4 py-2 bg-[#F37C1C] hover:bg-[#D96B12] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-xs shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add System User</span>
        </button>
      </div>

      {/* Permission Warning Banner if non-Admin */}
      {!iManageUsers && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              You are currently logged in as <strong>{currentUser.name}</strong> ({ROLE_BADGES[currentUser.role].label}).
              User management actions are restricted to System Admins and Super Admins.
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

      {/* Two-step sign-in for everyone (Super Admins) */}
      {isSuperAdmin && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2E2C2B] text-[#F37C1C] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                Two-Step Sign-In (2FA) for Everyone
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    require2faAll ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {require2faAll ? 'REQUIRED' : 'NOT REQUIRED'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-2xl">
                {require2faAll
                  ? 'Every user must sign in with an authenticator-app code. Exceptions can be made per person (edit the user).'
                  : 'Turn this on after you have set up 2FA on your own account and signed in with your code. Per-person 2FA can be started from each user.'}
              </p>
              {securityMsg && <p className="text-[11px] text-red-700 mt-1">{securityMsg}</p>}
            </div>
          </div>
          {!require2faAll && (
            <button
              onClick={handleRequire2faAll}
              className="px-4 py-2 bg-[#2E2C2B] hover:bg-black text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 shrink-0"
            >
              <Lock className="w-3.5 h-3.5 text-[#F37C1C]" />
              <span>Require 2FA for Everyone</span>
            </button>
          )}
        </div>
      )}

      {/* Test Mode (Super Admins) */}
      {isSuperAdmin && (
        <div
          className={`p-4 rounded-xl border shadow-2xs flex flex-col gap-3 ${
            testModeOn ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2E2C2B] text-[#F37C1C] flex items-center justify-center shrink-0">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  Test Mode — Testers Create Their Own Accounts
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      testModeOn ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {testModeOn ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-2xl">
                  While on, the sign-in page shows "Create a test account". Testers choose a non-admin role; their accounts get a
                  TEST badge. Switch it off before going live and remove the test accounts.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {!testModeOn && (
                <div className="flex items-center gap-1 text-[11px] text-slate-600">
                  <span className="font-bold">Allowed email domain:</span>
                  <input
                    value={testDomain}
                    onChange={(e) => setTestDomain(e.target.value)}
                    placeholder="any email"
                    className="px-2 py-1.5 w-44 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#F37C1C]"
                  />
                </div>
              )}
              <button
                onClick={() => handleTestMode(!testModeOn)}
                disabled={testBusy}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-60 ${
                  testModeOn ? 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-800' : 'bg-[#2E2C2B] hover:bg-black text-white'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5 text-[#F37C1C]" />
                <span>{testModeOn ? 'Turn Test Mode Off' : 'Turn Test Mode On'}</span>
              </button>
              {testAccounts.length > 0 && (
                <button
                  onClick={handleRemoveTestAccounts}
                  disabled={testBusy}
                  className="px-3 py-2 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-50 text-red-700 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove all {testAccounts.length} test account(s)</span>
                </button>
              )}
            </div>
          </div>
          {testModeOn && (
            <p className="text-[11px] text-amber-900">
              Sign-up allowed for: <strong>{testDomain ? `@${testDomain}` : 'any email address'}</strong>. Test accounts so far:{' '}
              <strong>{testAccounts.length}</strong>.
            </p>
          )}
          {testMsg && (
            <p className={`text-[11px] ${testMsg.kind === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>{testMsg.text}</p>
          )}
        </div>
      )}

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

      {/* Result of the last row action */}
      {listNotice && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
            listNotice.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{listNotice.text}</span>
          <button onClick={() => setListNotice(null)} className="font-bold opacity-60 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Reset 2FA instructions (lost / new phone) */}
      {resetFor && (
        <div className="p-4 rounded-xl border border-slate-300 bg-white text-xs text-slate-700 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <strong className="flex items-center gap-1.5">
              <ShieldOff className="w-4 h-4 text-slate-500" /> Reset 2FA for {resetFor.email}
            </strong>
            <button onClick={() => setResetFor(null)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer">
              Close
            </button>
          </div>
          <p>
            On the free Firebase plan the browser isn't allowed to remove someone else's authenticator, so this step is run
            from a computer with the project code and the Firebase CLI, signed in with the Google account that owns the
            Firebase project. In the project folder, run:
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <code className="px-2.5 py-1.5 rounded bg-slate-900 text-emerald-400 font-mono">{reset2faCommand(resetFor.email)}</code>
            <button
              onClick={() =>
                navigator.clipboard
                  ?.writeText(reset2faCommand(resetFor.email))
                  .then(() => setResetCopied(true))
                  .catch(() => undefined)
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 font-bold cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" /> {resetCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-slate-500">
            They then set up 2FA again at their next sign-in (if 2FA is required for them) or from their name → Two-Step
            Sign-In.
          </p>
        </div>
      )}

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
                            {(u as AccountRow).testAccount && (
                              <span className="text-[9px] bg-amber-500 text-white font-bold px-1.5 py-0.2 rounded">TEST</span>
                            )}
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
                        {(() => {
                          const tf = twoFactorBadge(u as AccountRow);
                          return (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${tf.cls}`}>
                              <Lock className="w-3 h-3 text-[#F37C1C]" />
                              <span>{tf.label}</span>
                            </span>
                          );
                        })()}
                        {lockOf(u)?.locked && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-red-100 text-red-800">
                            LOCKED (5 WRONG PASSWORDS)
                          </span>
                        )}
                        {!lockOf(u)?.locked && (lockOf(u)?.failures || 0) > 0 && (
                          <span className="text-[9px] text-amber-700 font-mono">{lockOf(u)?.failures} wrong password(s)</span>
                        )}
                        {(u as AccountRow).pendingAction && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-800">
                            AWAITING THEIR APPROVAL
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 text-slate-500 font-mono text-[11px]">
                      {u.lastLogin || 'Never'}
                    </td>

                    <td className="p-3 text-right min-w-[22rem]">
                      {(() => {
                        const acc = u as AccountRow;
                        const busy = busyRowId === u.id;
                        const canAct = canManageAccount(currentUser, u);
                        const locked = !!lockOf(u)?.locked;
                        const lockedReason = isSelectedCurrent
                          ? 'You cannot change your own account'
                          : 'Only Super Admins can manage this account';
                        return (
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {iManageUsers && (
                              <button
                                onClick={() => rowSendReset(u)}
                                disabled={busy || !u.email}
                                title={
                                  !u.email
                                    ? 'No email on record'
                                    : locked
                                      ? 'Unlock the account and email them a link to set a new password'
                                      : 'Email this user a link to set a new password'
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                                  locked
                                    ? 'border-red-300 bg-red-50 hover:bg-red-100 text-red-800'
                                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                {busy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : locked ? (
                                  <LockOpen className="w-3.5 h-3.5" />
                                ) : (
                                  <Mail className="w-3.5 h-3.5" />
                                )}
                                {locked ? 'Unlock & send password reset mail' : 'Send password reset mail'}
                              </button>
                            )}

                            {isSuperAdmin && (
                              <button
                                onClick={() => rowTwoFactor(acc)}
                                disabled={busy || isSelectedCurrent}
                                title={
                                  isSelectedCurrent
                                    ? 'You cannot change your own 2FA. Another Super Admin can.'
                                    : twoFactorOn(acc)
                                      ? 'Stop two-step sign-in for this user only'
                                      : 'Require two-step sign-in for this user only'
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                                  twoFactorOn(acc)
                                    ? 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                    : 'border-emerald-200 hover:bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {twoFactorOn(acc) ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                {twoFactorOn(acc) ? 'Stop 2FA' : 'Start 2FA'}
                              </button>
                            )}

                            {isSuperAdmin && (
                              <button
                                onClick={() => {
                                  setResetFor(acc);
                                  setResetCopied(false);
                                }}
                                disabled={!u.email}
                                title="Remove this user's authenticator app (lost or new phone) so they can set it up again"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors cursor-pointer disabled:opacity-40"
                              >
                                <Smartphone className="w-3.5 h-3.5" />
                                Reset 2FA
                              </button>
                            )}

                            {iManageUsers && (
                              <button
                                onClick={() => rowBlock(acc)}
                                disabled={busy || !canAct || !!acc.pendingAction}
                                title={
                                  !canAct
                                    ? lockedReason
                                    : acc.pendingAction
                                      ? 'A request is already waiting for their approval'
                                      : u.status !== 'ACTIVE'
                                        ? 'Let this user sign in again'
                                        : 'Stop this user signing in (can be undone)'
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                                  u.status !== 'ACTIVE'
                                    ? 'border-emerald-200 hover:bg-emerald-50 text-emerald-700'
                                    : 'border-amber-200 hover:bg-amber-50 text-amber-700'
                                }`}
                              >
                                {u.status !== 'ACTIVE' ? <CircleCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                                {u.status !== 'ACTIVE' ? 'Unblock' : 'Block'}
                              </button>
                            )}

                            {iManageUsers && (
                              <button
                                onClick={() => {
                                  setAccountError(null);
                                  setDeletingUserConfirm(u);
                                }}
                                disabled={busy || !canAct || users.length <= 1}
                                title={canAct ? 'Remove Crew Control access (for people who have left)' : lockedReason}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-xs font-bold text-red-700 transition-colors cursor-pointer disabled:opacity-40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenEditModal(u)}
                              disabled={!canAct && !isSelectedCurrent}
                              title="Edit User Name, Role, Permissions & Password"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-orange-50 hover:text-[#F37C1C] text-xs font-bold text-slate-700 transition-colors cursor-pointer disabled:opacity-40"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </button>

                            <button
                              onClick={() => {
                                if (isSelectedCurrent) return;
                                setAuthModalTargetUser(u);
                              }}
                              disabled={isSelectedCurrent}
                              title={isSelectedCurrent ? 'Active Session User' : 'Preview the system as this user (display only)'}
                              className="px-2 py-1.5 bg-slate-100 hover:bg-[#2E2C2B] hover:text-white text-slate-700 disabled:opacity-50 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Lock className="w-3 h-3 text-[#F37C1C]" />
                              <span>{isSelectedCurrent ? 'Active' : 'Switch To'}</span>
                            </button>
                          </div>
                        );
                      })()}
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

            {createdResult ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>
                    <strong>{createdResult.name}</strong>'s login ({createdResult.email}) has been created.{' '}
                    {createdResult.emailVia === 'outlook'
                      ? 'Their login details were emailed from the company mailbox.'
                      : createdResult.emailVia === 'firebase'
                        ? 'Firebase emailed them a link to set their own password.'
                        : 'No email could be sent — give them the temporary password below in person.'}
                  </span>
                </div>
                {createdResult.emailError && createdResult.emailVia !== 'outlook' && (
                  <p className="text-[11px] text-amber-700">Company mailbox not used: {createdResult.emailError}</p>
                )}
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1.5">
                  <p className="text-[11px] text-slate-400">Temporary password (shown once — only share it with {createdResult.name}):</p>
                  <div className="relative">
                    <pre className="text-sm text-emerald-400 font-mono bg-black/40 rounded-md p-2.5 pr-9">{createdResult.tempPassword}</pre>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(createdResult.tempPassword);
                        setCopiedTemp(true);
                        setTimeout(() => setCopiedTemp(false), 2000);
                      }}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {copiedTemp && <p className="text-[10px] text-emerald-400">Copied.</p>}
                  <p className="text-[10px] text-slate-500">They must choose their own password when they first sign in.</p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedResult(null);
                      setIsAddModalOpen(false);
                    }}
                    className="px-5 py-2 bg-[#F37C1C] hover:bg-[#D96B12] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
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
                    readOnly={!!editingUser}
                    title={editingUser ? 'The sign-in email of an existing login cannot be changed here' : undefined}
                    placeholder="e.g. m.tembo@zambiaairways.co.zm"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C] read-only:bg-slate-100"
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
                      {lockOf(editingUser)?.locked && (
                        <p className="text-[10px] text-red-700 font-sans normal-case font-bold">
                          This account is LOCKED after 5 wrong passwords. Sending the reset email also unlocks it.
                        </p>
                      )}
                      {(editingUser as AccountRow).mustChangePassword && (
                        <p className="text-[10px] text-amber-700 font-sans normal-case">
                          Still using the temporary password from their welcome email.
                        </p>
                      )}

                      {/* Account access & two-step sign-in */}
                      {editingUser.id !== currentUser.id && canManageAccount(currentUser, editingUser) && (
                        <div className="pt-2 mt-1 border-t border-slate-200 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {(() => {
                              const tf = twoFactorBadge(editingUser as AccountRow);
                              return <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${tf.cls}`}>{tf.label}</span>;
                            })()}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                editingUser.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {editingUser.status === 'ACTIVE' ? 'ACCESS ACTIVE' : 'BLOCKED'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={accountBusy || !!(editingUser as AccountRow).pendingAction}
                              onClick={() => handleBlockToggle(editingUser as AccountRow)}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {editingUser.status === 'ACTIVE' ? <Lock className="w-3.5 h-3.5 text-red-600" /> : <Unlock className="w-3.5 h-3.5 text-emerald-600" />}
                              <span>
                                {editingUser.status === 'ACTIVE'
                                  ? needsConfirmation(editingUser)
                                    ? 'Request Block'
                                    : 'Block Access'
                                  : 'Unblock Access'}
                              </span>
                            </button>

                            {isSuperAdmin && (
                              <button
                                type="button"
                                disabled={accountBusy}
                                onClick={() =>
                                  handleTwoFactor(
                                    editingUser as AccountRow,
                                    (editingUser as AccountRow).twoFactor === 'on' ||
                                      (require2faAll && (editingUser as AccountRow).twoFactor !== 'off') ||
                                      (editingUser as AccountRow).twoFactorEnrolled
                                      ? 'off'
                                      : 'on'
                                  )
                                }
                                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-[#F37C1C]" />
                                <span>
                                  {(editingUser as AccountRow).twoFactor === 'on' ||
                                  (require2faAll && (editingUser as AccountRow).twoFactor !== 'off') ||
                                  (editingUser as AccountRow).twoFactorEnrolled
                                    ? 'Stop 2FA'
                                    : 'Start 2FA'}
                                </span>
                              </button>
                            )}
                          </div>

                          {isSuperAdmin && (editingUser as AccountRow).twoFactorEnrolled && (
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-500 font-sans normal-case font-normal">
                                Lost or replaced phone? The project owner runs this in the project folder, then the user sets
                                2FA up again at next sign-in:
                              </p>
                              <div className="relative">
                                <pre className="text-[10px] text-emerald-400 font-mono whitespace-pre-wrap break-all bg-slate-900 rounded-md p-2 pr-8">
                                  {reset2faCommand(editingUser.email)}
                                </pre>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(reset2faCommand(editingUser.email));
                                    setCopiedCommand(true);
                                    setTimeout(() => setCopiedCommand(false), 2000);
                                  }}
                                  className="absolute top-1.5 right-1.5 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                  title="Copy command"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {copiedCommand && <p className="text-[10px] text-emerald-600 font-sans normal-case">Copied.</p>}
                            </div>
                          )}

                          {(editingUser as AccountRow).pendingAction && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900 font-sans normal-case font-normal flex items-center justify-between gap-2">
                              <span>
                                Waiting for {editingUser.name} to approve: {describePendingAction((editingUser as AccountRow).pendingAction!)} (asked by{' '}
                                {(editingUser as AccountRow).pendingAction!.requestedByEmail}).
                              </span>
                              {(editingUser as AccountRow).pendingAction!.requestedBy === currentUser.id && (
                                <button
                                  type="button"
                                  onClick={() => handleWithdrawRequest(editingUser as AccountRow)}
                                  className="px-2 py-1 bg-white border border-amber-300 rounded font-bold shrink-0"
                                >
                                  Withdraw
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                      <p className="text-[11px] text-slate-400 font-sans normal-case font-normal leading-relaxed">
                        Creating the account also creates {formName || 'this person'}'s <strong className="text-slate-300">login</strong>{' '}
                        with a random temporary password. It is emailed to them from the company mailbox (Power Automate
                        gateway) or, if that isn't set up, Firebase emails them a link to set their own password. They must
                        choose their own password at first sign-in.
                      </p>
                      <p className="text-[10px] text-slate-500 font-sans normal-case font-normal">
                        Two-step sign-in (2FA) follows the "2FA for everyone" setting; you can start it for one person after
                        creating the account.
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
                    readOnly={
                      !!editingUser &&
                      editingUser.id === currentUser.id &&
                      (editingUser.role === 'FLIGHT_CREW' || editingUser.role === 'PILOT_CABIN')
                    }
                    placeholder="e.g. ZA-ADM-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">Operational Role *</label>
                  <select
                    value={formRole}
                    onChange={(e) => handleRoleChange(e.target.value as SystemUserRole)}
                    disabled={!!editingUser && (editingUser.id === currentUser.id || !canManageAccount(currentUser, editingUser))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#F37C1C] disabled:bg-slate-100"
                  >
                    {Array.from(new Set<SystemUserRole>([...(editingUser ? [editingUser.role] : []), ...assignableRoles(currentUser.role)])).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_OPTION_TEXT[r]}
                      </option>
                    ))}
                  </select>
                  {editingUser && editingUser.id === currentUser.id && (
                    <p className="text-[10px] text-slate-500 mt-1 font-normal">
                      You can't change your own role. Another {editingUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'System Admin'} can.
                    </p>
                  )}
                  {editingUser && needsConfirmation(editingUser) && editingUser.id !== currentUser.id && (
                    <p className="text-[10px] text-amber-700 mt-1 font-normal">
                      Changing a Super Admin's role is sent to them for approval.
                    </p>
                  )}
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

              {accountError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800 font-normal">{accountError}</div>
              )}
              {accountInfo && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 font-normal">{accountInfo}</div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {editingUser && editingUser.id !== currentUser.id && canManageAccount(currentUser, editingUser) && users.length > 1 ? (
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
                    disabled={accountBusy}
                    className="px-5 py-2 bg-[#F37C1C] hover:bg-[#D96B12] disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    {accountBusy ? 'Saving…' : editingUser ? 'Save User Changes' : 'Create System Account'}
                  </button>
                </div>
              </div>
            </form>
            )}
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
              {needsConfirmation(deletingUserConfirm)
                ? '⚠️ This is a Super Admin: they will be asked to approve the removal before it happens.'
                : '⚠️ This user will no longer be able to access Zambia Airways Crew Control System. (Their Firebase login stays, without access; it can be deleted in the Firebase console.)'}
            </div>
            {accountError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800">{accountError}</div>}

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
                disabled={accountBusy}
                onClick={async () => {
                  const target = deletingUserConfirm;
                  await runAccountAction(async () => {
                    if (needsConfirmation(target)) {
                      await requestSuperAdminAction(target, 'remove', undefined, { uid: currentUser.id, email: currentUser.email });
                      notify(`Request sent: ${target.name} must approve their removal.`, 'Super Admin Change Requested', `${currentUser.name} asked ${target.email} to approve removing their account.`, 'WARNING');
                    } else {
                      await removeAccount(target);
                      onDeleteUser?.(target.id);
                      notify(`Removed ${target.name}'s access.`, 'User Access Removed', `${currentUser.name} removed ${target.email}'s access.`, 'CRITICAL');
                    }
                    setDeletingUserConfirm(null);
                  });
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{needsConfirmation(deletingUserConfirm) ? 'Send Removal Request' : 'Confirm Delete Account'}</span>
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
