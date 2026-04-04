import mongoose, { Schema, Document, Model } from 'mongoose';

export type PaymentMethod = 'UPI_DEMO' | 'RAZORPAY';
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
  provider: 'SIMULATED_UPI' | 'RAZORPAY';
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
    method: { type: String, enum: ['UPI_DEMO', 'RAZORPAY'], default: 'UPI_DEMO' },
    status: { type: String, enum: ['initiated', 'processing', 'success', 'failed'], default: 'initiated', index: true },
    provider: { type: String, enum: ['SIMULATED_UPI', 'RAZORPAY'], default: 'SIMULATED_UPI' },
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

const PaymentTransaction: Model<IPaymentTransaction> =
  mongoose.models.PaymentTransaction ??
  mongoose.model<IPaymentTransaction>('PaymentTransaction', PaymentTransactionSchema);

export default PaymentTransaction;
