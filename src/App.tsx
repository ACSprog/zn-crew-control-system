import React, { useState, useEffect } from 'react';
import { ActiveView, CrewMember, Flight, Assignment, LeaveTrainingRecord, LegalityRules, SystemUser, AircraftFleet, AuditLog } from './types';
import { currentPeriod } from './utils/dates';
import { autoNotifyRosterChange } from './modules/notifications/autoDispatch';
import {
  getCrew,
  saveCrew,
  getFlights,
  saveFlights,
  getAssignments,
  saveAssignments,
  getLeaveRecords,
  saveLeaveRecords,
  getRules,
  saveRules,
  loadFleet,
  saveFleet,
  clearAllData,
  loadUsers,
  saveUsers,
  loadCurrentUser,
  saveCurrentUser,
  loadAuditLogs,
  addAuditEntry,
  saveAuditLogs,
  exportSystemBackupJSON,
  importSystemBackupJSON,
} from './utils/storage';
import { runAutoScheduler, optimizeRoster } from './utils/schedulerEngine';
import { subscribeToRealtimeSync, pushAllDataToFirebase, syncCrewToFirebase, syncFleetToFirebase, syncFlightsToFirebase, syncAssignmentsToFirebase, syncLeaveToFirebase, syncUsersToFirebase } from './utils/firebaseSync';
import { canAccessView, normalizeRole } from './utils/securityEngine';
import { initOfflineSyncService, cacheCriticalRoster } from './utils/offlineSync';
import {
  onAuthChange,
  signOutUser,
  changeOwnPassword,
  verifyUserAccess,
  subscribeMyUserRecord,
  effectiveRequire2fa,
  isEnrolledIn2fa,
  sessionUsed2fa,
  removeOwnAuthenticator,
  recordMy2faInUse,
  recordLastLogin,
  setLoginNotice,
  BLOCKED_MESSAGE,
  type UserAccess,
  type PendingAdminAction,
} from './utils/authService';
import { answerMyPendingAction, describePendingAction } from './utils/accounts';
import { SessionGuard, clearActivity } from './components/SessionGuard';
import { FirstLoginPasswordChange } from './components/FirstLoginPasswordChange';
import { TwoFactorRequired, TwoFactorModal } from './components/TwoFactorSetup';
import type { User as FirebaseUser } from 'firebase/auth';

// Components & Views
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LockScreenView } from './components/LockScreenView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { DashboardView } from './views/DashboardView';
import { RosterCalendarView } from './views/RosterCalendarView';
import { CrewDatabaseView } from './views/CrewDatabaseView';
import { FlightDatabaseView } from './views/FlightDatabaseView';
import { LeaveTrainingView } from './views/LeaveTrainingView';
import { AutoSchedulerView } from './views/AutoSchedulerView';
import { LegalityConflictView } from './views/LegalityConflictView';
import { AiAssistantView } from './views/AiAssistantView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { LegacyExcelSystemMappingView } from './views/LegacyExcelSystemMappingView';
import { LineCheckTrackerView } from './views/LineCheckTrackerView';
import { DocumentTrackerView } from './views/DocumentTrackerView';
import { AuditLogView } from './views/AuditLogView';
import { CrewHoursView } from './views/CrewHoursView';
import { FatigueMonitoringView } from './views/FatigueMonitoringView';
import { RecencyTrackerView } from './views/RecencyTrackerView';
import { StaffTrainingGuideView } from './views/StaffTrainingGuideView';
import { UserAccessView } from './views/UserAccessView';
import { PersonalCrewPortalView } from './views/PersonalCrewPortalView';
import { NotificationsView } from './views/NotificationsView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MobileDrawer } from './components/MobileDrawer';
import { MobileAppInstallModal } from './components/MobileAppInstallModal';

// Sensible default UI permissions per role, used only to drive what
// buttons/sections render — NOT a security boundary. Real enforcement
// happens in Firestore security rules and the server's ID-token check,
// both of which read the `role` custom claim directly, never this object.
function defaultPermissionsForRole(role: string) {
  const base = {
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
  };
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return Object.fromEntries(Object.keys(base).map((k) => [k, true])) as typeof base;
    case 'SCHEDULER':
    case 'OCC_CONTROLLER':
      return { ...base, canEditRoster: true, canGenerateRoster: true, canManageCrew: true, canExportAudit: true, canViewFullPii: true, canOverrideLegality: role === 'OCC_CONTROLLER', canApproveRosterEdits: role === 'OCC_CONTROLLER' };
    case 'CHIEF_PILOT':
      return { ...base, canOverrideLegality: true, canApproveRosterEdits: true, canViewFullPii: true, canExportAudit: true };
    case 'AUDITOR':
      return { ...base, canExportAudit: true };
    default:
      return base;
  }
}

function avatarInitialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Combines a signed-in Firebase Auth user with their Firestore `users/{uid}`
 * profile (role, status, permissions — the source of truth that
 * firestore.rules also check) into the SystemUser shape the UI expects.
 */
function buildCurrentUserFromAccess(fbUser: FirebaseUser, access: UserAccess): SystemUser {
  const profile = access.profile || {};
  const role = access.role || 'FLIGHT_CREW';
  const name = profile.name || fbUser.displayName || fbUser.email || 'Unknown User';
  return {
    id: fbUser.uid,
    staffNumber: profile.staffNumber || '—',
    name,
    email: fbUser.email || profile.email || '',
    role,
    department: profile.department || 'Unassigned',
    base: profile.base || 'LUN',
    status: profile.status || 'ACTIVE',
    avatarInitials: profile.avatarInitials || avatarInitialsFor(name),
    lastLogin: new Date().toISOString(),
    permissions: profile.permissions || defaultPermissionsForRole(role),
    mfaEnabled: access.twoFactorEnrolled,
    mfaMethod: access.twoFactorEnrolled ? 'APP_AUTHENTICATOR' : undefined,
  };
}

