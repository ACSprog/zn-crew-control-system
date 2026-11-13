/**
 * One-time setup so GitHub deploys the app by itself (merge → test site,
 * pull request → staging preview; main address only via "Go live").
 *
 *   npm run github:deploy
 *
 * What it does, using the Google account the Firebase CLI is signed in with:
 *   1. Creates a deploy-only service account "github-deploy" in the project.
 *   2. Gives it just what the workflows need (Hosting + security rules).
 *   3. Makes a new key and saves it straight into the GitHub repo secret
 *      FIREBASE_SERVICE_ACCOUNT. The key never touches your disk or screen.
 *   4. Deletes this account's older keys (so re-running rotates the key).
 *   5. Optionally starts the "Deploy test site" workflow so you can see it work.
 *
 * Needs:  Firebase CLI login (npx firebase-tools login) — project owner
 *         GitHub CLI login (gh auth login)            — repo admin
 *
 * Options: --project <id>, --repo <owner/name>, --account <google email>, --yes
 */
import { execFileSync } from 'child_process';
import { ok, step, fail, SetupError, parseArgs, projectIdFrom, ask, loadFirebaseTools, apiError, useCliAccount, runMain } from './fb-cli.mjs';

const SECRET_NAME = 'FIREBASE_SERVICE_ACCOUNT';
const ACCOUNT_ID = 'github-deploy';
const ROLES = [
  'roles/firebasehosting.admin', // publish the site and preview channels
  'roles/firebaserules.admin', // publish firestore.rules
  'roles/firebase.viewer', // CLI reads the project details
  'roles/run.viewer', // hosting action checks for Cloud Run rewrites
  'roles/serviceusage.serviceUsageConsumer', // call the Firebase APIs
  'roles/serviceusage.apiKeysViewer', // hosting action reads the web API key
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function gh(args, input) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  }).trim();
}

function repoFrom(args) {
  if (typeof args.repo === 'string' && args.repo) return args.repo;
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const m = url.match(/github\.com[:/]([^/]+\/[^/.]+?)(\.git)?$/);
    if (m) return m[1];
  } catch {
    /* not a git checkout */
  }
  return 'ACSprog/zn-crew-control-system';
}

