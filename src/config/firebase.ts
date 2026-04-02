import 'dotenv/config';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let initialized = false;

export function initFirebase() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (admin.apps.length) {
    initialized = true;
    return;
  }

  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!saPath) {
    console.warn('FIREBASE_SERVICE_ACCOUNT_PATH not set — firebase admin not initialized (dev mode)');
    return;
  }

  const resolvedPath = path.isAbsolute(saPath) ? saPath : path.resolve(process.cwd(), saPath);

  if (!fs.existsSync(resolvedPath)) {
    console.warn(`Service account file not found at ${resolvedPath} — firebase admin not initialized`);
    return;
  }

  const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    initialized = true;
    console.log('Firebase Admin initialized');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin', err);
  }
}

export function isFirebaseInitialized() {
  return initialized && !!admin.apps.length;
}

export { admin };
