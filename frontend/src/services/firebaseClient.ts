import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function hasFirebaseConfig() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID
  );
}

export function getFirebaseAuth() {
  if (!hasFirebaseConfig()) return null;
  if (!app) {
    app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
    auth = getAuth(app);
  }
  return auth;
}

export async function getFrontendIdToken(fullName: string, role: string) {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    return `dev-${role}-${fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  const credential = await signInAnonymously(firebaseAuth);
  return credential.user.getIdToken();
}
