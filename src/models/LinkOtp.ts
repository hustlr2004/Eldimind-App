import mongoose, { Schema, Document } from 'mongoose';

export interface ILinkOtp extends Document {
  code: string;
  elderUid: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

const LinkOtpSchema: Schema = new Schema(
  {
    code: { type: String, required: true, index: true },
    elderUid: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const LinkOtp = mongoose.model<ILinkOtp>('LinkOtp', LinkOtpSchema);
