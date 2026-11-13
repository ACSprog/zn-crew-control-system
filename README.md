<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/33b74f1d-975c-491a-96d7-ace7a8a76942

## Run Locally

**Prerequisites:**  Node.js, Firebase CLI

> This branch runs entirely on free tiers (Firebase Spark + Microsoft 365).
> Sign-in, 2FA and user accounts: [docs/LOGIN_AND_2FA.md](docs/LOGIN_AND_2FA.md).
> See [docs/FREE_TIER.md](docs/FREE_TIER.md) for what changed and how to set up the
> Power Automate notification flow.

1. Install dependencies: `npm install`
2. Start the local emulators: `npm run emulators`
3. Run the app: `npm run dev`
4. Deploy (hosting + Firestore rules only): `npm run deploy`
