import express from 'express';
import { body, param, query } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { validateRequest } from '../middleware/validate';
import { Vital } from '../models/Vital';
import { Alert } from '../models/Alert';
import { getCriticalVitalAlerts } from '../services/vitalsService';
import { notifyCaretakersOfUid } from '../services/notificationService';
import { resolveAccessibleUser } from '../services/accessService';
import { Condition } from '../models/Condition';

const router = express.Router();

router.post(
  '/',
  firebaseAuth,
  body('userUid').optional().isString().notEmpty(),
  body('source').optional().isIn(['manual', 'google_fit', 'smartwatch', 'meta_glasses', 'health_api']),
  body('heartRate').optional().isFloat({ min: 1 }),
  body('spo2').optional().isFloat({ min: 1, max: 100 }),
  body('bloodPressureSystolic').optional().isFloat({ min: 1 }),
  body('bloodPressureDiastolic').optional().isFloat({ min: 1 }),
  body('bodyTemperature').optional().isFloat(),
  body('temperatureUnit').optional().isIn(['F', 'C']),
  body('steps').optional().isInt({ min: 0 }),
  body('sleepHours').optional().isFloat({ min: 0 }),
  body('sleepDeepHours').optional().isFloat({ min: 0 }),
  body('sleepLightHours').optional().isFloat({ min: 0 }),
  body('respiratoryRate').optional().isFloat({ min: 1 }),
  body('recordedAt').optional().isISO8601(),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const { error, targetUser } = await resolveAccessibleUser(requesterUid, req.body.userUid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });

      const vital = new Vital({
        userUid: targetUser!.uid,
        recordedByUid: requesterUid,
        source: req.body.source || 'manual',
        heartRate: req.body.heartRate,
        spo2: req.body.spo2,
        bloodPressureSystolic: req.body.bloodPressureSystolic,
        bloodPressureDiastolic: req.body.bloodPressureDiastolic,
        bodyTemperature: req.body.bodyTemperature,
        temperatureUnit: req.body.temperatureUnit || 'F',
        steps: req.body.steps,
        sleepHours: req.body.sleepHours,
        sleepDeepHours: req.body.sleepDeepHours,
        sleepLightHours: req.body.sleepLightHours,
        respiratoryRate: req.body.respiratoryRate,
        recordedAt: req.body.recordedAt ? new Date(req.body.recordedAt) : new Date(),
      });

      await vital.save();

      const activeConditions =
        (Condition as any).db?.readyState === 1
          ? await Condition.find({ userUid: targetUser!.uid, active: { $ne: false } })
          : [];
      const criticalAlerts = getCriticalVitalAlerts(req.body, activeConditions);
      const createdAlerts: any[] = [];

      for (const item of criticalAlerts) {
        const alert = new Alert({
          userUid: targetUser!.uid,
          triggeredByUid: requesterUid,
          type: 'vital_spike',
          severity: 'critical',
          title: item.title,
          description: item.description,
          vitalType: item.vitalType,
          measuredValue: item.measuredValue,
          meta: { source: vital.source, recordedAt: vital.recordedAt },
        });
        await alert.save();
        createdAlerts.push(alert);
        await notifyCaretakersOfUid(targetUser!.uid, {
          title: item.title,
          body: `${targetUser!.fullName}: ${item.measuredValue}`,
          priority: 'critical',
        });
      }

      res.status(201).json({ ok: true, vital, alerts: createdAlerts });
    } catch (err: any) {
      console.error('Create vital error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

router.get(
  '/me',
  firebaseAuth,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  async (req, res) => {
    try {
      const uid = req.auth?.uid;
      if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
      const limit = Number(req.query.limit || 20);
      const vitals = await Vital.find({ userUid: uid }).sort({ recordedAt: -1 }).limit(limit);
      res.json({ ok: true, vitals });
    } catch (err: any) {
      console.error('List own vitals error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

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

      const { error, targetUser } = await resolveAccessibleUser(requesterUid, req.params.uid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });

      const limit = Number(req.query.limit || 20);
      const vitals = await Vital.find({ userUid: targetUser!.uid }).sort({ recordedAt: -1 }).limit(limit);
      res.json({ ok: true, vitals, user: { uid: targetUser!.uid, fullName: targetUser!.fullName } });
    } catch (err: any) {
      console.error('List user vitals error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

router.get(
  '/alerts/me',
  firebaseAuth,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  async (req, res) => {
    try {
      const uid = req.auth?.uid;
      if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
      const limit = Number(req.query.limit || 20);
      const alerts = await Alert.find({ userUid: uid }).sort({ createdAt: -1 }).limit(limit);
      res.json({ ok: true, alerts });
    } catch (err: any) {
      console.error('List own alerts error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

router.get(
  '/alerts/user/:uid',
  firebaseAuth,
  param('uid').isString().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const { error, targetUser } = await resolveAccessibleUser(requesterUid, req.params.uid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });

      const limit = Number(req.query.limit || 20);
      const alerts = await Alert.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 }).limit(limit);
      res.json({ ok: true, alerts, user: { uid: targetUser!.uid, fullName: targetUser!.fullName } });
    } catch (err: any) {
      console.error('List user alerts error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

export default router;
