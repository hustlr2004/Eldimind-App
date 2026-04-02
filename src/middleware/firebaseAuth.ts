import { Request, Response, NextFunction } from 'express';
import { admin, initFirebase, isFirebaseInitialized } from '../config/firebase';
import { getSessionCookieName, verifySessionToken } from '../services/sessionService';

initFirebase();

declare global {
  namespace Express {
    interface Request {
      auth?: {
        uid: string;
        email?: string;
      };
    }
  }
}

export async function firebaseAuth(req: Request, res: Response, next: NextFunction) {
  // Authorization: Bearer <idToken>
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const sessionToken = req.cookies?.[getSessionCookieName()];
  const session = verifySessionToken(sessionToken);

  // Development shortcut: allow X-DEV-UID header
  const devUid = req.headers['x-dev-uid'] as string | undefined;
  if (!token && devUid && process.env.NODE_ENV !== 'production') {
    req.auth = { uid: devUid };
    return next();
  }

  if (!token && session) {
    req.auth = { uid: session.uid, email: session.email };
    return next();
  }

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Missing Authorization token' });
  }

  if (process.env.NODE_ENV !== 'production' && token.startsWith('dev-')) {
    req.auth = { uid: token };
    return next();
  }

  if (!isFirebaseInitialized()) {
    // If firebase is not initialized (local dev), accept token as uid for convenience
    req.auth = { uid: token };
    return next();
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.auth = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (err) {
    console.error('Token verify failed', err);
    res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}
