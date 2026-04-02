import express from 'express';
import { body, param } from 'express-validator';
import { firebaseAuth } from '../middleware/firebaseAuth';
import { validateRequest } from '../middleware/validate';
import { User } from '../models/User';
import { resolveAccessibleUser } from '../services/accessService';

const router = express.Router();

function defaultPreferences(preferences: any = {}) {
  return {
    language: preferences.language || 'en',
    fontSize: preferences.fontSize || 'normal',
    theme: preferences.theme || 'light',
    fallSensitivity: preferences.fallSensitivity || 'medium',
    notifications: {
      enabled: preferences.notifications?.enabled ?? true,
      sound: preferences.notifications?.sound ?? true,
      vibration: preferences.notifications?.vibration ?? true,
      doNotDisturbStart: preferences.notifications?.doNotDisturbStart || null,
      doNotDisturbEnd: preferences.notifications?.doNotDisturbEnd || null,
    },
    deviceConnections: preferences.deviceConnections || {
      googleFit: { status: 'disconnected', lastSyncAt: null },
      smartwatch: { status: 'disconnected', lastSyncAt: null },
      metaGlasses: { status: 'disconnected', lastSyncAt: null },
      manualEntry: { status: 'connected', lastSyncAt: null },
    },
  };
}

router.get('/me', firebaseAuth, async (req, res) => {
  try {
    const uid = req.auth?.uid;
    if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    res.json({
      ok: true,
      preferences: defaultPreferences(user.preferences),
      emergencyContacts: user.emergencyContacts || [],
    });
  } catch (err: any) {
    console.error('Get settings error', err);
    res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
});

router.patch(
  '/me',
  firebaseAuth,
  body('language').optional().isIn(['en', 'hi', 'kn']),
  body('fontSize').optional().isIn(['normal', 'large', 'extra_large']),
  body('theme').optional().isIn(['light', 'dark', 'high_contrast']),
  body('fallSensitivity').optional().isIn(['low', 'medium', 'high']),
  body('notifications.enabled').optional().isBoolean(),
  body('notifications.sound').optional().isBoolean(),
  body('notifications.vibration').optional().isBoolean(),
  body('notifications.doNotDisturbStart').optional({ nullable: true }).isString(),
  body('notifications.doNotDisturbEnd').optional({ nullable: true }).isString(),
  body('deviceConnections.googleFit.status').optional().isIn(['connected', 'syncing', 'disconnected']),
  body('deviceConnections.googleFit.lastSyncAt').optional({ nullable: true }).isISO8601(),
  body('deviceConnections.smartwatch.status').optional().isIn(['connected', 'syncing', 'disconnected']),
  body('deviceConnections.smartwatch.lastSyncAt').optional({ nullable: true }).isISO8601(),
  body('deviceConnections.metaGlasses.status').optional().isIn(['connected', 'syncing', 'disconnected']),
  body('deviceConnections.metaGlasses.lastSyncAt').optional({ nullable: true }).isISO8601(),
  body('deviceConnections.manualEntry.status').optional().isIn(['connected', 'syncing', 'disconnected']),
  body('deviceConnections.manualEntry.lastSyncAt').optional({ nullable: true }).isISO8601(),
  validateRequest,
  async (req, res) => {
    try {
      const uid = req.auth?.uid;
      if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const user = await User.findOne({ uid });
      if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

      const existing = defaultPreferences(user.preferences);
      user.preferences = {
        ...existing,
        ...(req.body.language ? { language: req.body.language } : {}),
        ...(req.body.fontSize ? { fontSize: req.body.fontSize } : {}),
        ...(req.body.theme ? { theme: req.body.theme } : {}),
        ...(req.body.fallSensitivity ? { fallSensitivity: req.body.fallSensitivity } : {}),
        notifications: {
          ...existing.notifications,
          ...(req.body.notifications || {}),
        },
        deviceConnections: {
          ...existing.deviceConnections,
          ...(req.body.deviceConnections || {}),
        },
      };

      await user.save();

      res.json({
        ok: true,
        preferences: defaultPreferences(user.preferences),
      });
    } catch (err: any) {
      console.error('Update settings error', err);
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
      if (requester!.role !== 'caretaker') {
        return res.status(403).json({ ok: false, error: 'Caretaker access required' });
      }

      res.json({
        ok: true,
        preferences: defaultPreferences(targetUser!.preferences),
        emergencyContacts: targetUser!.emergencyContacts || [],
        user: { uid: targetUser!.uid, fullName: targetUser!.fullName },
      });
    } catch (err: any) {
      console.error('Get user settings error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

router.post(
  '/emergency-contacts',
  firebaseAuth,
  body('name').isString().notEmpty(),
  body('phone').isString().notEmpty(),
  body('relationship').optional().isString(),
  validateRequest,
  async (req, res) => {
    try {
      const uid = req.auth?.uid;
      if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
      const user = await User.findOne({ uid });
      if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

      user.emergencyContacts = user.emergencyContacts || [];
      user.emergencyContacts.push({
        name: req.body.name,
        phone: req.body.phone,
        relationship: req.body.relationship,
      } as any);
      await user.save();

      res.status(201).json({ ok: true, emergencyContacts: user.emergencyContacts });
    } catch (err: any) {
      console.error('Add emergency contact error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

router.delete(
  '/emergency-contacts/:index',
  firebaseAuth,
  param('index').isInt({ min: 0 }),
  validateRequest,
  async (req, res) => {
    try {
      const uid = req.auth?.uid;
      if (!uid) return res.status(401).json({ ok: false, error: 'Unauthorized' });
      const user = await User.findOne({ uid });
      if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

      const index = Number(req.params.index);
      user.emergencyContacts = user.emergencyContacts || [];
      if (index >= user.emergencyContacts.length) {
        return res.status(404).json({ ok: false, error: 'Emergency contact not found' });
      }

      user.emergencyContacts.splice(index, 1);
      await user.save();

      res.json({ ok: true, emergencyContacts: user.emergencyContacts });
    } catch (err: any) {
      console.error('Delete emergency contact error', err);
      res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }
);

export default router;
