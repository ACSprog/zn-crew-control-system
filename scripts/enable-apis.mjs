/**
 * Switches on the Google APIs a new Firebase project needs (all free):
 * Firestore, Firebase Rules, Hosting, Authentication, Service Usage.
 * New projects start with some of them off, which makes the first deploy fail
 * with "API has not been used in project ... or it is disabled".
 *
 *   node scripts/enable-apis.mjs [--live | --project <id>]
 *
 * Uses the Google account the Firebase CLI is signed in with.
 */
import { ok, step, fail, parseArgs, projectIdFrom, loadFirebaseTools, apiError, useCliAccount, runMain } from './fb-cli.mjs';

const APIS = [
  ['firestore.googleapis.com', 'Cloud Firestore (database)'],
  ['firebaserules.googleapis.com', 'Firebase security rules'],
  ['firebasehosting.googleapis.com', 'Firebase Hosting (website)'],
  ['identitytoolkit.googleapis.com', 'Firebase Authentication (sign-in)'],
  ['serviceusage.googleapis.com', 'Service Usage'],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectId = projectIdFrom(args);
  if (!projectId) fail('No project ID. Pass --project <id>, or fill in the config file first.');
  const fbt = loadFirebaseTools();
  await useCliAccount(fbt, args, projectId);
  const su = new fbt.apiv2.Client({ urlPrefix: 'https://serviceusage.googleapis.com', apiVersion: 'v1' });

  step(`Switching on the Google services for ${projectId}...`);
  let waited = false;
  for (const [api, label] of APIS) {
    try {
      const { body } = await su.get(`/projects/${projectId}/services/${api}`);
      if (body?.state === 'ENABLED') {
        ok(`${label}: already on`);
        continue;
      }
      await su.post(`/projects/${projectId}/services/${api}:enable`, {});
      ok(`${label}: switched on`);
      waited = true;
    } catch (e) {
      fail(
        `Could not switch on ${label} (${api}): ${apiError(e)}\n` +
          `Switch it on by hand: https://console.developers.google.com/apis/api/${api}/overview?project=${projectId}`
      );
    }
  }
  if (waited) {
    console.log('  Waiting 30 seconds for Google to apply this...');
    await sleep(30000);
  }
}

runMain(main);
