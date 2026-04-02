import mongoose, { Schema, Document } from 'mongoose';

export interface ICondition extends Document {
  userUid: string;
  addedByUid?: string;
  name: string;
  notes?: string;
  diagnosedAt?: Date;
  active: boolean;
}

const ConditionSchema: Schema = new Schema(
  {
    userUid: { type: String, required: true, index: true },
    addedByUid: { type: String },
    name: { type: String, required: true },
    notes: { type: String },
    diagnosedAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Condition = mongoose.model<ICondition>('Condition', ConditionSchema);
