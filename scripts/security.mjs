/**
 * Two-step sign-in (2FA) switches for the project owner.
 *
 *   npm run 2fa:enable                 turn ON authenticator-app 2FA for the project
 *   npm run 2fa:enable -- --require    ...and REQUIRE it for everyone straight away
 *   npm run 2fa:relax                  emergency: stop requiring 2FA for everyone
 *
 * Enabling upgrades the project to "Firebase Authentication with Identity
 * Platform" (free on the Spark plan, up to 3,000 daily active users) and turns
 * on the TOTP (authenticator app) second factor. Requiring it for everyone is
 * best done from the app (User Access → "Require 2FA for Everyone") after you
 * have set up 2FA on your own account, which proves the codes work.
 *
 * Options: --project <id> (default: firebase-applet-config.json), --account <google email>, --yes
 */
import { ok, step, fail, parseArgs, projectIdFrom, ask, loadFirebaseTools, apiError, useCliAccount, runMain } from './fb-cli.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.enable ? 'enable' : args.relax ? 'relax' : '';
  if (!mode) fail('Use --enable (optionally with --require) or --relax.');
  const projectId = projectIdFrom(args);
  if (!projectId) fail('No project ID. Pass --project <id>.');

  const fbt = loadFirebaseTools();
  const accountEmail = await useCliAccount(fbt, args, projectId);

  console.log('\nTwo-step sign-in (2FA) for Zambia Airways Crew Control');
  console.log(`  Google account : ${accountEmail}`);
  console.log(`  Project        : ${projectId}`);
  console.log(
    `  Action         : ${
      mode === 'relax'
        ? 'STOP requiring 2FA for everyone (users who set it up keep using it)'
        : `turn on authenticator-app 2FA${args.require ? ' and REQUIRE it for everyone' : ''}`
    }`
  );
  if (!args.yes) {
    const answer = await ask('\nContinue? (y/N) ');
    if (!/^y(es)?$/i.test(answer)) {
      console.log('Cancelled.');
      return;
    }
  }

  const userProject = { headers: { 'x-goog-user-project': projectId } };
  const firestoreApi = new fbt.apiv2.Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
  const securityDoc = `/projects/${projectId}/databases/(default)/documents/settings/security`;
  // Replaces the small settings/security document (it only holds these fields)
  const writeRequire2fa = (value) =>
    firestoreApi.patch(
      securityDoc,
      { fields: { require2fa: { booleanValue: value }, updatedBy: { stringValue: accountEmail } } },
      userProject
    );

  if (mode === 'relax') {
    step('Stopping the 2FA requirement...');
    try {
      await writeRequire2fa(false);
      ok('2FA is no longer required for everyone. Per-person settings still apply.');
    } catch (e) {
      fail(`Could not save settings/security: ${apiError(e)}`);
    }
    return;
  }

  step('Upgrading to Firebase Authentication with Identity Platform...');
  const identityV2 = new fbt.apiv2.Client({ urlPrefix: 'https://identitytoolkit.googleapis.com', apiVersion: 'v2' });
  try {
    await identityV2.post(`/projects/${projectId}/identityPlatform:initializeAuth`, {}, userProject);
    ok('Upgraded (free on Spark, up to 3,000 daily users).');
  } catch (e) {
    const msg = apiError(e);
    if (/already|ALREADY/.test(msg)) ok('Identity Platform already enabled.');
    else console.log(`  (Identity Platform upgrade said: ${msg}. Continuing.)`);
  }

  step('Turning on authenticator-app (TOTP) 2FA...');
  const identityAdmin = new fbt.apiv2.Client({ urlPrefix: 'https://identitytoolkit.googleapis.com', apiVersion: 'admin/v2' });
  try {
    await identityAdmin.patch(
      `/projects/${projectId}/config`,
      { mfa: { providerConfigs: [{ state: 'ENABLED', totpProviderConfig: { adjacentIntervals: 5 } }] } },
      { ...userProject, queryParams: { updateMask: 'mfa.providerConfigs' } }
    );
    ok('Authenticator-app 2FA is available. Users can set it up from their name (top right) → Two-Step Sign-In.');
  } catch (e) {
    fail(
      `Could not enable TOTP 2FA: ${apiError(e)}\n  In the Firebase console open Authentication → Settings and click "Upgrade" to Identity Platform, then run this again.`
    );
  }

  if (args.require) {
    step('Requiring 2FA for everyone...');
    try {
      await writeRequire2fa(true);
      ok('2FA is now REQUIRED: everyone sets it up at their next sign-in.');
    } catch (e) {
      fail(`Could not save settings/security: ${apiError(e)}`);
    }
  } else {
    console.log('\nNext: sign in, set up 2FA on your own account, sign in again with your code,');
    console.log('then (optionally) User Access → "Require 2FA for Everyone".');
  }
}

runMain(main);
