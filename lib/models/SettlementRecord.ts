import mongoose, { Schema, Document, Model } from 'mongoose';

// Persists when a user marks a settlement transaction as "paid"
export interface ISettlementRecord extends Document {
  groupId: string;
  from: string;    // member id
  to: string;      // member id
  amount: number;
  paidAt: Date;
  createdAt: Date;
}

const SettlementRecordSchema = new Schema<ISettlementRecord>(
  {
    groupId: { type: String, required: true, index: true },
    from:    { type: String, required: true },
    to:      { type: String, required: true },
    amount:  { type: Number, required: true },
    paidAt:  { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const SettlementRecord: Model<ISettlementRecord> =
  mongoose.models.SettlementRecord ??
  mongoose.model<ISettlementRecord>('SettlementRecord', SettlementRecordSchema);

export default SettlementRecord;
