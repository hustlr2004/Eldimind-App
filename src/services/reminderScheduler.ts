import { Medicine } from '../models/Medicine';
import { Reminder } from '../models/Reminder';

// Materialize reminders for the next `days` days for all medicines
export async function materializeRemindersForNextDays(days = 7) {
  const medicines = await Medicine.find({});
  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);

  for (const med of medicines) {
    for (let d = 0; d < days; d++) {
      const day = new Date(startDate);
      day.setDate(day.getDate() + d);
      for (const t of (med.scheduleTimes || [])) {
        const [hh, mm] = t.split(':').map((s: string) => parseInt(s, 10));
        const due = new Date(day);
        due.setHours(hh, mm, 0, 0);

        // don't create reminders in the past beyond now - allow today's future times
        if (due.getTime() < Date.now() - 24 * 60 * 60 * 1000) continue;

        // check existing
        const exists = await Reminder.findOne({ medicineId: med._id, dueAt: due });
        if (!exists) {
          const r = new Reminder({ medicineId: med._id, userUid: med.userUid, dueAt: due });
          await r.save();
        }
      }
    }
  }
}
