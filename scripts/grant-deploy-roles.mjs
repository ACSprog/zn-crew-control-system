/**
 * Lets GitHub deploy the app: gives the service account whose key is saved
 * as the GitHub secret FIREBASE_SERVICE_ACCOUNT (the Firebase Admin SDK
 * account, firebase-adminsdk-...) the permissions the deploy workflow needs.
 *
 *   npm run deploy:grant
 *
 * Uses the Google account the Firebase CLI is signed in with (must be the
 * project Owner). Safe to re-run. Options: --sa <service-account email>, --yes
 */
import { ok, step, fail, parseArgs, projectIdFrom, ask, loadFirebaseTools, apiError, useCliAccount, runMain } from './fb-cli.mjs';

const ROLES = [
  ['roles/serviceusage.serviceUsageConsumer', 'Service Usage Consumer'],
  ['roles/firebasehosting.admin', 'Firebase Hosting Admin'],
  ['roles/firebaserules.admin', 'Firebase Rules Admin'],
  ['roles/firebase.viewer', 'Firebase Viewer'],
  ['roles/run.viewer', 'Cloud Run Viewer'],
  ['roles/serviceusage.apiKeysViewer', 'API Keys Viewer'],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectId = projectIdFrom(args);
  if (!projectId) fail('No project ID. Pass --project <id>.');

  const fbt = loadFirebaseTools();
  const me = await useCliAccount(fbt, args, projectId);
  const iam = new fbt.apiv2.Client({ urlPrefix: 'https://iam.googleapis.com', apiVersion: 'v1' });
  const crm = new fbt.apiv2.Client({ urlPrefix: 'https://cloudresourcemanager.googleapis.com', apiVersion: 'v1' });
  const serviceUsage = new fbt.apiv2.Client({ urlPrefix: 'https://serviceusage.googleapis.com', apiVersion: 'v1' });

  // These APIs must be on to read/change permissions (free)
  for (const api of ['iam.googleapis.com', 'cloudresourcemanager.googleapis.com']) {
    await serviceUsage.post(`/projects/${projectId}/services/${api}:enable`, {}).catch(() => undefined);
  }

  step('Finding the deploy service account...');
  let sa = typeof args.sa === 'string' ? args.sa : '';
  if (!sa) {
    try {
      const { body } = await iam.get(`/projects/${projectId}/serviceAccounts`, { queryParams: { pageSize: 100 } });
      const all = (body.accounts || []).map((a) => a.email);
      sa = all.find((e) => e.startsWith('firebase-adminsdk-fbsvc@')) || all.find((e) => e.startsWith('firebase-adminsdk'));
    } catch (e) {
      fail(`Could not list service accounts: ${apiError(e)}`);
    }
  }
  if (!sa) fail('No firebase-adminsdk service account found. Pass the one from your key file:  --sa name@project.iam.gserviceaccount.com');
  ok(sa);

  console.log(`\nGive ${sa}`);
  console.log(`permission to deploy project ${projectId} (signed in as ${me}):`);
  for (const [, label] of ROLES) console.log(`  • ${label}`);
  if (!args.yes && !/^y(es)?$/i.test(await ask('\nContinue? (y/N) '))) {
    console.log('Cancelled.');
    return;
  }

  step('Adding the roles...');
  const member = `serviceAccount:${sa}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const { body: policy } = await crm.post(`/projects/${projectId}:getIamPolicy`, { options: { requestedPolicyVersion: 3 } });
      policy.bindings = policy.bindings || [];
      let added = 0;
      for (const [role] of ROLES) {
        let b = policy.bindings.find((x) => x.role === role && !x.condition);
        if (!b) policy.bindings.push((b = { role, members: [] }));
        if (!b.members.includes(member)) {
          b.members.push(member);
          added++;
        }
      }
      if (added) {
        policy.version = 3;
        await crm.post(`/projects/${projectId}:setIamPolicy`, { policy });
      }
      ok(added ? `Added ${added} role(s).` : 'It already had all of them.');
      break;
    } catch (e) {
      const msg = apiError(e);
      if (attempt < 4 && /concurrent|ABORTED|409/i.test(msg)) {
        await sleep(3000 * attempt);
        continue;
      }
      fail(`Could not change permissions: ${msg}\n(The signed-in Google account must be an Owner of the project.)`);
    }
  }

  console.log('\n\x1b[32mDone.\x1b[0m GitHub can now deploy. Re-run the failed deploy from the repo\'s Actions tab,');
  console.log('or just merge the next change. (Permission changes can take a minute or two to apply.)');
}

runMain(main);
