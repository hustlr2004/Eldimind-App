import { Report } from '../models/Report';
import { User } from '../models/User';
import { createWeeklyReportPdf } from './pdfReportService';
import { buildWeeklyReportForUser } from './reportService';

function getCurrentWeekWindow() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

export async function generateWeeklyReportsForAllElders() {
  const elders = await User.find({ role: 'elder' });
  const { start, end } = getCurrentWeekWindow();
  const created: any[] = [];

  for (const elder of elders) {
    const existing = await Report.findOne({
      userUid: elder.uid,
      type: 'weekly',
      periodStart: start,
      periodEnd: end,
    });
    if (existing) continue;

    const reportData = await buildWeeklyReportForUser(elder);
    const pdf = await createWeeklyReportPdf(reportData);
    const report = await Report.create({
      userUid: elder.uid,
      generatedByUid: 'system',
      type: 'weekly',
      periodStart: start,
      periodEnd: end,
      fileUrl: pdf.publicUrl,
      fileName: pdf.fileName,
    });
    created.push(report);
  }

  return created;
}
