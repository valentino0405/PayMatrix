import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFriendRequest extends Document {
  token: string;
  senderClerkId: string;
  senderName: string;
  senderEmail: string;
  receiverEmail: string;
  balance: number;        // positive = receiver owes sender, negative = sender owes receiver
  note: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FriendRequestSchema = new Schema<IFriendRequest>({
  token:          { type: String, required: true, unique: true, index: true },
  senderClerkId:  { type: String, required: true, index: true },
  senderName:     { type: String, required: true },
  senderEmail:    { type: String, required: true },
  receiverEmail:  { type: String, required: true, lowercase: true, trim: true },
  balance:        { type: Number, default: 0 },
  note:           { type: String, default: '' },
  status:         { type: String, enum: ['pending', 'accepted', 'expired'], default: 'pending' },
  expiresAt:      { type: Date, required: true },
}, { timestamps: true });

// Auto-expire after 7 days
FriendRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const FriendRequest: Model<IFriendRequest> = mongoose.models.FriendRequest
  ?? mongoose.model<IFriendRequest>('FriendRequest', FriendRequestSchema);

export default FriendRequest;
