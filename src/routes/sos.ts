import express from 'express';
import { body, param } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { validateRequest } from '../middleware/validate';
import { resolveAccessibleUser } from '../services/accessService';
import { SosEvent } from '../models/SosEvent';
import { Alert } from '../models/Alert';
import { notifyCaretakersOfUid } from '../services/notificationService';

const router = express.Router();

router.post(
  '/',
  firebaseAuth,
  body('userUid').optional().isString().notEmpty(),
  body('reason').optional().isString(),
  body('message').optional().isString(),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('triggeredAt').optional().isISO8601(),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const { error, targetUser } = await resolveAccessibleUser(requesterUid, req.body.userUid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });

      const triggeredAt = req.body.triggeredAt ? new Date(req.body.triggeredAt) : new Date();
      const sosEvent = new SosEvent({
        userUid: targetUser!.uid,
        triggeredByUid: requesterUid,
        reason: req.body.reason,
        message: req.body.message,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        status: 'triggered',
        triggeredAt,
      });
      await sosEvent.save();

      const locationText =
        typeof req.body.latitude === 'number' && typeof req.body.longitude === 'number'
          ? ` Location: ${req.body.latitude}, ${req.body.longitude}.`
          : '';

      const alert = new Alert({
        userUid: targetUser!.uid,
        triggeredByUid: requesterUid,
        type: 'sos',
        severity: 'critical',
        title: 'SOS emergency triggered',
        description: `${targetUser!.fullName} triggered SOS.${locationText}`,
        meta: {
          reason: req.body.reason || null,
          message: req.body.message || null,
          latitude: req.body.latitude ?? null,
          longitude: req.body.longitude ?? null,
          triggeredAt,
        },
      });
      await alert.save();

      await notifyCaretakersOfUid(targetUser!.uid, {
        title: 'SOS emergency triggered',
        body: `${targetUser!.fullName} needs help immediately.`,
        priority: 'critical',
      });

      res.status(201).json({ ok: true, sosEvent, alert });
    } catch (err: any) {
      console.error('Trigger SOS error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

router.get(
  '/me',
  firebaseAuth,
  async (req, res) => {
    try {
      const uid = req.auth?.uid;
      if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
      const events = await SosEvent.find({ userUid: uid }).sort({ triggeredAt: -1 }).limit(20);
      res.json({ ok: true, events });
    } catch (err: any) {
      console.error('List own SOS events error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

router.get(
  '/user/:uid',
  firebaseAuth,
  param('uid').isString().notEmpty(),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const { error, targetUser } = await resolveAccessibleUser(requesterUid, req.params.uid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });

      const events = await SosEvent.find({ userUid: targetUser!.uid }).sort({ triggeredAt: -1 }).limit(20);
      res.json({ ok: true, events, user: { uid: targetUser!.uid, fullName: targetUser!.fullName } });
    } catch (err: any) {
      console.error('List user SOS events error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

export default router;
