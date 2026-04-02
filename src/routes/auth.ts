import express from 'express';
import { body } from 'express-validator';
import { admin, isFirebaseInitialized, initFirebase } from '../config/firebase';
import { User } from '../models/User';
import { validateRequest } from '../middleware/validate';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { createSessionToken, getSessionCookieName, getSessionMaxAgeMs } from '../services/sessionService';

const router = express.Router();

initFirebase();

function isDevIdToken(idToken: string) {
  return idToken.startsWith('dev-');
}

async function resolveUidFromToken(idToken: string) {
  if (process.env.NODE_ENV !== 'production' && isDevIdToken(idToken)) {
    return { uid: idToken };
  }

  if (isFirebaseInitialized()) {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email };
  }

  return { uid: idToken };
}

function setSessionCookie(res: express.Response, token: string, rememberMe?: boolean) {
  res.cookie(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: getSessionMaxAgeMs(rememberMe),
  });
}

// Verify ID token (client can send { idToken } or Authorization: Bearer ...)
router.post('/verify', async (req, res) => {
  const idToken = req.body.idToken || (req.headers.authorization || '').replace(/^Bearer\s+/, '');

  if (!idToken) return res.status(400).json({ ok: false, error: 'Missing idToken' });

  try {
    const { uid } = await resolveUidFromToken(idToken);

    const user = await User.findOne({ uid });
    return res.json({ ok: true, uid, user });
  } catch (err: any) {
    console.error('Auth verify error', err);
    res.status(401).json({ ok: false, error: err.message || 'Invalid token' });
  }
});

router.post(
  '/session-login',
  body('idToken').isString().notEmpty(),
  body('rememberMe').optional().isBoolean(),
  body('profile.fullName').optional().isString().notEmpty(),
  body('profile.role').optional().isIn(['elder', 'caretaker']),
  body('profile.email').optional().isEmail(),
  body('profile.phone').optional().isString(),
  validateRequest,
  async (req, res) => {
    try {
      const { idToken, rememberMe, profile = {} } = req.body;
      const { uid, email } = await resolveUidFromToken(idToken);
      let user = await User.findOne({ uid });

      if (!user && (!profile.fullName || !profile.role)) {
        return res.status(400).json({
          ok: false,
          error: 'Profile fullName and role are required for first session login',
        });
      }

      if (!user) {
        user = new User({
          uid,
          fullName: profile.fullName,
          role: profile.role,
          email: profile.email || email,
          phone: profile.phone,
          linkedCaretakers: [],
          linkedElders: [],
          preferences: {},
          emergencyContacts: [],
          lastActiveAt: new Date(),
        });
      } else {
        if (profile.fullName) user.fullName = profile.fullName;
        if (profile.phone) user.phone = profile.phone;
        if (profile.email || email) user.email = profile.email || email;
        user.lastActiveAt = new Date();
      }

      await user.save();

      const sessionToken = createSessionToken({ uid, email: user.email, rememberMe });
      setSessionCookie(res, sessionToken, rememberMe);

      res.json({
        ok: true,
        uid,
        user,
        session: {
          cookieName: getSessionCookieName(),
          rememberMe: Boolean(rememberMe),
          expiresInMs: getSessionMaxAgeMs(rememberMe),
        },
      });
    } catch (err: any) {
      console.error('Session login error', err);
      res.status(401).json({ ok: false, error: err.message || 'Invalid token' });
    }
  }
);

router.get('/me', firebaseAuth, async (req, res) => {
  try {
    const uid = req.auth?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    user.lastActiveAt = new Date();
    await user.save();

    res.json({ ok: true, user });
  } catch (err: any) {
    console.error('Auth me error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(getSessionCookieName(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  res.json({ ok: true, loggedOut: true });
});

export default router;
