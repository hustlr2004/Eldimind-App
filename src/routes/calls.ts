import express from 'express';
import { body, param } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { validateRequest } from '../middleware/validate';
import { resolveAccessibleUser } from '../services/accessService';
import { CallLog } from '../models/CallLog';

const router = express.Router();

router.post(
  '/missed',
  firebaseAuth,
  body('elderUid').isString().notEmpty(),
  body('caretakerUid').isString().notEmpty(),
  body('type').optional().isIn(['voice', 'video']),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
      const { error } = await resolveAccessibleUser(requesterUid, req.body.elderUid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });

      const log = await CallLog.create({
        elderUid: req.body.elderUid,
        caretakerUid: req.body.caretakerUid,
        type: req.body.type || 'video',
        status: 'missed',
        startedAt: req.body.startedAt ? new Date(req.body.startedAt) : undefined,
        endedAt: req.body.endedAt ? new Date(req.body.endedAt) : undefined,
      });

      res.status(201).json({ ok: true, callLog: log });
    } catch (err: any) {
      console.error('Create missed call log error', err);
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

      const logs = await CallLog.find({
        $or: [{ elderUid: targetUser!.uid }, { caretakerUid: targetUser!.uid }],
      })
        .sort({ createdAt: -1 })
        .limit(50);

      res.json({ ok: true, logs, user: { uid: targetUser!.uid, fullName: targetUser!.fullName } });
    } catch (err: any) {
      console.error('List call logs error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

export default router;
