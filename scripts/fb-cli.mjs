/**
 * Shared helpers for scripts that act with the Google account the Firebase
 * CLI is signed in with (`firebase login`) — no service-account key needed.
 * Ported from the Zambia Airways QSA Reporting System.
 */
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import readline from 'readline';

export const ok = (m) => console.log(`\x1b[32m✔\x1b[0m ${m}`);
export const step = (m) => console.log(`\n\x1b[36m▶\x1b[0m ${m}`);
export class SetupError extends Error {}
// Throw instead of process.exit(): exiting while readline is closing crashes Node on Windows.
export function fail(message) {
  throw new SetupError(message);
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) {
      args[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

/** Project ID: --project <id>, else the live config with --live, else the test config. */
export function projectIdFrom(args) {
  if (typeof args.project === 'string' && args.project) return args.project;
  const file = path.join(process.cwd(), args.live ? 'firebase-applet-config.live.json' : 'firebase-applet-config.json');
  if (!existsSync(file)) return '';
  try {
    return JSON.parse(readFileSync(file, 'utf8')).projectId || '';
  } catch {
    return '';
  }
}

export function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close();
      resolve(a.trim());
    })
  );
}

function npxCacheCandidates() {
  try {
    const cache = execSync('npm config get cache', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const npxDir = path.join(cache, '_npx');
    if (!existsSync(npxDir)) return [];
    return readdirSync(npxDir)
      .map((d) => path.join(npxDir, d, 'node_modules', 'firebase-tools'))
      .filter((d) => existsSync(path.join(d, 'lib', 'apiv2.js')))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  } catch {
    return [];
  }
}

function findFirebaseTools() {
  const candidates = [];
  try {
    candidates.push(path.dirname(createRequire(import.meta.url).resolve('firebase-tools/package.json')));
  } catch {
    /* not installed locally */
  }
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    candidates.push(path.join(globalRoot, 'firebase-tools'));
  } catch {
    /* npm not on PATH */
  }
  candidates.push(...npxCacheCandidates());
  return candidates.find((d) => existsSync(path.join(d, 'lib', 'apiv2.js')));
}

export function loadFirebaseTools() {
  let dir = findFirebaseTools();
  if (!dir) {
    console.log('Fetching the Firebase CLI (one-time)...');
    try {
      execSync('npx --yes firebase-tools@latest --version', { stdio: 'ignore' });
    } catch {
      /* reported below */
    }
    dir = findFirebaseTools();
  }
  if (!dir) fail('Firebase CLI not found. Install it with:  npm install -g firebase-tools');
  const req = createRequire(path.join(dir, 'package.json'));
  return {
    version: req('./package.json').version,
    auth: req('./lib/auth'),
    apiv2: req('./lib/apiv2'),
    requireAuth: req('./lib/requireAuth').requireAuth,
  };
}

export function apiError(e) {
  const ctx = e?.context?.body?.error;
  return ctx?.message || ctx?.status || e?.message || String(e);
}

/** Signs API calls in as the Firebase CLI's account; returns that account's email. */
export async function useCliAccount(fbt, args, projectId) {
  let account;
  try {
    account = fbt.auth.selectAccount(typeof args.account === 'string' ? args.account : undefined, process.cwd());
  } catch (e) {
    fail(e.message);
  }
  if (!account?.user?.email) fail('You are not signed in to the Firebase CLI. Run:  npx firebase-tools login');
  try {
    await fbt.requireAuth({ user: account.user, tokens: account.tokens, projectRoot: process.cwd(), project: projectId });
  } catch (e) {
    fail(`Could not use the signed-in account: ${e.message}\nTry:  npx firebase-tools login --reauth`);
  }
  return account.user.email;
}

export function runMain(main) {
  main().catch((e) => {
    if (e instanceof SetupError) console.error(`\n\x1b[31m✘ ${e.message}\x1b[0m`);
    else console.error('\n\x1b[31m✘ Unexpected error:\x1b[0m', e?.message || e);
    process.exitCode = 1;
  });
}
