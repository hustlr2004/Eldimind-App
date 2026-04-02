import { Reminder } from '../models/Reminder';
import { notifyCaretakersOfUid, sendPushToUid } from './notificationService';
import { Medicine } from '../models/Medicine';

let interval: NodeJS.Timeout | null = null;

export function startReminderWorker() {
  if (interval) return;
  console.log('Starting reminder worker (poll every minute)');
  interval = setInterval(() => {
    void runOnce();
  }, 60 * 1000);
  // run immediately once
  void runOnce();
  // materialize reminders for the next 7 days on startup
  void (async () => {
    try {
      const scheduler = await import('./reminderScheduler');
      await scheduler.materializeRemindersForNextDays(7);
      console.log('Materialized reminders for next 7 days');
    } catch (err) {
      console.error('Failed to materialize reminders at startup', err);
    }
  })();
}

export async function runOnce() {
  try {
    const now = new Date();
    const due = await Reminder.find({ dueAt: { $lte: now }, acknowledged: false, escalated: false });
    for (const r of due) {
      try {
        const med = await Medicine.findById(r.medicineId as any);
        if (!med) continue;
        // notify elder
        await sendPushToUid(r.userUid, {
          title: 'Medicine Reminder',
          body: `Time to take ${med.name}`,
          priority: 'normal',
        });
        // after sending push, create escalation check: we'll wait 2 hours and escalate if not acknowledged
        // For now just mark escalated=false and rely on separate check below
      } catch (err) {
        console.error('Reminder send failed for', r._id, err);
      }
    }

    // Escalation: reminders older than 2 hours and not acknowledged and not escalated
    const escCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const toEsc = await Reminder.find({ dueAt: { $lte: escCutoff }, acknowledged: false, escalated: false });
    for (const r of toEsc) {
      try {
        await notifyCaretakersOfUid(r.userUid, {
          title: 'Missed Medicine Alert',
          body: `Missed medicine scheduled at ${r.dueAt.toISOString()}`,
          priority: 'critical',
        });
        r.escalated = true;
        await r.save();
      } catch (err) {
        console.error('Failed to escalate reminder', r._id, err);
      }
    }
  } catch (err) {
    console.error('Reminder worker failed', err);
  }
}

export function stopReminderWorker() {
  if (interval) clearInterval(interval);
  interval = null;
}
