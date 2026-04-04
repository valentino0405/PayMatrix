import mongoose, { Schema, Document, Model } from 'mongoose';

export type GroupType = 'Trip' | 'Roommates' | 'Event' | 'Other';

export interface IMember { id: string; name: string; color: string; email?: string; }

export interface IGroup extends Document {
  name: string; type: GroupType;
  members: IMember[]; inviteCode: string;
  ownerClerkId: string; createdAt: Date; updatedAt: Date;
}

const MemberSchema = new Schema<IMember>(
  { id: { type: String, required: true }, name: { type: String, required: true }, color: { type: String, required: true }, email: { type: String, required: false } },
  { _id: false }
);

const GroupSchema = new Schema<IGroup>({
  name:         { type: String, required: true },
  type:         { type: String, enum: ['Trip','Roommates','Event','Other'], default: 'Other' },
  members:      { type: [MemberSchema], default: [] },
  inviteCode:   { type: String, required: true, unique: true },
  ownerClerkId: { type: String, required: true, index: true },
}, { timestamps: true });

const Group: Model<IGroup> = mongoose.models.Group ?? mongoose.model<IGroup>('Group', GroupSchema);
export default Group;
