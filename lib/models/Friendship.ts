import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFriendship extends Document {
  userAClerkId: string;   // the inviter
  userBClerkId: string;   // the accepter
  userAName: string;
  userBName: string;
  userAEmail: string;
  userBEmail: string;
  userAAvatar: string;
  userBAvatar: string;
  colorA: string;
  colorB: string;
  balance: number;        // positive = B owes A, negative = A owes B
  note: string;           // optional description
  settled: boolean;
  settledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const FriendshipSchema = new Schema<IFriendship>({
  userAClerkId: { type: String, required: true, index: true },
  userBClerkId: { type: String, required: true, index: true },
  userAName:    { type: String, required: true },
  userBName:    { type: String, default: '' },
  userAEmail:   { type: String, required: true },
  userBEmail:   { type: String, required: true },
  userAAvatar:  { type: String, default: '' },
  userBAvatar:  { type: String, default: '' },
  colorA:       { type: String, default: '#6366f1' },
  colorB:       { type: String, default: '#ec4899' },
  balance:      { type: Number, default: 0 },
  note:         { type: String, default: '' },
  settled:      { type: Boolean, default: false },
  settledAt:    { type: Date, default: null },
}, { timestamps: true });

// Compound index — ensure unique pair
FriendshipSchema.index({ userAClerkId: 1, userBClerkId: 1 }, { unique: true });

const Friendship: Model<IFriendship> = mongoose.models.Friendship
  ?? mongoose.model<IFriendship>('Friendship', FriendshipSchema);

export default Friendship;
