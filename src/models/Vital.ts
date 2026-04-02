import mongoose, { Schema, Document } from 'mongoose';

export interface IVital extends Document {
  userUid: string;
  recordedByUid?: string;
  source: 'manual' | 'google_fit' | 'smartwatch' | 'meta_glasses' | 'health_api';
  heartRate?: number;
  spo2?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  bodyTemperature?: number;
  temperatureUnit?: 'F' | 'C';
  steps?: number;
  sleepHours?: number;
  sleepDeepHours?: number;
  sleepLightHours?: number;
  respiratoryRate?: number;
  recordedAt: Date;
}

const VitalSchema: Schema = new Schema(
  {
    userUid: { type: String, required: true, index: true },
    recordedByUid: { type: String },
    source: {
      type: String,
      enum: ['manual', 'google_fit', 'smartwatch', 'meta_glasses', 'health_api'],
      default: 'manual',
    },
    heartRate: { type: Number },
    spo2: { type: Number },
    bloodPressureSystolic: { type: Number },
    bloodPressureDiastolic: { type: Number },
    bodyTemperature: { type: Number },
    temperatureUnit: { type: String, enum: ['F', 'C'], default: 'F' },
    steps: { type: Number },
    sleepHours: { type: Number },
    sleepDeepHours: { type: Number },
    sleepLightHours: { type: Number },
    respiratoryRate: { type: Number },
    recordedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const Vital = mongoose.model<IVital>('Vital', VitalSchema);
