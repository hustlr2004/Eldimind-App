import mongoose, { Schema, Document } from 'mongoose';

export interface ISosEvent extends Document {
  userUid: string;
  triggeredByUid?: string;
  reason?: string;
  message?: string;
  latitude?: number;
  longitude?: number;
  status: 'triggered' | 'cancelled' | 'resolved';
  triggeredAt: Date;
}

const SosEventSchema: Schema = new Schema(
  {
    userUid: { type: String, required: true, index: true },
    triggeredByUid: { type: String },
    reason: { type: String },
    message: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    status: { type: String, enum: ['triggered', 'cancelled', 'resolved'], default: 'triggered' },
    triggeredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const SosEvent = mongoose.model<ISosEvent>('SosEvent', SosEventSchema);