export function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  // Mobile navigation & install state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isMobileAppModalOpen, setIsMobileAppModalOpen] = useState<boolean>(false);

  // Application State
  const [crew, setCrewState] = useState<CrewMember[]>([]);
  const [flights, setFlightsState] = useState<Flight[]>([]);
  const [assignments, setAssignmentsState] = useState<Assignment[]>([]);
  const [leaveRecords, setLeaveRecordsState] = useState<LeaveTrainingRecord[]>([]);
  const [fleet, setFleetState] = useState<AircraftFleet[]>([]);
  const [rules, setRulesState] = useState<LegalityRules>(getRules());
  const [auditLogs, setAuditLogsState] = useState<AuditLog[]>([]);

    // System Users State (directory/profile metadata only — no passwords;
  // credentials live in Firebase Auth).
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(loadUsers());
  // Non-null for simplicity elsewhere in this file — while isLoggedOut is
  // true the value here is a harmless leftover/placeholder that is never
  // rendered, since the whole app tree is hidden behind LockScreenView.
  const [currentUser, setCurrentUser] = useState<SystemUser>(loadCurrentUser());

  // Lock Screen & Password Change Modal State. `isLoggedOut` reflects
  // whether Firebase Auth has an active session — it is not just local UI
  // state, since the same signed-in-or-not status is what Firestore rules
  // and the API server check independently.
  const [isLoggedOut, setIsLoggedOut] = useState<boolean>(true);
  const [isAuthResolving, setIsAuthResolving] = useState<boolean>(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);

  // Sign-in gate state (same steps as the QSA Reporting System):
  // account allowed → temporary password changed → 2FA used if required.
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  // Role of the person actually signed in (currentUser can be a display-only "preview as")
  const [signedInRole, setSignedInRole] = useState<SystemUser['role'] | null>(null);
  const [loginNotice, setLoginNoticeState] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [require2fa, setRequire2fa] = useState(false);
  const [global2fa, setGlobal2fa] = useState(false);
  const [session2fa, setSession2fa] = useState(false);
  const [enrolled2fa, setEnrolled2fa] = useState(false);
  const [myPendingAction, setMyPendingAction] = useState<PendingAdminAction | undefined>(undefined);
  const [answeringPending, setAnsweringPending] = useState(false);
  const [isTwoFactorOpen, setIsTwoFactorOpen] = useState(false);

  const endSession = async (message?: string) => {
    if (message) setLoginNoticeState(message);
    clearActivity();
    await signOutUser().catch((err) => console.error('[App] Sign-out failed:', err));
  };

  // Firebase Auth session listener — the actual security gate. Runs once
  // on mount; fires again on every sign-in/sign-out.
  useEffect(() => {
    const unsubscribe = onAuthChange(async (fbUser) => {
      if (!fbUser) {
        setFirebaseUser(null);
        setIsLoggedOut(true);
        setMustChangePassword(false);
        setRequire2fa(false);
        setSession2fa(false);
        setMyPendingAction(undefined);
        setIsAuthResolving(false);
        return;
      }
      setIsAuthResolving(true);
      try {
        const access = await verifyUserAccess(fbUser);
        if (!access.allowed) {
          await endSession(access.deniedReason);
          setIsAuthResolving(false);
          return;
        }

        const usedCode = await sessionUsed2fa(fbUser);
        const inUse = isEnrolledIn2fa(fbUser);

        // A Super Admin switched 2FA off for this person: remove their
        // authenticator now (they just signed in, so Firebase allows it).
        if (access.twoFactor === 'off' && inUse) {
          try {
            await recordMy2faInUse(fbUser.uid, false);
            await removeOwnAuthenticator(fbUser);
            setLoginNotice(
              'Two-step sign-in has been switched off for your account by a Super Admin. Sign in again with just your password.',
              fbUser.email || undefined
            );
            await endSession();
            setIsAuthResolving(false);
            return;
          } catch (e) {
            console.warn('[App] Could not remove the authenticator:', e);
          }
        }

        // Keep the "2FA ON / OFF" badge Super Admins see in step with reality
        if (inUse && usedCode && !access.twoFactorEnrolled) recordMy2faInUse(fbUser.uid, true);
        if (!inUse && access.twoFactorEnrolled) recordMy2faInUse(fbUser.uid, false);
        recordLastLogin(fbUser.uid);

        const resolvedUser = buildCurrentUserFromAccess(fbUser, access);
        setFirebaseUser(fbUser);
        setSignedInRole(resolvedUser.role);
        setCurrentUser(resolvedUser);
        saveCurrentUser(resolvedUser);
        setMustChangePassword(access.mustChangePassword);
        setRequire2fa(access.require2fa);
        setGlobal2fa(access.global2fa);
        setSession2fa(usedCode);
        setEnrolled2fa(inUse);
        setMyPendingAction(access.pendingAction);
        setLoginNoticeState(null);
        setIsLoggedOut(false);
        logAction('User Login', `${resolvedUser.name} (${resolvedUser.role}) signed in${usedCode ? ' with 2FA' : ''}.`);
        showToast(`Welcome back, ${resolvedUser.name}!`);
      } catch (err) {
        console.error('[App] Failed to resolve signed-in user profile:', err);
        await endSession('Signed in, but your account could not be loaded. Try again or contact your administrator.');
      } finally {
        setIsAuthResolving(false);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch the signed-in user's own account: blocked/removed ends the session
  // at once; 2FA started/stopped and Super Admin requests show straight away.
  useEffect(() => {
    if (isLoggedOut || !firebaseUser) return;
    return subscribeMyUserRecord(firebaseUser.uid, (rec) => {
      setMyPendingAction(rec.pendingAction);
      if (rec.exists) setRequire2fa(effectiveRequire2fa(global2fa, rec.twoFactor));
      if (rec.exists && rec.role) {
        setSignedInRole(rec.role);
        setCurrentUser((cu) => {
          if (cu.id !== firebaseUser.uid || cu.role === rec.role) return cu;
          const updated = { ...cu, role: rec.role! };
          saveCurrentUser(updated);
          return updated;
        });
      }
      if (!rec.exists || rec.blocked) {
        endSession(rec.blocked ? BLOCKED_MESSAGE : 'Your Crew Control access has been removed.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedOut, firebaseUser?.uid, global2fa]);

  // Fully signed in: account OK, own password set, 2FA used if required.
  const appUnlocked = !isLoggedOut && !mustChangePassword && !(require2fa && !session2fa);

  const handleSessionExpired = (message: string) => {
    handleSaveAllSystemData();
    endSession(message);
  };

  const answerPending = async (approve: boolean) => {
    if (!myPendingAction) return;
    const what = describePendingAction(myPendingAction, 'your');
    const ok = window.confirm(
      approve
        ? `Approve ${myPendingAction.requestedByEmail}'s request to ${what}?${
            myPendingAction.type === 'role' ? '' : '\nYou will be signed out.'
          }`
        : `Decline the request to ${what}?`
    );
    if (!ok) return;
    setAnsweringPending(true);
    try {
      await answerMyPendingAction(myPendingAction, approve);
      logAction(
        approve ? 'Super Admin Request Approved' : 'Super Admin Request Declined',
        `${currentUser.name} ${approve ? 'approved' : 'declined'} ${myPendingAction.requestedByEmail}'s request to ${what}.`,
        'WARNING'
      );
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setAnsweringPending(false);
    }
  };

  // Toast Banner State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const logAction = (action: string, details: string, severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO') => {
    const updatedLogs = addAuditEntry({
      user: currentUser?.name || 'System User',
      userRole: currentUser?.role || 'ADMIN',
      action,
      details,
      severity,
    });
    setAuditLogsState(updatedLogs);
  };

  // Cloud Sync State
  const [syncStatus, setSyncStatus] = useState<'connected' | 'connecting' | 'error'>('connecting');

  // Initial Load from Storage and Firebase Realtime Listener
  useEffect(() => {
    const initialCrew = getCrew();
    const initialFleet = loadFleet();
    const initialFlights = getFlights();
    const initialAssignments = getAssignments();
    const initialLeave = getLeaveRecords();
    const initialRules = getRules();
    const initialAudit = loadAuditLogs();
    const initialUsers = loadUsers();
    const initialCurrentUser = loadCurrentUser();

    setCrewState(initialCrew);
    setFlightsState(initialFlights);
    setAssignmentsState(initialAssignments);
    setLeaveRecordsState(initialLeave);
    setFleetState(initialFleet);
    setRulesState(initialRules);
    setAuditLogsState(initialAudit);
    setSystemUsers(initialUsers);
    setCurrentUser(initialCurrentUser);

    // Initialize Service Worker Offline Sync & Background Sync service
    initOfflineSyncService().catch((err) => {
      console.warn('Offline sync initialization notice:', err);
    });
  }, []);

  // Subscribe to Firestore real-time sync — only once signed in (Firestore
  // rules reject these listeners for an anonymous session, so starting
  // them before login just produces permission errors that never clear).
  // Restarts automatically whenever isLoggedOut flips, so logging out and
  // back in (possibly as a different user) gets a fresh subscription.
  const isCrewRole = signedInRole === 'FLIGHT_CREW' || signedInRole === 'PILOT_CABIN';
  const isUserManager = signedInRole === 'SUPER_ADMIN' || signedInRole === 'ADMIN';
  const signedInEmail = firebaseUser?.email || '';
  const signedInUid = firebaseUser?.uid || '';
  useEffect(() => {
    if (!appUnlocked) return;

    const unsubscribe = subscribeToRealtimeSync({
      onSyncStatusChange: (status) => setSyncStatus(status),
      onCrewUpdate: (items) => {
        if (Array.isArray(items)) {
          setCrewState(items);
          localStorage.setItem('zambia_airways_crew', JSON.stringify(items));
        }
      },
      onFlightsUpdate: (items) => {
        if (Array.isArray(items)) {
          setFlightsState(items);
          localStorage.setItem('zambia_airways_flights', JSON.stringify(items));
        }
      },
      onAssignmentsUpdate: (items) => {
        if (Array.isArray(items)) {
          setAssignmentsState(items);
          localStorage.setItem('zambia_airways_assignments', JSON.stringify(items));
        }
      },
      onLeaveUpdate: (items) => {
        if (Array.isArray(items)) {
          setLeaveRecordsState(items);
          localStorage.setItem('zambia_airways_leave', JSON.stringify(items));
        }
      },
      onFleetUpdate: (items) => {
        if (Array.isArray(items)) {
          setFleetState(items);
          localStorage.setItem('zambia_airways_aircraft', JSON.stringify(items));
        }
      },
      onRulesUpdate: (rulesObj) => {
        if (rulesObj) {
          setRulesState(rulesObj);
          localStorage.setItem('zambia_airways_rules', JSON.stringify(rulesObj));
        }
      },
      onUsersUpdate: (items) => {
        if (Array.isArray(items) && items.length > 0) {
          setSystemUsers(items);
          localStorage.setItem('zambia_airways_users', JSON.stringify(items));
        }
      },
      onAuditLogsUpdate: (items) => {
        if (Array.isArray(items)) {
          setAuditLogsState(items);
          localStorage.setItem('zambia_airways_audit', JSON.stringify(items));
        }
      },
      // Roster acknowledgements from crew devices (previously never loaded,
      // so OCC couldn't see who had acknowledged).
      onAcknowledgmentsUpdate: (items) => {
        if (Array.isArray(items)) {
          localStorage.setItem('zambia_airways_acknowledgments', JSON.stringify(items));
        }
      },
    }, {
      crewEmail: isCrewRole && signedInEmail ? signedInEmail : undefined,
      ownUserId: isUserManager ? undefined : signedInUid,
    });

    return () => {
      unsubscribe();
    };
  }, [appUnlocked, isCrewRole, isUserManager, signedInEmail, signedInUid]);

  // Proactively cache critical roster snapshot in Service Worker & Offline Storage
  useEffect(() => {
    if (crew.length > 0 || flights.length > 0 || assignments.length > 0) {
      cacheCriticalRoster({
        id: 'latest_roster_snapshot',
        period: currentPeriod(),
        timestamp: new Date().toISOString(),
        flights,
        crew,
        assignments,
        leaveRecords,
        fleet,
        rules,
        publishedCount: assignments.length,
      });
    }
  }, [crew, flights, assignments, leaveRecords, fleet, rules]);

  const handleSaveFleet = (updatedFleet: AircraftFleet[]) => {
    setFleetState(updatedFleet);
    saveFleet(updatedFleet);
    logAction('Fleet Updated', `Saved aircraft fleet configuration (${updatedFleet.length} aircraft).`);
    showToast('Saved Zambia Airways fleet configuration!');
  };

  const handleImportFleet = (imported: AircraftFleet[]) => {
    const updated = [...fleet, ...imported];
    setFleetState(updated);
    saveFleet(updated);
    logAction('Fleet Imported', `Imported ${imported.length} aircraft records.`);
    showToast(`Imported ${imported.length} fleet aircraft records!`);
  };

  const handleClearAllData = () => {
    clearAllData();
    setCrewState([]);
    setFlightsState([]);
    setAssignmentsState([]);
    setLeaveRecordsState([]);
    setFleetState([]);
    logAction('Database Cleared', 'Cleared all system database records.', 'CRITICAL');
    showToast('Cleared all system database records! You can now enter your own custom data.');
  };

  const handleSelectCurrentUser = (user: SystemUser) => {
    setCurrentUser(user);
    saveCurrentUser(user);
    logAction('Session Switched', `Switched active user session to ${user.name} (${user.role}).`);
    showToast(`Switched active user session to ${user.name} (${user.role})`);

    const role = normalizeRole(user.role);
    const access = canAccessView(activeView, role);
    if (!access.allowed) {
      if (role === 'FLIGHT_CREW') {
        setActiveView('portal');
      } else if (role === 'AUDITOR') {
        setActiveView('audit');
      } else {
        setActiveView('dashboard');
      }
    }
  };

  const handleUpdateUsers = (updatedUsers: SystemUser[]) => {
    setSystemUsers(updatedUsers);
    saveUsers(updatedUsers);
    logAction('User Accounts Updated', `Admin ${currentUser.name} updated system user accounts/permissions.`);
    showToast('Updated system user accounts & permissions');
  };

  const handleLogout = () => {
    handleSaveAllSystemData();
    logAction('User Logout & App Locked', `${currentUser.name} (${currentUser.role}) logged out. System data auto-saved.`);
    showToast('Application saved and logged out safely!');
    // Give the debounced Firestore writes just queued above (up to 600ms)
    // time to actually reach the server before the session token is
    // invalidated — signing out immediately would cause those in-flight
    // writes to arrive after auth is gone and get rejected.
    setTimeout(() => {
      endSession();
    }, 800);
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await changeOwnPassword(currentPassword, newPassword);
      logAction('Password Changed', `${currentUser.name} updated their account password.`);
      showToast('Your account password has been successfully updated!');
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Could not update password. Please try again.');
      throw err;
    }
  };


  // CRUD Helpers
  const handleAddCrew = (newMember: Omit<CrewMember, 'id'>) => {
    const created: CrewMember = {
      ...newMember,
      // Stored lower-case so it matches the sign-in email (crew portal access rule).
      email: (newMember.email || '').trim().toLowerCase(),
      id: `crew-${Date.now()}`,
    };
    const updated = [...crew, created];
    setCrewState(updated);
    saveCrew(updated);
    showToast(`Added crew member ${created.name} (${created.staffNumber})`);
  };

  const handleUpdateCrew = (rawMember: CrewMember) => {
    const updatedMember: CrewMember = { ...rawMember, email: (rawMember.email || '').trim().toLowerCase() };
    const updated = crew.map((c) => (c.id === updatedMember.id ? updatedMember : c));
    setCrewState(updated);
    saveCrew(updated);
    showToast(`Updated crew member ${updatedMember.name}`);
  };

  const handleDeleteCrew = (id: string) => {
    const member = crew.find((c) => c.id === id);
    const updated = crew.filter((c) => c.id !== id);
    setCrewState(updated);
    saveCrew(updated);
    showToast(`Deleted crew member ${member?.name || id}`);
  };

  const handleClearAllCrew = () => {
    setCrewState([]);
    saveCrew([]);
    logAction('Crew Registry Cleared', `${currentUser.name} cleared all crew records from the active registry.`);
    showToast('Crew registry cleared. Ready for custom crew entry!');
  };

  const handleAddFlight = (newFlight: Omit<Flight, 'id'>) => {
    const created: Flight = {
      ...newFlight,
      id: `flt-${Date.now()}`,
    };
    const updatedFlights = [...flights, created];
    setFlightsState(updatedFlights);
    saveFlights(updatedFlights);

    // Also create empty assignment slot
    const newAssignment: Assignment = {
      id: `asg-${created.id}`,
      flightId: created.id,
      assignedAt: new Date().toISOString(),
      status: 'OPEN',
    };
    const updatedAssignments = [...assignments, newAssignment];
    setAssignmentsState(updatedAssignments);
    saveAssignments(updatedAssignments);

    showToast(`Added flight ${created.flightNumber} (${created.departure} → ${created.arrival})`);
  };

  const handleUpdateFlight = (updatedFlight: Flight) => {
    const updated = flights.map((f) => (f.id === updatedFlight.id ? updatedFlight : f));
    setFlightsState(updated);
    saveFlights(updated);
    showToast(`Updated flight ${updatedFlight.flightNumber}`);
  };

  const handleDeleteFlight = (id: string) => {
    const flight = flights.find((f) => f.id === id);
    const updatedF = flights.filter((f) => f.id !== id);
    const updatedA = assignments.filter((a) => a.flightId !== id);
    setFlightsState(updatedF);
    setAssignmentsState(updatedA);
    saveFlights(updatedF);
    saveAssignments(updatedA);
    showToast(`Deleted flight ${flight?.flightNumber || id}`);
  };

  const handleClearFlights = (fleetFilter?: 'ALL' | 'Q400' | 'B737') => {
    let updatedF: Flight[] = [];
    let updatedA: Assignment[] = [];
    if (fleetFilter && fleetFilter !== 'ALL') {
      const removedFlightIds = new Set(flights.filter(f => f.aircraft === fleetFilter).map(f => f.id));
      updatedF = flights.filter(f => f.aircraft !== fleetFilter);
      updatedA = assignments.filter(a => !removedFlightIds.has(a.flightId));
    }
    setFlightsState(updatedF);
    setAssignmentsState(updatedA);
    saveFlights(updatedF);
    saveAssignments(updatedA);
    showToast(fleetFilter && fleetFilter !== 'ALL' ? `Emptied all ${fleetFilter} flight schedule records.` : 'Emptied the Flight Schedule Database for Q400 and B737 fleet.');
  };

  const handleUpdateAssignment = (updatedAssignment: Assignment) => {
    const existingIdx = assignments.findIndex((a) => a.flightId === updatedAssignment.flightId);
    const previousAssignment = existingIdx >= 0 ? assignments[existingIdx] : undefined;
    let updated: Assignment[];
    if (existingIdx >= 0) {
      updated = [...assignments];
      updated[existingIdx] = updatedAssignment;
    } else {
      updated = [...assignments, updatedAssignment];
    }
    setAssignmentsState(updated);
    saveAssignments(updated);
    showToast(`Updated crew assignment for flight`);
    // Notify affected crew if this flight's roster was already published
    // (honours the "Roster change" automated trigger toggle).
    autoNotifyRosterChange(previousAssignment, updatedAssignment, crew, flights, currentUser?.name || 'OCC')
      .then((r) => {
        if (!r.skipped) showToast(`Roster change notifications: ${r.sent} sent, ${r.failed} failed`);
      })
      .catch((err) => console.warn('Roster change notification failed', err));
  };

  const handleAddLeaveRecord = (newRec: Omit<LeaveTrainingRecord, 'id'>) => {
    const created: LeaveTrainingRecord = {
      ...newRec,
      id: `rec-${Date.now()}`,
    };
    const updated = [...leaveRecords, created];
    setLeaveRecordsState(updated);
    saveLeaveRecords(updated);
    showToast(`Registered ${created.type} exclusion for crew`);
  };

  const handleDeleteLeaveRecord = (id: string) => {
    const updated = leaveRecords.filter((r) => r.id !== id);
    setLeaveRecordsState(updated);
    saveLeaveRecords(updated);
    showToast(`Removed leave / training exclusion`);
  };

  const handleSaveRules = (newRules: LegalityRules) => {
    setRulesState(newRules);
    saveRules(newRules);
    showToast('Updated FTL operational limitation rules');
  };

  const handleSaveAllSystemData = () => {
    saveCrew(crew);
    saveFlights(flights);
    saveAssignments(assignments);
    saveLeaveRecords(leaveRecords);
    saveFleet(fleet);
    saveRules(rules);
    saveUsers(systemUsers);
    if (currentUser) saveCurrentUser(currentUser);
    showToast('All system records and data explicitly saved!');
  };

  const handleExportBackup = () => {
    const jsonStr = exportSystemBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zambia_airways_occ_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported complete Zambia Airways system backup file (.json)');
  };

  const handleImportBackup = (jsonStr: string) => {
    try {
      importSystemBackupJSON(jsonStr);
      setCrewState(getCrew());
      setFlightsState(getFlights());
      setAssignmentsState(getAssignments());
      setLeaveRecordsState(getLeaveRecords());
      setFleetState(loadFleet());
      setRulesState(getRules());
      setSystemUsers(loadUsers());
      showToast('Successfully restored system database from backup file!');
    } catch {
      alert('Invalid backup JSON format. Please verify the file.');
    }
  };

  const handleDeleteUser = (userId: string) => {
    if (systemUsers.length <= 1) {
      alert('Cannot delete the last system account.');
      return;
    }
    if (currentUser && currentUser.id === userId) {
      alert('Cannot delete the currently active logged-in session user.');
      return;
    }
    const target = systemUsers.find((u) => u.id === userId);
    const updated = systemUsers.filter((u) => u.id !== userId);
    setSystemUsers(updated);
    saveUsers(updated);
    showToast(`Deleted system account: ${target?.name || userId}`);
  };


  // Batch Flight Import with Automatic Roster Generation Trigger
  const handleImportFlightsWithAutoRoster = (imported: Flight[]) => {
    if (!imported || imported.length === 0) return;

    // Deduplicate against existing flights
    const existingMap = new Map<string, Flight>(
      flights.map((f) => [`${f.flightNumber}_${f.date}_${f.departure}`, f])
    );
    imported.forEach((f) => {
      existingMap.set(`${f.flightNumber}_${f.date}_${f.departure}`, f);
    });

    const updatedFlights: Flight[] = Array.from(existingMap.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.std.localeCompare(b.std);
    });

    setFlightsState(updatedFlights);
    saveFlights(updatedFlights);

    // Automatically trigger the roster generation engine across all active crew and the newly imported schedule
    if (crew.length > 0) {
      const result = runAutoScheduler(updatedFlights, crew, assignments, leaveRecords, rules);
      setAssignmentsState(result.updatedAssignments);
      saveAssignments(result.updatedAssignments);
      logAction(
        'Seasonal Schedule & Roster Auto-Generated',
        `Imported ${imported.length} flight records and automatically generated rosters for ${result.assignedCount} flight sectors (${result.openCount} open).`
      );
      showToast(
        `Imported ${imported.length} flight records & automatically generated valid crew rosters (${result.assignedCount} assigned, ${result.openCount} open)!`
      );
    } else {
      logAction('Flight Schedule Imported', `Imported ${imported.length} flight records.`);
      showToast(`Imported ${imported.length} flight schedule records! Add crew members to automatically generate rosters.`);
    }
  };

  // Batch Crew Import with Automatic Roster Generation Trigger
  const handleImportCrewWithAutoRoster = (importedCrew: CrewMember[]) => {
    if (!importedCrew || importedCrew.length === 0) return;

    // Deduplicate against existing crew
    const existingMap = new Map<string, CrewMember>(
      crew.map((c) => [c.staffNumber.toUpperCase(), c])
    );
    importedCrew.forEach((c) => {
      existingMap.set(c.staffNumber.toUpperCase(), c);
    });

    const updatedCrew: CrewMember[] = Array.from(existingMap.values());
    setCrewState(updatedCrew);
    saveCrew(updatedCrew);

    if (flights.length > 0) {
      const result = runAutoScheduler(flights, updatedCrew, assignments, leaveRecords, rules);
      setAssignmentsState(result.updatedAssignments);
      saveAssignments(result.updatedAssignments);
      logAction(
        'Crew Imported & Roster Generated',
        `Imported ${importedCrew.length} crew records with verified roles/fleets and generated rosters for ${result.assignedCount} flights.`
      );
      showToast(
        `Imported ${importedCrew.length} crew records & automatically generated rosters for ${result.assignedCount} flights!`
      );
    } else {
      logAction('Crew Imported', `Imported ${importedCrew.length} crew records.`);
      showToast(`Imported ${importedCrew.length} crew records successfully!`);
    }
  };

  // Quick Action: Auto Generate Roster from anywhere
  const handleQuickGenerateRoster = () => {
    const result = runAutoScheduler(flights, crew, assignments, leaveRecords, rules);
    setAssignmentsState(result.updatedAssignments);
    saveAssignments(result.updatedAssignments);
    showToast(
      `Generated Roster: Assigned ${result.assignedCount} flights, ${result.openCount} open, ${result.conflictCount} conflicts.`
    );
  };

  // Quick Action: Optimize Roster
  const handleQuickOptimizeRoster = () => {
    const result = optimizeRoster(flights, crew, assignments, leaveRecords, rules, {
      legalCompliance: true,
      crewHourBalance: true,
      minPositioning: true,
      minStandby: true,
      baseCompatibility: true,
      minChanges: true,
    });
    setAssignmentsState(result.proposedAssignments);
    saveAssignments(result.proposedAssignments);
    showToast(
      `Roster Optimized! Score improved from ${result.currentScore} to ${result.optimizedScore}.`
    );
  };

    if (isAuthResolving) {
    return (
      <div className="fixed inset-0 bg-[#1e1c1b] z-50 flex items-center justify-center">
        <div className="text-slate-400 text-xs font-mono animate-pulse">Checking session...</div>
      </div>
    );
  }

  if (isLoggedOut) {
    return <LockScreenView notice={loginNotice} />;
  }

  // Signed in with the temporary password: choose your own first
  if (mustChangePassword) {
    return (
      <>
        <SessionGuard user={firebaseUser} onExpire={handleSessionExpired} />
        <FirstLoginPasswordChange
          email={currentUser.email}
          onPasswordChanged={() => endSession()}
          onSkipped={() => setMustChangePassword(false)}
          onSignOut={() => endSession()}
        />
      </>
    );
  }

  // 2FA required but this session didn't use it (not set up yet, or signed in without it)
  if (require2fa && !session2fa) {
    return (
      <>
        <SessionGuard user={firebaseUser} onExpire={handleSessionExpired} />
        <TwoFactorRequired email={currentUser.email} enrolled={enrolled2fa} onSignOut={() => endSession()} />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 font-sans antialiased overflow-hidden">
      {/* Dark Navy Sidebar */}
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        currentUser={currentUser}
        onRestrictedAttempt={(reason) => showToast(`🔒 Access Restricted: ${reason}`)}
        onOpenMobileAppModal={() => setIsMobileAppModalOpen(true)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <Header
          activeView={activeView}
          onNavigate={setActiveView}
          onGenerateRoster={handleQuickGenerateRoster}
          onSaveAllData={handleSaveAllSystemData}
          onLogout={handleLogout}
          onChangePasswordClick={() => setIsChangePasswordOpen(true)}
          onTwoFactorClick={() => setIsTwoFactorOpen(true)}
          currentUser={currentUser}
          systemUsers={systemUsers}
          onSelectCurrentUser={handleSelectCurrentUser}
          syncStatus={syncStatus}
          onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
          onOpenMobileAppModal={() => setIsMobileAppModalOpen(true)}
        />

        {/* Another Super Admin asked this Super Admin to confirm a change to their own account */}
        {myPendingAction && (
          <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>
              <strong>{myPendingAction.requestedByEmail}</strong> asks you to confirm: {describePendingAction(myPendingAction, 'your')}.
            </span>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => answerPending(true)}
                disabled={answeringPending}
                className="px-3 py-1.5 bg-[#2E2C2B] hover:bg-black text-white rounded-lg font-bold disabled:opacity-60"
              >
                Approve
              </button>
              <button
                onClick={() => answerPending(false)}
                disabled={answeringPending}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg font-bold disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Floating Notification Toast */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 text-xs font-mono font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* View Page Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-24 md:pb-8">
          {activeView === 'users' && (
            <UserAccessView
              users={systemUsers}
              currentUser={currentUser}
              onSelectCurrentUser={handleSelectCurrentUser}
              onUpdateUsers={handleUpdateUsers}
              onDeleteUser={(userId) => setSystemUsers((list) => list.filter((u) => u.id !== userId))}
              onAccountAction={(message, audit) => {
                if (audit) logAction(audit.action, audit.details, audit.severity || 'INFO');
                showToast(message);
              }}
            />
          )}

          {activeView === 'dashboard' && (
            <DashboardView
              crew={crew}
              flights={flights}
              assignments={assignments}
              leaveRecords={leaveRecords}
              rules={rules}
              fleet={fleet}
              onNavigate={setActiveView}
              onGenerateRoster={handleQuickGenerateRoster}
              onOptimizeRoster={handleQuickOptimizeRoster}
            />
          )}

          {activeView === 'notifications' && (
            <NotificationsView
              crew={crew}
              flights={flights}
              assignments={assignments}
              currentUser={currentUser}
              onLogAudit={logAction}
              showToast={showToast}
            />
          )}

          {activeView === 'portal' && (
            <PersonalCrewPortalView
              crew={crew}
              flights={flights}
              assignments={assignments}
              leaveRecords={leaveRecords}
              currentUser={currentUser}
            />
          )}

          {activeView === 'calendar' && (
            <RosterCalendarView
              flights={flights}
              assignments={assignments}
              crew={crew}
              onUpdateAssignment={handleUpdateAssignment}
            />
          )}

          {activeView === 'crew' && (
            <CrewDatabaseView
              crew={crew}
              onAddCrew={handleAddCrew}
              onUpdateCrew={handleUpdateCrew}
              onDeleteCrew={handleDeleteCrew}
              onClearAllCrew={handleClearAllCrew}
              onImportCrew={handleImportCrewWithAutoRoster}
              currentUser={currentUser}
            />
          )}

          {activeView === 'flights' && (
            <FlightDatabaseView
              flights={flights}
              fleet={fleet}
              onAddFlight={handleAddFlight}
              onUpdateFlight={handleUpdateFlight}
              onDeleteFlight={handleDeleteFlight}
              onSaveFleet={handleSaveFleet}
              onClearAllData={handleClearAllData}
              onClearFlights={handleClearFlights}
              onImportFlights={handleImportFlightsWithAutoRoster}
            />
          )}

          {activeView === 'leave' && (
            <LeaveTrainingView
              leaveRecords={leaveRecords}
              crew={crew}
              onAddLeaveRecord={handleAddLeaveRecord}
              onDeleteLeaveRecord={handleDeleteLeaveRecord}
            />
          )}

          {activeView === 'scheduler' && (
            <AutoSchedulerView
              flights={flights}
              crew={crew}
              assignments={assignments}
              leaveRecords={leaveRecords}
              rules={rules}
              onApplyAssignments={(newAssignments, label) => {
                setAssignmentsState(newAssignments);
                saveAssignments(newAssignments);
                showToast(`Applied ${label} to live schedule`);
              }}
            />
          )}

          {activeView === 'legality' && (
            <LegalityConflictView
              crew={crew}
              flights={flights}
              assignments={assignments}
              leaveRecords={leaveRecords}
              rules={rules}
            />
          )}

          {activeView === 'assistant' && (
            <AiAssistantView
              crew={crew}
              flights={flights}
              assignments={assignments}
              leaveRecords={leaveRecords}
              fleet={fleet}
              rules={rules}
            />
          )}

          {activeView === 'reports' && (
            <ReportsView
              crew={crew}
              flights={flights}
              assignments={assignments}
              leaveRecords={leaveRecords}
              rules={rules}
              fleet={fleet}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              rules={rules}
              fleet={fleet}
              onSaveRules={handleSaveRules}
              onSaveFleet={handleSaveFleet}
              onSaveAllData={handleSaveAllSystemData}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              onClearAllData={handleClearAllData}
              canResetData={currentUser.permissions.canResetData}
            />
          )}

          {(activeView === 'legacy' || (activeView as string) === 'legacy_excel') && (
            <LegacyExcelSystemMappingView
              crew={crew}
              flights={flights}
              assignments={assignments}
              leaveRecords={leaveRecords}
              rules={rules}
              fleet={fleet}
              onImportCrew={handleImportCrewWithAutoRoster}
              onImportFlights={handleImportFlightsWithAutoRoster}
              onImportAssignments={(imported) => {
                const updated = [...assignments, ...imported];
                setAssignmentsState(updated);
                saveAssignments(updated);
                showToast(`Imported ${imported.length} duty assignments from Excel/CSV!`);
              }}
              onImportLeaveRecords={(imported) => {
                const updated = [...leaveRecords, ...imported];
                setLeaveRecordsState(updated);
                saveLeaveRecords(updated);
                showToast(`Imported ${imported.length} leave & training records from Excel/CSV!`);
              }}
              onImportFleet={handleImportFleet}
              onClearAllData={handleClearAllData}
              onRunAutoScheduler={handleQuickGenerateRoster}
            />
          )}

          {activeView === 'crewhours' && (
            <CrewHoursView
              crew={crew}
              flights={flights}
              assignments={assignments}
            />
          )}

          {activeView === 'fatigue' && (
            <FatigueMonitoringView
              crew={crew}
              flights={flights}
              assignments={assignments}
              rules={rules}
            />
          )}

          {activeView === 'linechecks' && (
            <LineCheckTrackerView
              crew={crew}
              onUpdateCrew={handleUpdateCrew}
            />
          )}

          {activeView === 'documents' && (
            <DocumentTrackerView
              crew={crew}
              onUpdateCrew={handleUpdateCrew}
            />
          )}

          {activeView === 'audit' && (
            <AuditLogView
              auditLogs={auditLogs}
              onClearLogs={() => {
                saveAuditLogs([]);
                setAuditLogsState([]);
                showToast('Cleared audit log history.');
              }}
            />
          )}

          {activeView === 'guide' && <StaffTrainingGuideView />}

          {activeView === 'recency' && (
            <RecencyTrackerView
              crew={crew}
              flights={flights}
              assignments={assignments}
              onUpdateCrew={handleUpdateCrew}
            />
          )}

          {activeView === 'training' && (
            <LeaveTrainingView
              leaveRecords={leaveRecords}
              crew={crew}
              onAddLeaveRecord={handleAddLeaveRecord}
              onDeleteLeaveRecord={handleDeleteLeaveRecord}
            />
          )}

          {(activeView === 'q400' || activeView === 'b737') && (
            <FlightDatabaseView
              flights={flights.filter((f) => activeView === 'all' || f.aircraft === (activeView === 'q400' ? 'Q400' : 'B737'))}
              fleet={fleet}
              onAddFlight={handleAddFlight}
              onUpdateFlight={handleUpdateFlight}
              onDeleteFlight={handleDeleteFlight}
              onSaveFleet={handleSaveFleet}
              onClearFlights={(fleetFilter) => handleClearFlights(fleetFilter || (activeView === 'q400' ? 'Q400' : 'B737'))}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar (Fixed for phone screens) */}
        <MobileBottomNav
          activeView={activeView}
          onNavigate={setActiveView}
          onOpenMenu={() => setIsMobileDrawerOpen(true)}
          openPositionsCount={assignments.filter((a) => !a.crewMemberId).length}
        />
      </div>

      {/* Mobile Navigation Drawer */}
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        activeView={activeView}
        onNavigate={setActiveView}
        currentUser={currentUser}
        onOpenMobileAppModal={() => setIsMobileAppModalOpen(true)}
        onLogout={handleLogout}
        onSaveAllData={handleSaveAllSystemData}
      />

      {/* Mobile App & PWA Installation Modal */}
      <MobileAppInstallModal
        isOpen={isMobileAppModalOpen}
        onClose={() => setIsMobileAppModalOpen(false)}
      />

      {/* Inactivity / maximum session length sign-out */}
      <SessionGuard user={firebaseUser} onExpire={handleSessionExpired} />

      {/* Two-step sign-in set-up / status */}
      <TwoFactorModal
        isOpen={isTwoFactorOpen}
        onClose={() => setIsTwoFactorOpen(false)}
        onEnrolled={() => {
          setIsTwoFactorOpen(false);
          setLoginNotice('Two-step sign-in is on. Sign in with your password and the code from your app.', currentUser.email);
          logAction('2FA Enabled', `${currentUser.name} set up authenticator-app two-step sign-in.`);
          endSession();
        }}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        currentUser={currentUser}
        onClose={() => setIsChangePasswordOpen(false)}
        onSuccess={handleChangePassword}
      />
    </div>
  );
}

export default App;
