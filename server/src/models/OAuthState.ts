import mongoose, { Schema, Document } from 'mongoose';

export interface IOAuthState extends Document {
  state: string;
  organizationId: mongoose.Types.ObjectId;
  nonce?: string;
  redirectUri?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const oAuthStateSchema = new Schema<IOAuthState>(
  {
    state: { type: String, required: true, unique: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    nonce: { type: String },
    redirectUri: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

oAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthState = mongoose.model<IOAuthState>('OAuthState', oAuthStateSchema);
