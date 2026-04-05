import mongoose, { Schema, Document, Model } from 'mongoose';

export type PaymentMethod = 'UPI_DEMO' | 'RAZORPAY' | 'CASH';
export type PaymentStatus = 'initiated' | 'processing' | 'success' | 'failed';
export type ReminderStatus = 'none' | 'scheduled' | 'sent';

export interface ILocationTag {
  label?: string;
  city?: string;
  lat?: number;
  lng?: number;
}

export interface IPaymentTransaction extends Document {
  groupId: string;
  from: string;
  to: string;
  amount: number;
  currency: 'INR';
  method: PaymentMethod;
  status: PaymentStatus;
  provider: 'SIMULATED_UPI' | 'RAZORPAY' | 'OFFLINE_CASH';
  providerOrderId: string;
  providerTxnId?: string;
  
  // Razorpay Specific Fields
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  
  note?: string;
  locationTag?: ILocationTag;
  reminderAt?: Date;
  reminderStatus: ReminderStatus;
  paidAt?: Date;
  failureReason?: string;
  createdByClerkId: string;
  createdAt: Date;
  updatedAt: Date;
}

const LocationTagSchema = new Schema<ILocationTag>(
  {
    label: { type: String },
    city: { type: String },
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false }
);

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    groupId: { type: String, required: true, index: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    method: { type: String, enum: ['UPI_DEMO', 'RAZORPAY', 'CASH'], default: 'UPI_DEMO' },
    status: { type: String, enum: ['initiated', 'processing', 'success', 'failed'], default: 'initiated', index: true },
    provider: { type: String, enum: ['SIMULATED_UPI', 'RAZORPAY', 'OFFLINE_CASH'], default: 'SIMULATED_UPI' },
    providerOrderId: { type: String, required: true, unique: true },
    providerTxnId: { type: String },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    note: { type: String },
    locationTag: { type: LocationTagSchema },
    reminderAt: { type: Date },
    reminderStatus: { type: String, enum: ['none', 'scheduled', 'sent'], default: 'none', index: true },
    paidAt: { type: Date },
    failureReason: { type: String },
    createdByClerkId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

PaymentTransactionSchema.index({ groupId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ groupId: 1, from: 1, to: 1, amount: 1, status: 1 });

const existingModel = mongoose.models.PaymentTransaction as Model<IPaymentTransaction> | undefined;
if (existingModel) {
  const methodPath = existingModel.schema.path('method') as mongoose.SchemaType & { enumValues?: string[] };
  const providerPath = existingModel.schema.path('provider') as mongoose.SchemaType & { enumValues?: string[] };
  const hasCashMethod = Array.isArray(methodPath?.enumValues) && methodPath.enumValues.includes('CASH');
  const hasOfflineCashProvider = Array.isArray(providerPath?.enumValues) && providerPath.enumValues.includes('OFFLINE_CASH');

  // In dev hot-reload, Mongoose may keep a stale model schema; refresh when new enum values are missing.
  if (!hasCashMethod || !hasOfflineCashProvider) {
    delete mongoose.models.PaymentTransaction;
  }
}

const PaymentTransaction: Model<IPaymentTransaction> =
  mongoose.models.PaymentTransaction ??
  mongoose.model<IPaymentTransaction>('PaymentTransaction', PaymentTransactionSchema);

export default PaymentTransaction;
