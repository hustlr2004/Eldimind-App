import express from 'express';
import { body, param } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { validateRequest } from '../middleware/validate';
import { resolveAccessibleUser } from '../services/accessService';
import { LocationLog } from '../models/LocationLog';

const router = express.Router();

router.post(
  '/',
  firebaseAuth,
  body('userUid').optional().isString().notEmpty(),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  body('accuracy').optional().isFloat({ min: 0 }),
  body('source').optional().isIn(['gps', 'manual', 'device']),
  body('recordedAt').optional().isISO8601(),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const { error, targetUser } = await resolveAccessibleUser(requesterUid, req.body.userUid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });

      const location = new LocationLog({
        userUid: targetUser!.uid,
        recordedByUid: requesterUid,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        accuracy: req.body.accuracy,
        source: req.body.source || 'gps',
        recordedAt: req.body.recordedAt ? new Date(req.body.recordedAt) : new Date(),
      });

      await location.save();
      res.status(201).json({ ok: true, location });
    } catch (err: any) {
      console.error('Create location log error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

router.get(
  '/me/latest',
  firebaseAuth,
  async (req, res) => {
    try {
      const uid = req.auth?.uid;
      if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
      const locations = await LocationLog.find({ userUid: uid }).sort({ recordedAt: -1 }).limit(1);
      res.json({ ok: true, location: locations[0] || null });
    } catch (err: any) {
      console.error('Get own latest location error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

router.get(
  '/user/:uid/latest',
  firebaseAuth,
  param('uid').isString().notEmpty(),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const { error, targetUser } = await resolveAccessibleUser(requesterUid, req.params.uid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });

      const locations = await LocationLog.find({ userUid: targetUser!.uid }).sort({ recordedAt: -1 }).limit(1);
      res.json({
        ok: true,
        location: locations[0] || null,
        user: { uid: targetUser!.uid, fullName: targetUser!.fullName },
      });
    } catch (err: any) {
      console.error('Get user latest location error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

export default router;
