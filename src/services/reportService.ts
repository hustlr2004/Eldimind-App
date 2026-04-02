import { Vital } from '../models/Vital';
import { MoodLog } from '../models/MoodLog';
import { MedicineLog } from '../models/MedicineLog';
import { Alert } from '../models/Alert';
import { ChatMessage } from '../models/ChatMessage';
import { PhotoAnalysis } from '../models/PhotoAnalysis';

type SimpleRecord = Record<string, any>;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function buildLastNDays(days = 7, endDate = new Date()) {
  const end = startOfDay(endDate);
  const dates: Date[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - offset);
    dates.push(date);
  }
  return dates;
}

export function isWithinDay(dateValue: any, day: Date) {
  const value = new Date(dateValue);
  return value >= startOfDay(day) && value <= endOfDay(day);
}

export function average(values: Array<number | null | undefined>) {
  const numeric = values.filter((value): value is number => typeof value === 'number');
  if (!numeric.length) return null;
  const total = numeric.reduce((sum, value) => sum + value, 0);
  return Number((total / numeric.length).toFixed(2));
}

export function countBy<T>(items: T[], selector: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export function groupDaily<T>(days: Date[], items: T[], selector: (item: T) => any) {
  return days.map((day) => ({
    date: day.toISOString().slice(0, 10),
    items: items.filter((item) => isWithinDay(selector(item), day)),
  }));
}

export function buildMoodHeatmap(days: Date[], moodLogs: SimpleRecord[]) {
  return groupDaily(days, moodLogs, (item) => item.recordedAt).map((entry) => ({
    date: entry.date,
    mood: entry.items[0]?.mood ?? null,
  }));
}

export function buildSleepBars(days: Date[], vitals: SimpleRecord[]) {
  return groupDaily(days, vitals, (item) => item.recordedAt).map((entry) => ({
    date: entry.date,
    sleepHours: average(entry.items.map((item) => item.sleepHours)),
  }));
}

export function buildStepsBars(days: Date[], vitals: SimpleRecord[]) {
  return groupDaily(days, vitals, (item) => item.recordedAt).map((entry) => ({
    date: entry.date,
    steps: average(entry.items.map((item) => item.steps)),
  }));
}

export function buildHeartRateTrend(days: Date[], vitals: SimpleRecord[]) {
  return groupDaily(days, vitals, (item) => item.recordedAt).map((entry) => ({
    date: entry.date,
    heartRate: average(entry.items.map((item) => item.heartRate)),
  }));
}

export function buildMedicationAdherence(medicineLogs: SimpleRecord[]) {
  const total = medicineLogs.length;
  const taken = medicineLogs.filter((item) => item.action === 'taken').length;
  const skipped = medicineLogs.filter((item) => item.action === 'skipped').length;
  return {
    total,
    taken,
    skipped,
    adherencePercent: total > 0 ? Number(((taken / total) * 100).toFixed(2)) : null,
  };
}

export function buildMentalWellnessScore(moodLogs: SimpleRecord[], alerts: SimpleRecord[], aiSignals: string[]) {
  const latestMood = moodLogs[0]?.mood ?? 3;
  const moodComponent = latestMood * 15;
  const alertPenalty = alerts.filter((alert) => alert.type === 'ai_distress').length * 5;
  const signalPenalty = aiSignals.length * 4;
  const score = Math.max(0, Math.min(100, 40 + moodComponent - alertPenalty - signalPenalty));
  return score;
}

export async function buildWeeklyReportForUser(targetUser: any) {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const [vitals, moodLogs, medicineLogs, alerts, chatMessages, photoAnalyses] = await Promise.all([
    Vital.find({ userUid: targetUser.uid, recordedAt: { $gte: since } }).sort({ recordedAt: -1 }),
    MoodLog.find({ userUid: targetUser.uid, recordedAt: { $gte: since } }).sort({ recordedAt: -1 }),
    MedicineLog.find({ userUid: targetUser.uid, timestamp: { $gte: since } }).sort({ timestamp: -1 }),
    Alert.find({ userUid: targetUser.uid, createdAt: { $gte: since } }).sort({ createdAt: -1 }),
    ChatMessage.find({ userUid: targetUser.uid, createdAt: { $gte: since } }).sort({ createdAt: -1 }),
    PhotoAnalysis.find({ userUid: targetUser.uid, createdAt: { $gte: since } }).sort({ createdAt: -1 }),
  ]);

  const days = buildLastNDays(7);
  const chatSignals = chatMessages.flatMap((message: any) => message.distressSignals || []);
  const photoSignals = photoAnalyses.flatMap((photo: any) => photo.distressSignals || []);
  const aiSignals = [...chatSignals, ...photoSignals];

  return {
    user: {
      uid: targetUser.uid,
      fullName: targetUser.fullName,
    },
    period: {
      startDate: days[0].toISOString().slice(0, 10),
      endDate: days[days.length - 1].toISOString().slice(0, 10),
    },
    charts: {
      heartRateTrend: buildHeartRateTrend(days, vitals as any[]),
      sleepBars: buildSleepBars(days, vitals as any[]),
      moodHeatmap: buildMoodHeatmap(days, moodLogs as any[]),
      stepsBars: buildStepsBars(days, vitals as any[]),
    },
    medicationAdherence: buildMedicationAdherence(medicineLogs as any[]),
    mentalWellnessScore: buildMentalWellnessScore(moodLogs as any[], alerts as any[], aiSignals),
    totals: {
      alerts: alerts.length,
      aiDistressAlerts: alerts.filter((alert: any) => alert.type === 'ai_distress').length,
      sosEvents: alerts.filter((alert: any) => alert.type === 'sos').length,
      chatMessages: chatMessages.length,
      photoAnalyses: photoAnalyses.length,
    },
  };
}
