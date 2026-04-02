import express from 'express';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { registerFcmToken, sendPushToUid } from '../services/notificationService';

const router = express.Router();

// Register FCM token for the current user
router.post('/register', firebaseAuth, async (req, res) => {
  try {
    const uid = req.auth?.uid;
    const { fcmToken } = req.body;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    if (!fcmToken) return res.status(400).json({ ok: false, error: 'Missing fcmToken' });

    const user = await registerFcmToken(uid, fcmToken);
    res.json({ ok: true, user });
  } catch (err: any) {
    console.error('Register FCM error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

// Send a notification to a user (for dev/admin use)
router.post('/send', firebaseAuth, async (req, res) => {
  try {
    const { uid, title, body } = req.body;
    if (!uid || !title || !body) return res.status(400).json({ ok: false, error: 'Missing fields' });
    const delivery = await sendPushToUid(uid, { title, body, priority: req.body.priority || 'normal' });
    res.json({ ok: true, delivery });
  } catch (err: any) {
    console.error('Send notification error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

export default router;
