import { User } from '../models/User';
import { admin, isFirebaseInitialized } from '../config/firebase';

type NotificationPayload = {
  title: string;
  body: string;
  data?: any;
  priority?: 'normal' | 'critical';
};

function normalizeMinutes(value?: string | null) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hh, mm] = value.split(':').map(Number);
  return hh * 60 + mm;
}

function isWithinDoNotDisturb(user: any) {
  const notifications = user?.preferences?.notifications || {};
  const start = normalizeMinutes(notifications.doNotDisturbStart);
  const end = normalizeMinutes(notifications.doNotDisturbEnd);
  if (start === null || end === null || start === end) return false;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function notificationsEnabled(user: any) {
  return user?.preferences?.notifications?.enabled !== false;
}

// Twilio is optional — only initialize if env variables present
let twilioClient: any = null;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;
if (TWILIO_SID && TWILIO_TOKEN) {
  try {
    // require here so tests/dev without twilio won't fail at import
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Twilio = require('twilio');
    twilioClient = new Twilio(TWILIO_SID, TWILIO_TOKEN);
    console.log('Twilio client initialized');
  } catch (err) {
    console.warn('Twilio package not available or failed to init', err);
  }
}

export async function registerFcmToken(uid: string, token: string) {
  const user = await User.findOne({ uid });
  if (!user) throw new Error('User not found');

  user.preferences = user.preferences || {};
  user.preferences.fcmTokens = user.preferences.fcmTokens || [];
  if (!user.preferences.fcmTokens.includes(token)) {
    user.preferences.fcmTokens.push(token);
    await user.save();
  }
  return user;
}

export async function sendPushToUid(uid: string, payload: NotificationPayload) {
  const user = await User.findOne({ uid });
  if (!user) throw new Error('User not found');

  if (!notificationsEnabled(user)) {
    return { sent: false, channel: null, reason: 'notifications_disabled' };
  }
  if (payload.priority !== 'critical' && isWithinDoNotDisturb(user)) {
    return { sent: false, channel: null, reason: 'do_not_disturb' };
  }

  const tokens: string[] = (user.preferences && user.preferences.fcmTokens) || [];
  if (!tokens.length) {
    console.log('No FCM tokens for user', uid);
    return { sent: false, channel: null, reason: 'missing_fcm_tokens' };
  }

  if (isFirebaseInitialized()) {
    try {
      const message = {
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
      };
      // send to device tokens
      const res = await admin.messaging().sendToDevice(tokens, message as any);
      console.log('FCM send result', res);
      return { sent: true, channel: 'push', reason: null };
    } catch (err) {
      console.error('FCM send failed', err);
      // fall through to return false
    }
  } else {
    console.log('Firebase not initialized — skipping push send');
  }
  return { sent: false, channel: null, reason: 'push_unavailable' };
}

export async function sendSMS(to: string, body: string) {
  if (!twilioClient) {
    console.log(`Twilio not configured — would send SMS to ${to}: ${body}`);
    return false;
  }

  try {
    await twilioClient.messages.create({ from: TWILIO_FROM, to, body });
    console.log('SMS sent to', to);
    return true;
  } catch (err) {
    console.error('SMS send failed', err);
    return false;
  }
}

export async function notifyCaretakersOfUid(uid: string, message: NotificationPayload) {
  // find user and their linked caretakers
  const user = await User.findOne({ uid }).populate('linkedCaretakers');
  if (!user) return [];
  const caretakers: any[] = (user as any).linkedCaretakers || [];
  const deliveries: any[] = [];
  for (const c of caretakers) {
    // try push first
    const pushResult = await sendPushToUid(c.uid, message);
    if (
      !pushResult.sent &&
      c.phone &&
      (message.priority === 'critical' || pushResult.reason === 'missing_fcm_tokens')
    ) {
      const smsSent = await sendSMS(c.phone, `${message.title} - ${message.body}`);
      deliveries.push({
        caretakerUid: c.uid,
        sent: smsSent,
        channel: smsSent ? 'sms' : null,
        reason: smsSent ? null : 'sms_failed',
      });
      continue;
    }
    deliveries.push({ caretakerUid: c.uid, ...pushResult });
  }
  return deliveries;
}
