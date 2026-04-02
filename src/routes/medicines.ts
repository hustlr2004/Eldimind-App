import express from 'express';
import { body, param } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { Medicine } from '../models/Medicine';
import { MedicineLog } from '../models/MedicineLog';
import { Reminder } from '../models/Reminder';
import { notifyCaretakersOfUid } from '../services/notificationService';
import { validateRequest } from '../middleware/validate';
import { resolveAccessibleUser } from '../services/accessService';

const router = express.Router();

async function resolveMedicineAccess(requesterUid: string, medicineId: string) {
  const medicine = await Medicine.findById(medicineId);
  if (!medicine) {
    return { error: { status: 404, message: 'Medicine not found' } };
  }

  const access = await resolveAccessibleUser(requesterUid, medicine.userUid);
  if (access.error) {
    return { error: access.error };
  }

  return { medicine, requester: access.requester, targetUser: access.targetUser };
}

// Create medicine (elder or caretaker)
router.post('/',
  firebaseAuth,
  body('name').isString().notEmpty(),
  body('scheduleTimes').optional().isArray(),
  validateRequest,
  async (req, res) => {
  try {
    const uid = req.auth?.uid;
    const { name, dosage, scheduleTimes = [], startDate, endDate, notes, userUid } = req.body;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    if (!name) return res.status(400).json({ ok: false, error: 'Missing name' });

    const { error, targetUser } = await resolveAccessibleUser(uid, userUid);
    if (error) return res.status(error.status).json({ ok: false, error: error.message });

    const med = new Medicine({
      userUid: targetUser!.uid,
      name,
      dosage,
      scheduleTimes,
      startDate,
      endDate,
      notes,
    });
    await med.save();

    // create reminders for next occurrence for each schedule time
    const now = new Date();
    for (const t of scheduleTimes) {
      // t format HH:MM
      const [hh, mm] = t.split(':').map((s: string) => parseInt(s, 10));
      const due = new Date(now);
      due.setHours(hh, mm, 0, 0);
      if (due < now) due.setDate(due.getDate() + 1);
      const r = new Reminder({ medicineId: med._id, userUid: targetUser!.uid, dueAt: due });
      await r.save();
    }

    res.status(201).json({ ok: true, medicine: med });
  } catch (err: any) {
    console.error('Create medicine error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

// List medicines for current user
router.get('/me', firebaseAuth, async (req, res) => {
  try {
    const uid = req.auth?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const meds = await Medicine.find({ userUid: uid });
    res.json({ ok: true, medicines: meds });
  } catch (err: any) {
    console.error('List medicines error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

// List medicines for a specific elder if requester has access
router.get('/user/:uid',
  firebaseAuth,
  param('uid').isString().notEmpty(),
  validateRequest,
  async (req, res) => {
  try {
    const requesterUid = req.auth?.uid;
    if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const { error, targetUser } = await resolveAccessibleUser(requesterUid, req.params.uid);
    if (error) return res.status(error.status).json({ ok: false, error: error.message });
    const medicines = await Medicine.find({ userUid: targetUser!.uid });
    res.json({ ok: true, medicines, user: { uid: targetUser!.uid, fullName: targetUser!.fullName } });
  } catch (err: any) {
    console.error('List user medicines error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

router.patch('/:id',
  firebaseAuth,
  param('id').isString().notEmpty(),
  body('name').optional().isString().notEmpty(),
  body('dosage').optional().isString(),
  body('scheduleTimes').optional().isArray(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('notes').optional().isString(),
  validateRequest,
  async (req, res) => {
  try {
    const requesterUid = req.auth?.uid;
    if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const { error, medicine } = await resolveMedicineAccess(requesterUid, req.params.id);
    if (error) return res.status(error.status).json({ ok: false, error: error.message });

    const updates: any = {};
    const allowedFields = ['name', 'dosage', 'scheduleTimes', 'notes'];
    for (const field of allowedFields) {
      if (field in req.body) updates[field] = req.body[field];
    }
    if (req.body.startDate) updates.startDate = new Date(req.body.startDate);
    if (req.body.endDate) updates.endDate = new Date(req.body.endDate);

    const updated = await Medicine.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });

    if (Array.isArray(req.body.scheduleTimes)) {
      await Reminder.deleteMany({ medicineId: medicine!._id });
      const now = new Date();
      for (const t of req.body.scheduleTimes) {
        const [hh, mm] = t.split(':').map((s: string) => parseInt(s, 10));
        const due = new Date(now);
        due.setHours(hh, mm, 0, 0);
        if (due < now) due.setDate(due.getDate() + 1);
        await new Reminder({ medicineId: medicine!._id, userUid: medicine!.userUid, dueAt: due }).save();
      }
    }

    res.json({ ok: true, medicine: updated });
  } catch (err: any) {
    console.error('Update medicine error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

router.delete('/:id',
  firebaseAuth,
  param('id').isString().notEmpty(),
  validateRequest,
  async (req, res) => {
  try {
    const requesterUid = req.auth?.uid;
    if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const { error, medicine } = await resolveMedicineAccess(requesterUid, req.params.id);
    if (error) return res.status(error.status).json({ ok: false, error: error.message });

    await Reminder.deleteMany({ medicineId: medicine!._id });
    await MedicineLog.deleteMany({ medicineId: medicine!._id });
    await Medicine.findByIdAndDelete(req.params.id);

    res.json({ ok: true, deleted: true });
  } catch (err: any) {
    console.error('Delete medicine error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

router.get('/:id/history',
  firebaseAuth,
  param('id').isString().notEmpty(),
  validateRequest,
  async (req, res) => {
  try {
    const requesterUid = req.auth?.uid;
    if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const { error, medicine } = await resolveMedicineAccess(requesterUid, req.params.id);
    if (error) return res.status(error.status).json({ ok: false, error: error.message });

    const logs = await MedicineLog.find({ medicineId: medicine!._id }).sort({ timestamp: -1 }).limit(100);
    res.json({ ok: true, medicine, logs });
  } catch (err: any) {
    console.error('Medicine history error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

// Mark taken or skipped
router.post('/:id/taken',
  firebaseAuth,
  param('id').isString().notEmpty(),
  body('action').isIn(['taken', 'skipped']),
  validateRequest,
  async (req, res) => {
  try {
    const uid = req.auth?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const { action } = req.body; // 'taken' | 'skipped'
    if (!['taken', 'skipped'].includes(action)) return res.status(400).json({ ok: false, error: 'Invalid action' });

    const { error, medicine } = await resolveMedicineAccess(uid, req.params.id);
    if (error) return res.status(error.status).json({ ok: false, error: error.message });

    const log = new MedicineLog({ medicineId: medicine!._id, userUid: medicine!.userUid, action, timestamp: new Date() });
    await log.save();

    // Acknowledge any pending reminders for this medicine within a window (e.g., last 6 hours)
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
    await Reminder.updateMany({ medicineId: medicine!._id, dueAt: { $gte: cutoff }, acknowledged: false }, { $set: { acknowledged: true } });

    if (action === 'skipped') {
      await notifyCaretakersOfUid(medicine!.userUid, {
        title: 'Medicine skipped',
        body: `${medicine!.name} was marked as skipped.`,
        priority: 'normal',
      });
    }

    res.json({ ok: true, log });
  } catch (err: any) {
    console.error('Mark taken error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

export default router;
