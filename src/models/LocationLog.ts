import mongoose, { Schema, Document } from 'mongoose';

export interface ILocationLog extends Document {
  userUid: string;
  recordedByUid?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  source?: 'gps' | 'manual' | 'device';
  recordedAt: Date;
}

const LocationLogSchema: Schema = new Schema(
  {
    userUid: { type: String, required: true, index: true },
    recordedByUid: { type: String },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number },
    source: { type: String, enum: ['gps', 'manual', 'device'], default: 'gps' },
    recordedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const LocationLog = mongoose.model<ILocationLog>('LocationLog', LocationLogSchema);
