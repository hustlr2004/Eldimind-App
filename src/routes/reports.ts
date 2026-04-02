import express from 'express';
import { param } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { validateRequest } from '../middleware/validate';
import { resolveAccessibleUser } from '../services/accessService';
import { Report } from '../models/Report';
import { createWeeklyReportPdf } from '../services/pdfReportService';
import { buildWeeklyReportForUser } from '../services/reportService';

const router = express.Router();

router.get(
  '/weekly/user/:uid',
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
        return res.status(403).json({ ok: false, error: 'Not authorized for this report' });
      }

      const report = await buildWeeklyReportForUser(targetUser!);

      res.json({ ok: true, report });
    } catch (err: any) {
      console.error('Weekly report error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

router.post(
  '/weekly/user/:uid/export',
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
        return res.status(403).json({ ok: false, error: 'Not authorized for this report export' });
      }

      const reportData = await buildWeeklyReportForUser(targetUser!);
      const pdf = await createWeeklyReportPdf(reportData);

      const record = await Report.create({
        userUid: targetUser!.uid,
        generatedByUid: requesterUid,
        type: 'weekly',
        periodStart: new Date(reportData.period.startDate),
        periodEnd: new Date(reportData.period.endDate),
        fileUrl: pdf.publicUrl,
        fileName: pdf.fileName,
      });

      res.status(201).json({ ok: true, report: record, downloadUrl: pdf.publicUrl });
    } catch (err: any) {
      console.error('Weekly report export error', err);
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
      const { requester, error, targetUser } = await resolveAccessibleUser(requesterUid, req.params.uid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });
      if (requester!.role !== 'caretaker' && requester!.uid !== targetUser!.uid) {
        return res.status(403).json({ ok: false, error: 'Not authorized for report list' });
      }

      const reports = await Report.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 }).limit(20);
      res.json({ ok: true, reports, user: { uid: targetUser!.uid, fullName: targetUser!.fullName } });
    } catch (err: any) {
      console.error('List reports error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

export default router;
