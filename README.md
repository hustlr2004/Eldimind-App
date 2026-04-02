# EldiMind — Backend scaffold

This repository contains a TypeScript Express backend for EldiMind with elder/caretaker health flows, Gemini-backed AI endpoints, a FastAPI ML integration scaffold, PDF report export, and realtime call signaling.

AI notes

- The AI proxy is configured for Gemini.
- Set `GEMINI_API_KEY` in `.env` to enable real chat and image analysis responses.
- A FastAPI ML microservice scaffold lives in `ml_service/`.
- Session cookie support is available through `/api/auth/session-login` and protected routes accept either a Firebase bearer token or the signed session cookie.

Quick start

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies:

```bash
npm install
```

3. Run in development mode:

```bash
npm run dev
```

Tests

```bash
npm test
```

Notes

- Firebase Admin requires a service account JSON for token verification. For local development the middleware will allow requests if Firebase is not configured, but you should provide credentials for production.
- Background jobs automatically materialize reminders and generate weekly reports outside the test environment.
- To wire real Firebase Auth verification follow the steps below.

Wiring real Firebase Auth (step-by-step)

1) Create a Firebase project
	- Visit https://console.firebase.google.com and create a new project (or use an existing one).
	- In Authentication > Sign-in method enable Email/Password and Phone (if you need OTP via Firebase).

2) Create a service account JSON (for server-side verification)
	- In the Firebase console go to Project Settings -> Service accounts -> Generate new private key. Save the JSON file locally as `serviceAccountKey.json`.
	- Put the file somewhere safe in your machine and do NOT commit it to git.

3) Configure the backend to use the service account
	- Set `FIREBASE_SERVICE_ACCOUNT_PATH` in your `.env` to the path of the JSON file (e.g. `./serviceAccountKey.json`).
	- Optionally set `FIREBASE_PROJECT_ID` to the project id.

4) Test token verification locally
	- You can either sign up a real user using the Firebase client SDK (in your frontend) and obtain an ID token, or use the helper below to mint a custom token for a given uid.

	- Helper to generate a custom token (for quick server-side testing):

	  ```bash
	  # ensure FIREBASE_SERVICE_ACCOUNT_PATH points to your service account JSON
	  FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json node scripts/create-token.js my-test-uid
	  ```

	  That prints a Firebase custom token. Exchange the custom token for an ID token in a client (e.g., using the Firebase JS SDK signInWithCustomToken) or --- for quick verification in this scaffold --- the server's verify endpoint accepts the custom token as the idToken in dev mode.

5) Call the backend verify endpoint

	- Example using curl (replace <TOKEN> with the token printed above):

	  ```bash
	  curl -X POST http://localhost:4000/api/auth/verify -H "Content-Type: application/json" -d '{"idToken":"<TOKEN>"}'
	  ```

	- If Firebase Admin is initialized correctly, the server will verify the token and return `uid` and any existing `user` profile from MongoDB.

Security notes

- Never commit service account JSON or secret keys into source control. Use environment variables or secrets manager in production.
- The scaffold supports a development shortcut header `x-dev-uid: <uid>` for local testing only (not for production).
