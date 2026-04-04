import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  clerkId: string; email: string; name: string;
  username?: string; avatarUrl?: string;
  createdAt: Date; updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  clerkId:   { type: String, required: true, unique: true, index: true },
  email:     { type: String, required: true },
  name:      { type: String, default: '' },
  username:  { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
}, { timestamps: true });

const User: Model<IUser> = mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema);
export default User;
