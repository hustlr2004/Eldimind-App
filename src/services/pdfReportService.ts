import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export async function createWeeklyReportPdf(report: any) {
  const PDFDocument = require('pdfkit');
  const outputDir = path.join(process.cwd(), 'uploads', 'reports');
  await fsp.mkdir(outputDir, { recursive: true });

  const fileName = `weekly-report-${crypto.randomUUID()}.pdf`;
  const filePath = path.join(outputDir, fileName);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).text('EldiMind Weekly Report');
    doc.moveDown();
    doc.fontSize(12).text(`Elder: ${report.user.fullName}`);
    doc.text(`Period: ${report.period.startDate} to ${report.period.endDate}`);
    doc.moveDown();

    doc.fontSize(14).text('Medication Adherence');
    doc.fontSize(12).text(
      `Taken: ${report.medicationAdherence.taken}, Skipped: ${report.medicationAdherence.skipped}, Adherence: ${
        report.medicationAdherence.adherencePercent ?? 'N/A'
      }%`
    );
    doc.moveDown();

    doc.fontSize(14).text('Mental Wellness');
    doc.fontSize(12).text(`Score: ${report.mentalWellnessScore}`);
    doc.moveDown();

    doc.fontSize(14).text('Totals');
    Object.entries(report.totals).forEach(([key, value]) => {
      doc.fontSize(12).text(`${key}: ${value}`);
    });
    doc.moveDown();

    doc.fontSize(14).text('Heart Rate Trend');
    report.charts.heartRateTrend.forEach((entry: any) => {
      doc.fontSize(12).text(`${entry.date}: ${entry.heartRate ?? 'N/A'} bpm`);
    });
    doc.moveDown();

    doc.fontSize(14).text('Mood Heatmap');
    report.charts.moodHeatmap.forEach((entry: any) => {
      doc.fontSize(12).text(`${entry.date}: ${entry.mood ?? 'N/A'}`);
    });

    doc.end();

    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return {
    fileName,
    filePath,
    publicUrl: `/uploads/reports/${fileName}`,
  };
}
