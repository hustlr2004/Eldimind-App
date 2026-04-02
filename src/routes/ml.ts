import express from 'express';
import { param } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { validateRequest } from '../middleware/validate';
import { resolveAccessibleUser } from '../services/accessService';
import { Vital } from '../models/Vital';
import { MoodLog } from '../models/MoodLog';
import { Condition } from '../models/Condition';
import { Alert } from '../models/Alert';
import { scoreHealthRisk } from '../services/mlService';
import { User } from '../models/User';

const router = express.Router();

router.get(
  '/risk/user/:uid',
  firebaseAuth,
  param('uid').isString().notEmpty(),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const { requester, error, targetUser } = await resolveAccessibleUser(requesterUid, req.params.uid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });
      if (requester!.role !== 'caretaker' && requester!.uid !== targetUser!.uid) {
        return res.status(403).json({ ok: false, error: 'Not authorized for ML insights' });
      }

      const [vitals, moods, conditions, alerts] = await Promise.all([
        Vital.find({ userUid: targetUser!.uid }).sort({ recordedAt: -1 }).limit(10),
        MoodLog.find({ userUid: targetUser!.uid }).sort({ recordedAt: -1 }).limit(10),
        Condition.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 }),
        Alert.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 }).limit(10),
      ]);

      const mlResponse = await scoreHealthRisk({
        userUid: targetUser!.uid,
        vitals,
        moods,
        conditions,
        alerts,
      });

      const user = await User.findOne({ uid: targetUser!.uid });

      res.json({
        ok: true,
        user: { uid: targetUser!.uid, fullName: targetUser!.fullName },
        prediction: mlResponse,
        notificationGuidance: {
          doNotDisturbConfigured:
            Boolean(user?.preferences?.notifications?.doNotDisturbStart) &&
            Boolean(user?.preferences?.notifications?.doNotDisturbEnd),
          notificationsEnabled: user?.preferences?.notifications?.enabled !== false,
        },
      });
    } catch (err: any) {
      console.error('ML risk route error', err);
      res.status(500).json({ ok: false, error: err.message || 'ML service error' });
    }
  }
);

export default router;
