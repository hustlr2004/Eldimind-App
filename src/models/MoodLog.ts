import mongoose, { Schema, Document } from 'mongoose';

export interface IMoodLog extends Document {
  userUid: string;
  recordedByUid?: string;
  mood: 1 | 2 | 3 | 4 | 5;
  note?: string;
  recordedAt: Date;
}

const MoodLogSchema: Schema = new Schema(
  {
    userUid: { type: String, required: true, index: true },
    recordedByUid: { type: String },
    mood: { type: Number, enum: [1, 2, 3, 4, 5], required: true },
    note: { type: String },
    recordedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const MoodLog = mongoose.model<IMoodLog>('MoodLog', MoodLogSchema);
