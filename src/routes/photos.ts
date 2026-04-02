import express from 'express';
import { body, param, query } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { validateRequest } from '../middleware/validate';
import { resolveAccessibleUser } from '../services/accessService';
import { saveBase64Photo } from '../services/mediaStorageService';
import { PhotoJournal } from '../models/PhotoJournal';
import { callGeminiVision, callGeminiVisionFromBase64 } from '../services/aiService';
import { splitVisionAnalysis, detectDistressSignals } from '../services/aiInsightService';
import { PhotoAnalysis } from '../models/PhotoAnalysis';
import { Alert } from '../models/Alert';

const router = express.Router();

router.post(
  '/',
  firebaseAuth,
  body('userUid').optional().isString().notEmpty(),
  body('imageBase64').optional().isString().notEmpty(),
  body('imageUrl').optional().isString().isURL(),
  body('mimeType').optional().isString(),
  body('caption').optional().isString(),
  body('analyze').optional().isBoolean(),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
      const { error, targetUser } = await resolveAccessibleUser(requesterUid, req.body.userUid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });

      if (!req.body.imageBase64 && !req.body.imageUrl) {
        return res.status(400).json({ ok: false, error: 'Provide imageBase64 or imageUrl' });
      }

      let imageUrl = req.body.imageUrl as string | undefined;
      let fileName: string | undefined;
      let storageType: 'local' | 'remote' = imageUrl ? 'remote' : 'local';
      const mimeType = req.body.mimeType || 'image/jpeg';

      if (!imageUrl && req.body.imageBase64) {
        const stored = await saveBase64Photo(req.body.imageBase64, mimeType);
        imageUrl = stored.publicUrl;
        fileName = stored.fileName;
      }

      const photo = new PhotoJournal({
        userUid: targetUser!.uid,
        uploadedByUid: requesterUid,
        imageUrl,
        storageType,
        fileName,
        mimeType,
        caption: req.body.caption,
      });

      let photoAnalysis: any = null;
      if (req.body.analyze) {
        const analysis = req.body.imageBase64
          ? await callGeminiVisionFromBase64(req.body.imageBase64.replace(/^data:[^;]+;base64,/, ''), mimeType)
          : await callGeminiVision(imageUrl!);
        const { summary, caregiverNote } = splitVisionAnalysis(analysis.analysis);
        const distressSignals = detectDistressSignals(analysis.analysis, 'en');

        photoAnalysis = new PhotoAnalysis({
          userUid: targetUser!.uid,
          imageUrl,
          summary,
          caregiverNote,
          distressSignals,
        });
        await photoAnalysis.save();
        photo.analysisId = (photoAnalysis as any)._id;

        if (distressSignals.length) {
          await new Alert({
            userUid: targetUser!.uid,
            triggeredByUid: requesterUid,
            type: 'ai_distress',
            severity: 'warning',
            title: 'Uploaded photo needs review',
            description: `Photo analysis suggests: ${distressSignals.join(', ')}.`,
            meta: { source: 'photo_upload', imageUrl, distressSignals },
          }).save();
        }
      }

      await photo.save();

      res.status(201).json({ ok: true, photo, photoAnalysis });
    } catch (err: any) {
      console.error('Upload photo error', err);
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
      const limit = Number(req.query.limit || 50);
      const photos = await PhotoJournal.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 }).limit(limit);
      res.json({ ok: true, photos, user: { uid: targetUser!.uid, fullName: targetUser!.fullName } });
    } catch (err: any) {
      console.error('List photos error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

export default router;