function checkGitHubCli(repo) {
  try {
    gh(['--version']);
  } catch {
    fail(
      'The GitHub CLI (gh) is not installed.\n' +
        '  Windows:  winget install --id GitHub.cli\n' +
        '  macOS:    brew install gh\n' +
        '  Others:   https://cli.github.com\n' +
        'Then run:  gh auth login   and run this script again.'
    );
  }
  try {
    gh(['auth', 'status']);
  } catch {
    fail('The GitHub CLI is not signed in. Run:  gh auth login   then run this script again.');
  }
  try {
    const admin = gh(['api', `repos/${repo}`, '--jq', '.permissions.admin']);
    if (admin !== 'true') fail(`Your GitHub account is not an admin of ${repo}, so it can't save repo secrets.`);
  } catch (e) {
    if (e instanceof SetupError) throw e;
    fail(`Could not open ${repo} on GitHub: ${(e.stderr || e.message || '').toString().trim()}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectId = projectIdFrom(args);
  if (!projectId) fail('No project ID. Pass --project <id>.');
  const repo = repoFrom(args);

  step('Checking the GitHub CLI...');
  checkGitHubCli(repo);
  ok(`Signed in to GitHub with admin access to ${repo}.`);

  step('Checking the Firebase CLI...');
  const fbt = loadFirebaseTools();
  const accountEmail = await useCliAccount(fbt, args, projectId);
  ok(`Signed in to Google as ${accountEmail}.`);

  const saEmail = `${ACCOUNT_ID}@${projectId}.iam.gserviceaccount.com`;
  console.log('\nAutomatic GitHub deploys for Zambia Airways Crew Control');
  console.log(`  Firebase project : ${projectId}`);
  console.log(`  GitHub repo      : ${repo}`);
  console.log(`  Deploy account   : ${saEmail}`);
  console.log(`  Saves secret     : ${SECRET_NAME} (replaces it if it exists)`);
  if (!args.yes) {
    const answer = await ask('\nContinue? (y/N) ');
    if (!/^y(es)?$/i.test(answer)) {
      console.log('Cancelled.');
      return;
    }
  }

  const userProject = { headers: { 'x-goog-user-project': projectId } };
  const serviceUsage = new fbt.apiv2.Client({ urlPrefix: 'https://serviceusage.googleapis.com', apiVersion: 'v1' });
  const iam = new fbt.apiv2.Client({ urlPrefix: 'https://iam.googleapis.com', apiVersion: 'v1' });
  const crm = new fbt.apiv2.Client({ urlPrefix: 'https://cloudresourcemanager.googleapis.com', apiVersion: 'v1' });

  step('Turning on the Google APIs this needs (free)...');
  for (const api of ['iam.googleapis.com', 'cloudresourcemanager.googleapis.com', 'firebaserules.googleapis.com', 'firebasehosting.googleapis.com']) {
    try {
      await serviceUsage.post(`/projects/${projectId}/services/${api}:enable`, {});
    } catch (e) {
      console.log(`  (${api}: ${apiError(e)} — continuing)`);
    }
  }
  ok('APIs ready.');

  step('Creating the deploy account...');
  try {
    await iam.post(
      `/projects/${projectId}/serviceAccounts`,
      { accountId: ACCOUNT_ID, serviceAccount: { displayName: 'GitHub Actions deploy (Hosting + rules)' } },
      userProject
    );
    ok(`Created ${saEmail}.`);
    await sleep(5000); // new accounts take a moment to be usable in permissions
  } catch (e) {
    if (e?.status === 409 || /already exists/i.test(apiError(e))) ok(`${saEmail} already exists — reusing it.`);
    else fail(`Could not create the deploy account: ${apiError(e)}`);
  }

  step('Giving it deploy permissions...');
  const member = `serviceAccount:${saEmail}`;
  let granted = false;
  for (let attempt = 1; attempt <= 5 && !granted; attempt++) {
    try {
      const { body: policy } = await crm.post(`/projects/${projectId}:getIamPolicy`, { options: { requestedPolicyVersion: 3 } });
      policy.bindings = policy.bindings || [];
      let changed = false;
      for (const role of ROLES) {
        let binding = policy.bindings.find((b) => b.role === role && !b.condition);
        if (!binding) {
          binding = { role, members: [] };
          policy.bindings.push(binding);
        }
        if (!binding.members.includes(member)) {
          binding.members.push(member);
          changed = true;
        }
      }
      if (changed) {
        policy.version = 3;
        await crm.post(`/projects/${projectId}:setIamPolicy`, { policy });
      }
      granted = true;
    } catch (e) {
      const msg = apiError(e);
      if (attempt < 5 && /does not exist|concurrent|ABORTED|409/i.test(msg)) {
        await sleep(4000 * attempt);
        continue;
      }
      fail(`Could not grant permissions: ${msg}\n(You need to be an Owner of the Firebase project.)`);
    }
  }
  ok(`Granted: ${ROLES.map((r) => r.replace('roles/', '')).join(', ')}.`);

  step('Making a new key and saving it to GitHub...');
  let oldKeys = [];
  try {
    const { body } = await iam.get(`/projects/${projectId}/serviceAccounts/${saEmail}/keys`, {
      queryParams: { keyTypes: 'USER_MANAGED' },
    });
    oldKeys = (body.keys || []).map((k) => k.name);
  } catch {
    /* listing is only for clean-up */
  }
  let keyJson;
  let newKeyName;
  try {
    const { body } = await iam.post(`/projects/${projectId}/serviceAccounts/${saEmail}/keys`, {});
    newKeyName = body.name;
    keyJson = Buffer.from(body.privateKeyData, 'base64').toString('utf8');
  } catch (e) {
    const msg = apiError(e);
    if (/disableServiceAccountKeyCreation|constraint/i.test(msg))
      fail(
        `Google blocked key creation for this project (organisation policy): ${msg}\n` +
          'An organisation admin must allow "iam.disableServiceAccountKeyCreation" for this project.'
      );
    fail(`Could not create a key: ${msg}`);
  }
  try {
    gh(['secret', 'set', SECRET_NAME, '--repo', repo], keyJson);
  } catch (e) {
    // Don't leave an unused key behind
    await iam.delete(`/${newKeyName}`).catch(() => undefined);
    fail(`Could not save the GitHub secret: ${(e.stderr || e.message || '').toString().trim()}`);
  } finally {
    keyJson = undefined;
  }
  ok(`Saved as the ${SECRET_NAME} secret in ${repo}.`);

  if (oldKeys.length) {
    let removed = 0;
    for (const name of oldKeys) {
      try {
        await iam.delete(`/${name}`);
        removed++;
      } catch {
        /* leave it; harmless */
      }
    }
    ok(`Deleted ${removed} older key(s) for this account.`);
  }

  console.log('\n\x1b[32mDone.\x1b[0m From now on:');
  console.log('  • merging into master updates the TEST site + security rules');
  console.log('  • every pull request gets a staging preview link');
  console.log('  • the main address changes only when you run "Go live" (Actions tab) or npm run go-live');

  const run = args.yes ? 'n' : await ask('\nStart the "Deploy test site" workflow now to check it works? (y/N) ');
  if (/^y(es)?$/i.test(run)) {
    try {
      gh(['workflow', 'run', 'firebase-test.yml', '--repo', repo, '--ref', 'master']);
      ok(`Started. Watch it at https://github.com/${repo}/actions`);
    } catch (e) {
      console.log(`  Could not start it (${(e.stderr || e.message || '').toString().trim()}). Start it from the Actions tab.`);
    }
  }
}

runMain(main);
