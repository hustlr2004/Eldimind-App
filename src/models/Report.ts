import mongoose, { Schema, Document } from 'mongoose';

export interface IReport extends Document {
  userUid: string;
  generatedByUid?: string;
  type: 'weekly';
  periodStart: Date;
  periodEnd: Date;
  fileUrl: string;
  fileName: string;
  createdAt: Date;
}

const ReportSchema: Schema = new Schema(
  {
    userUid: { type: String, required: true, index: true },
    generatedByUid: { type: String },
    type: { type: String, enum: ['weekly'], required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Report = mongoose.model<IReport>('Report', ReportSchema);
