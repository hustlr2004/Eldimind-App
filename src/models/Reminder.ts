import mongoose, { Schema, Document } from 'mongoose';

export interface IReminder extends Document {
  medicineId: mongoose.Types.ObjectId;
  userUid: string;
  dueAt: Date;
  acknowledged: boolean;
  escalated: boolean;
}

const ReminderSchema: Schema = new Schema(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    userUid: { type: String, required: true },
    dueAt: { type: Date, required: true, index: true },
    acknowledged: { type: Boolean, default: false },
    escalated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Reminder = mongoose.model<IReminder>('Reminder', ReminderSchema);
