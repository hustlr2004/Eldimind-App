import express from 'express';
import { User } from '../models/User';
import { firebaseAuth } from '../middleware/firebaseAuth';

const router = express.Router();

// Create or update user (called after Firebase registration on client)
router.post('/', async (req, res) => {
  try {
    const { uid, fullName, email, phone, role } = req.body;
    if (!uid || !fullName || !role) return res.status(400).json({ ok: false, error: 'Missing fields' });

    let user = await User.findOne({ uid });
    if (!user) {
      user = new User({ uid, fullName, email, phone, role });
      await user.save();
    } else {
      user.fullName = fullName;
      if (email) user.email = email;
      if (phone) user.phone = phone;
      user.role = role;
      await user.save();
    }

    res.status(201).json({ ok: true, user });
  } catch (err: any) {
    console.error('Create user error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

// Get current user
router.get('/me', firebaseAuth, async (req, res) => {
  try {
    const uid = req.auth?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, user });
  } catch (err: any) {
    console.error('Get me error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

// Update current user
router.patch('/me', firebaseAuth, async (req, res) => {
  try {
    const uid = req.auth?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const updates = req.body;
  const user = await User.findOneAndUpdate({ uid }, { $set: updates }, { new: true });
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, user });
  } catch (err: any) {
    console.error('Update me error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

router.get('/links/me', firebaseAuth, async (req, res) => {
  try {
    const uid = req.auth?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const user = await User.findOne({ uid }).populate('linkedCaretakers').populate('linkedElders');
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    const linkedCaretakers = ((user as any).linkedCaretakers || []).map((item: any) => ({
      uid: item.uid,
      fullName: item.fullName,
      photoUrl: item.photoUrl || null,
    }));
    const linkedElders = ((user as any).linkedElders || []).map((item: any) => ({
      uid: item.uid,
      fullName: item.fullName,
      photoUrl: item.photoUrl || null,
    }));

    res.json({
      ok: true,
      links: {
        linkedCaretakers,
        linkedElders,
      },
    });
  } catch (err: any) {
    console.error('Get links error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

export default router;
