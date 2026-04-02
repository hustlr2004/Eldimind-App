import mongoose, { Schema, Document } from 'mongoose';

export interface ICallLog extends Document {
  elderUid: string;
  caretakerUid: string;
  type: 'voice' | 'video';
  status: 'missed' | 'completed' | 'declined';
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
}

const CallLogSchema: Schema = new Schema(
  {
    elderUid: { type: String, required: true, index: true },
    caretakerUid: { type: String, required: true, index: true },
    type: { type: String, enum: ['voice', 'video'], required: true },
    status: { type: String, enum: ['missed', 'completed', 'declined'], required: true },
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const CallLog = mongoose.model<ICallLog>('CallLog', CallLogSchema);
