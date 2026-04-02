import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
  userUid: string;
  triggeredByUid?: string;
  type: 'vital_spike' | 'sos' | 'fall_detected' | 'missed_medicine' | 'mood_drop' | 'ai_distress';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  vitalType?: string;
  measuredValue?: string;
  meta?: any;
  createdAt: Date;
}

const AlertSchema: Schema = new Schema(
  {
    userUid: { type: String, required: true, index: true },
    triggeredByUid: { type: String },
    type: {
      type: String,
      enum: ['vital_spike', 'sos', 'fall_detected', 'missed_medicine', 'mood_drop', 'ai_distress'],
      required: true,
    },
    severity: { type: String, enum: ['info', 'warning', 'critical'], required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    vitalType: { type: String },
    measuredValue: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export const Alert = mongoose.model<IAlert>('Alert', AlertSchema);
