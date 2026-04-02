#!/usr/bin/env node
/*
  Usage:
    FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json node scripts/create-token.js <uid>

  This script creates a Firebase custom token using the service account JSON and prints it.
  Useful for testing `POST /api/auth/verify` when you don't have a client-side Firebase flow yet.
*/

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

async function main() {
  const uid = process.argv[2];
  if (!uid) {
    console.error('Usage: node scripts/create-token.js <uid>');
    process.exit(2);
  }

  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.SERVICE_ACCOUNT || './serviceAccountKey.json';
  if (!fs.existsSync(saPath)) {
    console.error('Service account JSON not found at', saPath);
    process.exit(2);
  }

  const serviceAccount = require(path.resolve(saPath));
  try {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (err) {
    // ignore if already initialized
  }

  try {
    const token = await admin.auth().createCustomToken(uid);
    console.log(token);
  } catch (err) {
    console.error('Failed to create custom token:', err);
    process.exit(1);
  }
}

main();
