import mongoose, { Schema, Document } from 'mongoose';

export interface IPhotoJournal extends Document {
  userUid: string;
  uploadedByUid?: string;
  imageUrl: string;
  storageType: 'local' | 'remote' | 'cloudinary';
  fileName?: string;
  mimeType?: string;
  caption?: string;
  analysisId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const PhotoJournalSchema: Schema = new Schema(
  {
    userUid: { type: String, required: true, index: true },
    uploadedByUid: { type: String },
    imageUrl: { type: String, required: true },
    storageType: { type: String, enum: ['local', 'remote', 'cloudinary'], required: true },
    fileName: { type: String },
    mimeType: { type: String },
    caption: { type: String },
    analysisId: { type: Schema.Types.ObjectId, ref: 'PhotoAnalysis' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PhotoJournal = mongoose.model<IPhotoJournal>('PhotoJournal', PhotoJournalSchema);
