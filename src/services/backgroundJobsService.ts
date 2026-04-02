import { startReminderWorker } from './reminderWorker';
import { generateWeeklyReportsForAllElders } from './reportWorker';

let reportsInterval: NodeJS.Timeout | null = null;

export function startBackgroundJobs() {
  startReminderWorker();

  if (!reportsInterval) {
    const intervalHours = Number(process.env.REPORT_GENERATION_INTERVAL_HOURS || 24);
    reportsInterval = setInterval(() => {
      void generateWeeklyReportsForAllElders().catch((err) => {
        console.error('Background weekly report generation failed', err);
      });
    }, intervalHours * 60 * 60 * 1000);
  }

  void generateWeeklyReportsForAllElders().catch((err) => {
    console.error('Initial weekly report generation failed', err);
  });
}

export function stopBackgroundJobs() {
  if (reportsInterval) {
    clearInterval(reportsInterval);
    reportsInterval = null;
  }
}
