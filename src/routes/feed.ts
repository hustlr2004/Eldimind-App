import express from 'express';
import { param, query } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { validateRequest } from '../middleware/validate';
import { resolveAccessibleUser } from '../services/accessService';
import { Alert } from '../models/Alert';
import { MoodLog } from '../models/MoodLog';
import { MedicineLog } from '../models/MedicineLog';
import { SosEvent } from '../models/SosEvent';
import { Medicine } from '../models/Medicine';

const router = express.Router();

router.get(
  '/user/:uid',
  firebaseAuth,
  param('uid').isString().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const { requester, error, targetUser } = await resolveAccessibleUser(requesterUid, req.params.uid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });
      if (requester!.role !== 'caretaker' && requester!.uid !== targetUser!.uid) {
        return res.status(403).json({ ok: false, error: 'Not authorized for this feed' });
      }

      const limit = Number(req.query.limit || 20);

      const [alerts, moods, medicineLogs, sosEvents] = await Promise.all([
        Alert.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 }).limit(limit),
        MoodLog.find({ userUid: targetUser!.uid }).sort({ recordedAt: -1 }).limit(limit),
        MedicineLog.find({ userUid: targetUser!.uid }).sort({ timestamp: -1 }).limit(limit),
        SosEvent.find({ userUid: targetUser!.uid }).sort({ triggeredAt: -1 }).limit(limit),
      ]);

      const uniqueMedicineIds = Array.from(
        new Set(
          medicineLogs
            .map((log: any) => log.medicineId?.toString?.() || String(log.medicineId))
            .filter(Boolean)
        )
      );

      const medicines = await Promise.all(
        uniqueMedicineIds.map(async (medicineId) => {
          const medicine = await Medicine.findById(medicineId);
          return medicine ? [medicineId, medicine] : null;
        })
      );

      const medicineMap = new Map(
        medicines.filter(Boolean) as Array<[string, any]>
      );

      const items = [
        ...alerts.map((alert: any) => ({
          type: 'alert',
          timestamp: alert.createdAt,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
        })),
        ...moods.map((mood: any) => ({
          type: 'mood',
          timestamp: mood.recordedAt,
          severity: mood.mood <= 2 ? 'warning' : 'info',
          title: 'Mood check-in recorded',
          description: `Mood level ${mood.mood}${mood.note ? `: ${mood.note}` : ''}`,
        })),
        ...medicineLogs.map((log: any) => {
          const medicineId = log.medicineId?.toString?.() || String(log.medicineId);
          const medicine = medicineMap.get(medicineId);
          return {
            type: 'medicine_log',
            timestamp: log.timestamp,
            severity: log.action === 'skipped' ? 'warning' : 'info',
            title: `Medicine ${log.action}`,
            description: `${medicine?.name || 'Medicine'} was marked as ${log.action}.`,
          };
        }),
        ...sosEvents.map((event: any) => ({
          type: 'sos',
          timestamp: event.triggeredAt,
          severity: 'critical',
          title: 'SOS emergency event',
          description: event.message || event.reason || 'Emergency assistance requested.',
        })),
      ]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      res.json({
        ok: true,
        feed: items,
        user: { uid: targetUser!.uid, fullName: targetUser!.fullName },
      });
    } catch (err: any) {
      console.error('Get feed error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

export default router;
