import mongoose, { Schema, Document } from 'mongoose';

export interface IMedicineLog extends Document {
  medicineId: mongoose.Types.ObjectId;
  userUid: string;
  action: 'taken' | 'skipped';
  timestamp: Date;
}

const MedicineLogSchema: Schema = new Schema(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    userUid: { type: String, required: true },
    action: { type: String, enum: ['taken', 'skipped'], required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const MedicineLog = mongoose.model<IMedicineLog>('MedicineLog', MedicineLogSchema);
