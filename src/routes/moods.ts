import express from 'express';
import { body, param, query } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { validateRequest } from '../middleware/validate';
import { MoodLog } from '../models/MoodLog';
import { resolveAccessibleUser } from '../services/accessService';

const router = express.Router();

router.post(
  '/',
  firebaseAuth,
  body('userUid').optional().isString().notEmpty(),
  body('mood').isInt({ min: 1, max: 5 }),
  body('note').optional().isString(),
  body('recordedAt').optional().isISO8601(),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const { error, targetUser } = await resolveAccessibleUser(requesterUid, req.body.userUid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });

      const moodLog = new MoodLog({
        userUid: targetUser!.uid,
        recordedByUid: requesterUid,
        mood: req.body.mood,
        note: req.body.note,
        recordedAt: req.body.recordedAt ? new Date(req.body.recordedAt) : new Date(),
      });

      await moodLog.save();
      res.status(201).json({ ok: true, moodLog });
    } catch (err: any) {
      console.error('Create mood log error', err);
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
      const moodLogs = await MoodLog.find({ userUid: uid }).sort({ recordedAt: -1 }).limit(limit);
      res.json({ ok: true, moodLogs });
    } catch (err: any) {
      console.error('List own mood logs error', err);
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
      const moodLogs = await MoodLog.find({ userUid: targetUser!.uid }).sort({ recordedAt: -1 }).limit(limit);
      res.json({ ok: true, moodLogs, user: { uid: targetUser!.uid, fullName: targetUser!.fullName } });
    } catch (err: any) {
      console.error('List user mood logs error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

export default router;
