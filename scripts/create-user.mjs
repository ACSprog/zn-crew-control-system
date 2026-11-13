#!/usr/bin/env node
/**
 * Creates (or updates) a real Firebase Auth account for a crew-control
 * system user, sets their `role` custom claim (the thing Firestore
 * security rules and the API server actually check), and writes a
 * matching Firestore `users/{uid}` profile document (display metadata
 * only — name, department, etc. — never a password).
 *
 * Usage:
 *   node scripts/create-user.mjs --emulator \
 *     --email=admin@zambiaairways.co.zm --password=SomeStrongPass123 \
 *     --name="System Administrator" --role=SUPER_ADMIN \
 *     --department="IT" --staffNumber=ZA-001
 *
 * Drop --emulator to target live production Firebase (see README notes
 * printed below for the one-time setup that requires).
 *
 * Valid --role values: SUPER_ADMIN, ADMIN, OCC_CONTROLLER, SCHEDULER,
 * CHIEF_PILOT, AUDITOR, FLIGHT_CREW, PILOT_CABIN
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// --live (or FIREBASE_ENV=live) targets the live project; default is the test project
const useLive = process.argv.includes('--live') || process.env.FIREBASE_ENV === 'live';
const firebaseConfig = JSON.parse(
  readFileSync(join(__dirname, '..', useLive ? 'firebase-applet-config.live.json' : 'firebase-applet-config.json'), 'utf8')
);

function parseArgs() {
  const args = {};
  for (const raw of process.argv.slice(2)) {
    if (raw === '--emulator') {
      args.emulator = true;
      continue;
    }
    const match = /^--([^=]+)=(.*)$/.exec(raw);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function defaultPermissionsForRole(role) {
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
      return Object.fromEntries(Object.keys(base).map((k) => [k, true]));
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

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OCC_CONTROLLER', 'SCHEDULER', 'CHIEF_PILOT', 'AUDITOR', 'FLIGHT_CREW', 'PILOT_CABIN'];

async function main() {
  const args = parseArgs();

  if (!args.email || !args.role) {
    console.error(`
Usage:
  node scripts/create-user.mjs --emulator \\
    --email=someone@zambiaairways.co.zm --password=StrongPass123 \\
    --name="Full Name" --role=SCHEDULER --department="OCC" --staffNumber=ZA-002

Required:  --email --role
Needed to create a brand-new account: --password --name
Optional:  --department --staffNumber --base (default LUN)

Valid --role values: ${VALID_ROLES.join(', ')}

Drop --emulator to target live production Firebase.
`);
    process.exit(1);
  }

  if (!VALID_ROLES.includes(args.role)) {
    console.error(`Invalid --role "${args.role}". Valid values: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  if (args.emulator) {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
    admin.initializeApp({ projectId: firebaseConfig.projectId });
    console.log(`[create-user] Targeting LOCAL EMULATOR (project: ${firebaseConfig.projectId})`);
  } else {
    if (!firebaseConfig.projectId) {
      console.error('[create-user] firebase-applet-config.live.json has no project yet.');
      process.exit(1);
    }
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId,
    });
    console.log(`[create-user] Targeting the ${useLive ? 'LIVE' : 'TEST'} Firebase project: ${firebaseConfig.projectId}`);
    console.log('[create-user] Make sure this is really what you want — this writes a real account.');
  }

  const auth = admin.auth();
  const db = admin.firestore();

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(args.email);
    console.log(`[create-user] Found existing account for ${args.email} (uid: ${userRecord.uid}). Updating role/profile only.`);
    if (args.password) {
      await auth.updateUser(userRecord.uid, { password: args.password });
      console.log('[create-user] Password updated.');
    }
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    if (!args.password || !args.name) {
      console.error('Account does not exist yet — --password and --name are required to create it.');
      process.exit(1);
    }
    userRecord = await auth.createUser({
      email: args.email,
      password: args.password,
      displayName: args.name,
      emailVerified: true,
    });
    console.log(`[create-user] Created new account for ${args.email} (uid: ${userRecord.uid}).`);
  }

  await auth.setCustomUserClaims(userRecord.uid, { role: args.role });
  console.log(`[create-user] Set role claim: ${args.role}`);

  const name = args.name || userRecord.displayName || args.email;
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

  await db.collection('users').doc(userRecord.uid).set(
    {
      id: userRecord.uid,
      name,
      email: args.email,
      role: args.role,
      department: args.department || 'Unassigned',
      staffNumber: args.staffNumber || '—',
      base: args.base || 'LUN',
      status: 'ACTIVE',
      avatarInitials: initials || 'U',
      permissions: defaultPermissionsForRole(args.role),
    },
    { merge: true }
  );
  console.log('[create-user] Firestore profile document written to users/' + userRecord.uid);
  console.log('\n✅ Done. This account can now sign in with the email + password above.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[create-user] Failed:', err);
  process.exit(1);
});