import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  uid?: string;
  ip?: string;
  method: string;
  path: string;
  body?: any;
  status?: number;
  createdAt: Date;
}

const AuditLogSchema: Schema = new Schema(
  {
    uid: { type: String },
    ip: { type: String },
    method: { type: String, required: true },
    path: { type: String, required: true },
    body: { type: Schema.Types.Mixed },
    status: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
