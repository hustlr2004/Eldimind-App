import express from 'express';
import { body } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { LinkOtp } from '../models/LinkOtp';
import { User } from '../models/User';
import { validateRequest } from '../middleware/validate';
import { otpLimiter } from '../middleware/rateLimiter';

const router = express.Router();

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Elder generates an OTP to share with caretaker (protected)
router.post('/generate-otp', otpLimiter, firebaseAuth, async (req, res) => {
  try {
    const uid = req.auth?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const elder = await User.findOne({ uid });
    if (!elder) return res.status(404).json({ ok: false, error: 'Elder not found' });
    if (elder.role !== 'elder') return res.status(403).json({ ok: false, error: 'Only elders can generate OTP' });

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const otp = new LinkOtp({ code, elderUid: uid, expiresAt });
    await otp.save();

    // In production we'd show the OTP on elder's device and not return it via API; for dev return it.
    res.json({ ok: true, code, expiresAt });
  } catch (err: any) {
    console.error('Generate OTP error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

// Caretaker verifies OTP to link with elder
router.post('/verify-otp',
  firebaseAuth,
  body('code').isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
  validateRequest,
  async (req, res) => {
  try {
    const uid = req.auth?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const caretaker = await User.findOne({ uid });
    if (!caretaker) return res.status(404).json({ ok: false, error: 'Caretaker not found' });
    if (caretaker.role !== 'caretaker') return res.status(403).json({ ok: false, error: 'Only caretakers can verify OTP' });

    const { code } = req.body;
    if (!code) return res.status(400).json({ ok: false, error: 'Missing code' });

    const otp = await LinkOtp.findOne({ code });
    if (!otp) return res.status(404).json({ ok: false, error: 'OTP not found' });
    if (otp.used) return res.status(400).json({ ok: false, error: 'OTP already used' });
    if (otp.expiresAt.getTime() < Date.now()) return res.status(400).json({ ok: false, error: 'OTP expired' });

    const elder = await User.findOne({ uid: otp.elderUid });
    if (!elder) return res.status(404).json({ ok: false, error: 'Elder not found' });

    // Link them (avoid duplicates)
    const elderId = (elder as any)._id;
    const caretakerId = (caretaker as any)._id;

    if (!elder.linkedCaretakers) elder.linkedCaretakers = [];
    if (!caretaker.linkedElders) caretaker.linkedElders = [];

    if (!elder.linkedCaretakers.some((id: any) => id.toString() === caretakerId.toString())) {
      elder.linkedCaretakers.push(caretakerId);
    }
    if (!caretaker.linkedElders.some((id: any) => id.toString() === elderId.toString())) {
      caretaker.linkedElders.push(elderId);
    }

    await elder.save();
    await caretaker.save();

    otp.used = true;
    await otp.save();

    res.json({ ok: true, elder: { uid: elder.uid, fullName: elder.fullName }, caretaker: { uid: caretaker.uid, fullName: caretaker.fullName } });
  } catch (err: any) {
    console.error('Verify OTP error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

export default router;
