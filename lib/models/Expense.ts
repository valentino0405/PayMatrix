import mongoose, { Schema, Document, Model } from 'mongoose';

export type SplitType = 'equal' | 'unequal' | 'percentage';
export type Category = 'Food'|'Travel'|'Accommodation'|'Entertainment'|'Shopping'|'Utilities'|'Health'|'Other';

export interface IExpenseSplit { memberId: string; amount: number; }

export interface IExpense extends Document {
  groupId: string; description: string; amount: number; paidBy: string;
  splitType: SplitType; splits: IExpenseSplit[]; category: Category;
  isSuspicious?: boolean;
  createdAt: Date; updatedAt: Date;
}

const SplitSchema = new Schema<IExpenseSplit>(
  { memberId: { type: String, required: true }, amount: { type: Number, required: true } },
  { _id: false }
);

const ExpenseSchema = new Schema<IExpense>({
  groupId:     { type: String, required: true, index: true },
  description: { type: String, required: true },
  amount:      { type: Number, required: true },
  paidBy:      { type: String, required: true },
  splitType:   { type: String, enum: ['equal','unequal','percentage'], required: true },
  splits:      { type: [SplitSchema], default: [] },
  category:    { type: String, enum: ['Food','Travel','Accommodation','Entertainment','Shopping','Utilities','Health','Other'], default: 'Other' },
  isSuspicious:{ type: Boolean, default: false },
}, { timestamps: true });

const Expense: Model<IExpense> = mongoose.models.Expense ?? mongoose.model<IExpense>('Expense', ExpenseSchema);
export default Expense;
