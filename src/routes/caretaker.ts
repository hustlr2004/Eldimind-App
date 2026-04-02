import express from 'express';
import { param } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { validateRequest } from '../middleware/validate';
import { resolveAccessibleUser } from '../services/accessService';
import { MoodLog } from '../models/MoodLog';
import { Vital } from '../models/Vital';
import { Alert } from '../models/Alert';
import { Condition } from '../models/Condition';
import { User } from '../models/User';

const router = express.Router();

function moodLabel(mood?: number) {
  switch (mood) {
    case 1:
      return 'Very Sad';
    case 2:
      return 'Sad';
    case 3:
      return 'Neutral';
    case 4:
      return 'Happy';
    case 5:
      return 'Very Happy';
    default:
      return null;
  }
}

function deriveStatusChip(latestAlert: any, latestMood: any) {
  if (latestAlert?.severity === 'critical') return 'Critical';
  if (latestAlert?.severity === 'warning') return 'Needs Attention';
  if (latestMood?.mood && latestMood.mood <= 2) return 'Needs Attention';
  return 'All Good';
}

router.get('/elders', firebaseAuth, async (req, res) => {
  try {
    const requesterUid = req.auth?.uid;
    if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const requester = await User.findOne({ uid: requesterUid }).populate('linkedElders');
    if (!requester) return res.status(404).json({ ok: false, error: 'Requesting user not found' });
    if (requester.role !== 'caretaker') {
      return res.status(403).json({ ok: false, error: 'Caretaker access required' });
    }

    const elders = ((requester as any).linkedElders || []).map((elder: any) => ({
      uid: elder.uid,
      fullName: elder.fullName,
      photoUrl: elder.photoUrl || null,
      lastActiveAt: elder.lastActiveAt || null,
    }));

    res.json({ ok: true, elders });
  } catch (err: any) {
    console.error('Caretaker elders list error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

router.get(
  '/elders/:uid/overview',
  firebaseAuth,
  param('uid').isString().notEmpty(),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const { requester, error, targetUser } = await resolveAccessibleUser(requesterUid, req.params.uid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });
      if (requester!.role !== 'caretaker') {
        return res.status(403).json({ ok: false, error: 'Caretaker access required' });
      }

      const [moods, vitals, alerts, conditions] = await Promise.all([
        MoodLog.find({ userUid: targetUser!.uid }).sort({ recordedAt: -1 }).limit(1),
        Vital.find({ userUid: targetUser!.uid }).sort({ recordedAt: -1 }).limit(1),
        Alert.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 }).limit(5),
        Condition.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 }),
      ]);

      const latestMood = moods[0] || null;
      const latestVital = vitals[0] || null;
      const recentAlerts = alerts || [];

      const overview = {
        elder: {
          uid: targetUser!.uid,
          fullName: targetUser!.fullName,
          photoUrl: targetUser!.photoUrl || null,
          age: (targetUser as any).age || null,
          lastActiveAt: targetUser!.lastActiveAt || null,
        },
        todayMood: latestMood
          ? {
              value: latestMood.mood,
              label: moodLabel(latestMood.mood),
              recordedAt: latestMood.recordedAt,
              note: latestMood.note || null,
            }
          : null,
        latestVitals: latestVital
          ? {
              heartRate: latestVital.heartRate ?? null,
              spo2: latestVital.spo2 ?? null,
              bloodPressureSystolic: latestVital.bloodPressureSystolic ?? null,
              bloodPressureDiastolic: latestVital.bloodPressureDiastolic ?? null,
              bodyTemperature: latestVital.bodyTemperature ?? null,
              temperatureUnit: latestVital.temperatureUnit ?? null,
              respiratoryRate: latestVital.respiratoryRate ?? null,
              steps: latestVital.steps ?? null,
              sleepHours: latestVital.sleepHours ?? null,
              recordedAt: latestVital.recordedAt,
            }
          : null,
        conditions: conditions.map((condition: any) => ({
          id: condition._id,
          name: condition.name,
          notes: condition.notes || null,
          active: condition.active,
          diagnosedAt: condition.diagnosedAt || null,
        })),
        recentAlerts: recentAlerts.map((alert: any) => ({
          id: alert._id,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          createdAt: alert.createdAt,
        })),
        statusChip: deriveStatusChip(recentAlerts[0], latestMood),
      };

      res.json({ ok: true, overview });
    } catch (err: any) {
      console.error('Caretaker overview error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

export default router;
