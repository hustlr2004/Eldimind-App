import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  uid: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: 'elder' | 'caretaker' | string;
  photoUrl?: string;
  linkedCaretakers: mongoose.Types.ObjectId[];
  linkedElders: mongoose.Types.ObjectId[];
  preferences: any;
  emergencyContacts: Array<{
    name: string;
    phone: string;
    relationship?: string;
  }>;
  lastActiveAt?: Date;
}

const UserSchema: Schema = new Schema(
  {
    uid: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    role: { type: String, enum: ['elder', 'caretaker'], required: true },
    photoUrl: { type: String },
    linkedCaretakers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    linkedElders: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    preferences: { type: Schema.Types.Mixed, default: {} },
    emergencyContacts: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        relationship: { type: String },
      },
    ],
    lastActiveAt: { type: Date },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
