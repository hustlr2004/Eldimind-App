import express from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middleware/validate';
import { callGeminiChat, callGeminiVision } from '../services/aiService';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { ChatMessage } from '../models/ChatMessage';
import { PhotoAnalysis } from '../models/PhotoAnalysis';
import { Alert } from '../models/Alert';
import { detectDistressSignals, splitVisionAnalysis } from '../services/aiInsightService';
import { notifyCaretakersOfUid } from '../services/notificationService';
import { resolveAccessibleUser } from '../services/accessService';

function detectLanguage(text: string) {
  if (!text) return 'en';
  // simple Unicode heuristics: Devanagari (Hindi), Kannada range
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  if (hasDevanagari) return 'hi';
  const hasKannada = /[\u0C80-\u0CFF]/.test(text);
  if (hasKannada) return 'kn';
  // fallback to English
  return 'en';
}

function countSignalOccurrences(items: string[]) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item] = (counts[item] || 0) + 1;
  }
  return counts;
}

const router = express.Router();

// POST /api/ai/chat
import { aiLimiter } from '../middleware/rateLimiter';

router.post('/chat',
  aiLimiter,
  firebaseAuth,
  body('message').isString().notEmpty(),
  validateRequest,
  async (req, res) => {
    try {
      const uid = req.auth?.uid;
      if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
      const { message } = req.body;

      const lang = detectLanguage(message || '');
      const distressSignals = detectDistressSignals(message || '', lang);
      const recentMessages = await ChatMessage.find({ userUid: uid }).sort({ createdAt: -1 }).limit(8);
      const history = [...recentMessages]
        .reverse()
        .map((entry: any) => ({ role: entry.role, text: entry.text }));

      const userMessage = new ChatMessage({
        userUid: uid,
        role: 'user',
        text: message,
        language: lang,
        distressSignals,
      });
      await userMessage.save();

      if (distressSignals.length) {
        const alert = new Alert({
          userUid: uid,
          triggeredByUid: uid,
          type: 'ai_distress',
          severity: 'warning',
          title: 'Possible emotional distress detected',
          description: `Detected signals: ${distressSignals.join(', ')}.`,
          meta: { source: 'chat', distressSignals },
        });
        await alert.save();
        await notifyCaretakersOfUid(uid, {
          title: 'EldiMind Buddy noticed distress',
          body: `Possible concern detected: ${distressSignals.join(', ')}`,
          priority: 'critical',
        });
      }

      const result = await callGeminiChat(uid, message, { lang, history });

      const assistantMessage = new ChatMessage({
        userUid: uid,
        role: 'assistant',
        text: result.text,
        language: lang,
        distressSignals: [],
      });
      await assistantMessage.save();

      res.json({ ok: true, response: result, distressSignals });
    } catch (err: any) {
      console.error('AI chat error', err);
      res.status(500).json({ ok: false, error: err.message || 'AI error' });
    }
  }
);

// POST /api/ai/vision
router.post('/vision',
  firebaseAuth,
  body('userUid').optional().isString().notEmpty(),
  body('imageUrl').isString().notEmpty().isURL(),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const { error, targetUser } = await resolveAccessibleUser(requesterUid, req.body.userUid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });

      const { imageUrl } = req.body;
      const analysis = await callGeminiVision(imageUrl);
      const { summary, caregiverNote } = splitVisionAnalysis(analysis.analysis);
      const distressSignals = detectDistressSignals(analysis.analysis, 'en');

      const photoAnalysis = new PhotoAnalysis({
        userUid: targetUser!.uid,
        imageUrl,
        summary,
        caregiverNote,
        distressSignals,
      });
      await photoAnalysis.save();

      if (distressSignals.length) {
        const alert = new Alert({
          userUid: targetUser!.uid,
          triggeredByUid: requesterUid,
          type: 'ai_distress',
          severity: 'warning',
          title: 'Photo analysis needs review',
          description: `Photo analysis suggests: ${distressSignals.join(', ')}.`,
          meta: { source: 'vision', imageUrl, distressSignals },
        });
        await alert.save();
      }

      res.json({ ok: true, analysis, photoAnalysis });
    } catch (err: any) {
      console.error('AI vision error', err);
      res.status(500).json({ ok: false, error: err.message || 'AI error' });
    }
  }
);

