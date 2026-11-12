/**
 * Removes a user's authenticator-app 2FA (lost or replaced phone). They set it
 * up again at their next sign-in (if 2FA is required) or from their name →
 * Two-Step Sign-In.
 *
 *   npm run reset-2fa -- --email person@zambiaairways.co.zm
 *
 * Run by the project owner, signed in to the Firebase CLI (the browser can't
 * do this on the free plan). Options: --project <id>, --account <google email>, --yes
 */
import { ok, step, fail, parseArgs, projectIdFrom, ask, loadFirebaseTools, apiError, useCliAccount, runMain, SetupError } from './fb-cli.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectId = projectIdFrom(args);
  const email = typeof args.email === 'string' ? args.email.trim().toLowerCase() : '';
  if (!projectId) fail('No project ID. Pass --project <id>.');
  if (!email.includes('@')) fail("Give the user's email:  --email person@zambiaairways.co.zm");

  const fbt = loadFirebaseTools();
  const accountEmail = await useCliAccount(fbt, args, projectId);

  console.log(`\nReset 2FA for ${email}`);
  console.log(`  Google account : ${accountEmail}`);
  console.log(`  Project        : ${projectId}`);
  if (!args.yes) {
    const answer = await ask("\nRemove this user's authenticator app? They must set up 2FA again. (y/N) ");
    if (!/^y(es)?$/i.test(answer)) {
      console.log('Cancelled.');
      return;
    }
  }

  const identityApi = new fbt.apiv2.Client({ urlPrefix: 'https://identitytoolkit.googleapis.com', apiVersion: 'v1' });
  const userProject = { headers: { 'x-goog-user-project': projectId } };

  step('Finding the user...');
  let uid;
  try {
    const found = await identityApi.post(`/projects/${projectId}/accounts:lookup`, { email: [email] }, userProject);
    const user = found.body?.users?.[0];
    if (!user) fail(`No login found for ${email}.`);
    uid = user.localId;
    const factors = user.mfaInfo?.length || 0;
    ok(`Found UID ${uid} with ${factors} second factor${factors === 1 ? '' : 's'}.`);
    if (!factors) {
      console.log('Nothing to reset.');
      return;
    }
  } catch (e) {
    if (e instanceof SetupError) throw e;
    fail(`Could not look up the user: ${apiError(e)}`);
  }

  step('Removing their authenticator app...');
  try {
    await identityApi.post(`/projects/${projectId}/accounts:update`, { localId: uid, mfa: {} }, userProject);
    ok('Done. They will set up 2FA again at their next sign-in.');
  } catch (e) {
    fail(`Could not reset 2FA: ${apiError(e)}`);
  }
}

runMain(main);
