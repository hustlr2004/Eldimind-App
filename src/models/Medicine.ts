import mongoose, { Schema, Document } from 'mongoose';

export interface IMedicine extends Document {
  userUid: string;
  name: string;
  dosage?: string;
  scheduleTimes: string[]; // HH:MM strings
  startDate?: Date;
  endDate?: Date;
  notes?: string;
}

const MedicineSchema: Schema = new Schema(
  {
    userUid: { type: String, required: true, index: true },
    name: { type: String, required: true },
    dosage: { type: String },
    scheduleTimes: [{ type: String }],
    startDate: { type: Date },
    endDate: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

export const Medicine = mongoose.model<IMedicine>('Medicine', MedicineSchema);