router.get(
  '/chat/me',
  firebaseAuth,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  async (req, res) => {
    try {
      const uid = req.auth?.uid;
      if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
      const limit = Number(req.query.limit || 50);
      const messages = await ChatMessage.find({ userUid: uid }).sort({ createdAt: -1 }).limit(limit);
      res.json({ ok: true, messages });
    } catch (err: any) {
      console.error('Get chat history error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

router.get(
  '/chat/user/:uid',
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
        return res.status(403).json({ ok: false, error: 'Not authorized for this chat history' });
      }
      const limit = Number(req.query.limit || 50);
      const messages = await ChatMessage.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 }).limit(limit);
      res.json({ ok: true, messages, user: { uid: targetUser!.uid, fullName: targetUser!.fullName } });
    } catch (err: any) {
      console.error('Get user chat history error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

router.get(
  '/photos/user/:uid',
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
      const photos = await PhotoAnalysis.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 }).limit(limit);
      res.json({ ok: true, photos, user: { uid: targetUser!.uid, fullName: targetUser!.fullName } });
    } catch (err: any) {
      console.error('Get photo analysis history error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

router.get(
  '/insights/user/:uid',
  firebaseAuth,
  param('uid').isString().notEmpty(),
  validateRequest,
  async (req, res) => {
    try {
      const requesterUid = req.auth?.uid;
      if (!requesterUid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
      const { requester, error, targetUser } = await resolveAccessibleUser(requesterUid, req.params.uid);
      if (error) return res.status(error.status).json({ ok: false, error: error.message });
      if (requester!.role !== 'caretaker') {
        return res.status(403).json({ ok: false, error: 'Caretaker access required' });
      }

      const [messages, photos, alerts] = await Promise.all([
        ChatMessage.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 }).limit(25),
        PhotoAnalysis.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 }).limit(10),
        Alert.find({ userUid: targetUser!.uid }).sort({ createdAt: -1 }).limit(25),
      ]);

      const chatSignals = messages.flatMap((message: any) => message.distressSignals || []);
      const photoSignals = photos.flatMap((photo: any) => photo.distressSignals || []);
      const signalCounts = countSignalOccurrences([...chatSignals, ...photoSignals]);
      const topSignals = Object.entries(signalCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([signal, count]) => ({ signal, count }));

      const insights = {
        user: {
          uid: targetUser!.uid,
          fullName: targetUser!.fullName,
        },
        chat: {
          totalMessagesReviewed: messages.length,
          flaggedMessages: messages.filter((message: any) => (message.distressSignals || []).length > 0).length,
          latestMessageAt: messages[0]?.createdAt || null,
        },
        photos: {
          totalPhotosReviewed: photos.length,
          flaggedPhotos: photos.filter((photo: any) => (photo.distressSignals || []).length > 0).length,
          latestPhotoAt: photos[0]?.createdAt || null,
        },
        alerts: {
          aiDistressAlerts: alerts.filter((alert: any) => alert.type === 'ai_distress').length,
          latestAlertAt: alerts[0]?.createdAt || null,
        },
        topSignals,
        summary:
          topSignals.length > 0
            ? `Most frequent AI concern signals: ${topSignals
                .slice(0, 3)
                .map((item) => `${item.signal} (${item.count})`)
                .join(', ')}.`
            : 'No repeated AI distress patterns detected recently.',
      };

      res.json({ ok: true, insights });
    } catch (err: any) {
      console.error('Get AI insights error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

export default router;
