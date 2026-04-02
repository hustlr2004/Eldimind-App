import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage extends Document {
  userUid: string;
  role: 'user' | 'assistant';
  text: string;
  language: 'en' | 'hi' | 'kn';
  distressSignals?: string[];
  createdAt: Date;
}

const ChatMessageSchema: Schema = new Schema(
  {
    userUid: { type: String, required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    text: { type: String, required: true },
    language: { type: String, enum: ['en', 'hi', 'kn'], required: true },
    distressSignals: [{ type: String }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
