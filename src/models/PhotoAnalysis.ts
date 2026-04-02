import mongoose, { Schema, Document } from 'mongoose';

export interface IPhotoAnalysis extends Document {
  userUid: string;
  imageUrl: string;
  summary: string;
  caregiverNote?: string;
  distressSignals?: string[];
  createdAt: Date;
}

const PhotoAnalysisSchema: Schema = new Schema(
  {
    userUid: { type: String, required: true, index: true },
    imageUrl: { type: String, required: true },
    summary: { type: String, required: true },
    caregiverNote: { type: String },
    distressSignals: [{ type: String }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PhotoAnalysis = mongoose.model<IPhotoAnalysis>('PhotoAnalysis', PhotoAnalysisSchema);
