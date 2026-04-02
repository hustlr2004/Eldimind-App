import express from 'express';
import { body, param } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { validateRequest } from '../middleware/validate';
import { Condition } from '../models/Condition';
import { resolveAccessibleUser } from '../services/accessService';

const router = express.Router();

router.post(
  '/',
  firebaseAuth,
  body('userUid').optional().isString().notEmpty(),
  body('name').isString().notEmpty(),
  body('notes').optional().isString(),
  body('diagnosedAt').optional().isISO8601(),
  body('active').optional().isBoolean(),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const { requester, error, targetUser } = await resolveAccessibleUser(requesterUid, req.body.userUid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });

      if (!(requester!.role === 'caretaker' || requester!.uid === targetUser!.uid)) {
        return res.status(403).json({ ok: false, error: 'Not authorized to add conditions' });
      }

      const condition = new Condition({
        userUid: targetUser!.uid,
        addedByUid: requesterUid,
        name: req.body.name,
        notes: req.body.notes,
        diagnosedAt: req.body.diagnosedAt ? new Date(req.body.diagnosedAt) : undefined,
        active: typeof req.body.active === 'boolean' ? req.body.active : true,
      });

      await condition.save();
      res.status(201).json({ ok: true, condition });
    } catch (err: any) {
      console.error('Create condition error', err);
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

      const conditions = await Condition.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 });
      res.json({ ok: true, conditions, user: { uid: targetUser!.uid, fullName: targetUser!.fullName } });
    } catch (err: any) {
      console.error('List conditions error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

export default router;
