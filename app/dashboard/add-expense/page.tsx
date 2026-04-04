'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ArrowLeft, CheckCircle2, Receipt } from 'lucide-react';

/* ─── Categories ────────────────────────────────────────── */
const CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Shopping',
  'Entertainment',
  'Utilities',
  'Health',
  'Travel',
  'Other',
];

/* ─── Inner form (needs useSearchParams → wrapped in Suspense) ── */
function AddExpenseForm() {
  const params = useSearchParams();
  const router = useRouter();

  const [form, setForm] = useState({
    amount: params.get('amount') ?? '',
    date: params.get('date') ?? new Date().toISOString().split('T')[0],
    description: params.get('description') ?? '',
    category: 'Other',
    paidBy: '',
    notes: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fromScan = params.has('amount') || params.has('description');

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.amount || isNaN(Number(form.amount)))
      e.amount = 'Enter a valid amount.';
    if (!form.description.trim()) e.description = 'Description is required.';
    if (!form.date) e.date = 'Date is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    /* In a real app you'd POST to an API route / Prisma here */
    setSubmitted(true);
  };

  /* ── Success state ────────────────────────────────────── */
  if (submitted) {
    return (
      <div
        id="add-expense-success"
        className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Expense Added!</h2>
          <p className="mt-1 text-sm text-slate-500">
            <strong>{form.description}</strong> — ${form.amount} on {form.date}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            id="add-another-btn"
            type="button"
            onClick={() => {
              setSubmitted(false);
              setForm({ amount: '', date: '', description: '', category: 'Other', paidBy: '', notes: '' });
              setErrors({});
              router.replace('/dashboard/add-expense');
            }}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Add Another
          </button>
          <Link
            href="/scan"
            id="scan-another-link"
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Scan Another Receipt
          </Link>
        </div>
      </div>
    );
  }

  /* ── Form ─────────────────────────────────────────────── */
  return (
    <form
      id="add-expense-form"
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      noValidate
    >
      {/* OCR badge */}
      {fromScan && (
        <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm text-indigo-700">
          <Receipt className="h-4 w-4 flex-shrink-0 text-indigo-400" />
          Fields below were pre-filled from your scanned receipt. Review and edit before saving.
        </div>
      )}

      {/* Amount + Date */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="expense-amount" className="mb-1.5 block text-sm font-medium text-slate-700">
            Amount <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">$</span>
            <input
              id="expense-amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              placeholder="0.00"
              className={[
                'w-full rounded-xl border py-2.5 pl-8 pr-4 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-indigo-300',
                errors.amount ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white',
              ].join(' ')}
            />
          </div>
          {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
        </div>

        <div>
          <label htmlFor="expense-date" className="mb-1.5 block text-sm font-medium text-slate-700">
            Date <span className="text-red-400">*</span>
          </label>
          <input
            id="expense-date"
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className={[
              'w-full rounded-xl border py-2.5 px-4 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-indigo-300',
              errors.date ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white',
            ].join(' ')}
          />
          {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="expense-description" className="mb-1.5 block text-sm font-medium text-slate-700">
          Description <span className="text-red-400">*</span>
        </label>
        <input
          id="expense-description"
          type="text"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="e.g. Dinner at The Grill"
          className={[
            'w-full rounded-xl border py-2.5 px-4 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-indigo-300',
            errors.description ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white',
          ].join(' ')}
        />
        {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
      </div>

      {/* Category */}
      <div>
        <label htmlFor="expense-category" className="mb-1.5 block text-sm font-medium text-slate-700">
          Category
        </label>
        <select
          id="expense-category"
          value={form.category}
          onChange={(e) => set('category', e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-indigo-300"
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Paid By */}
      <div>
        <label htmlFor="expense-paid-by" className="mb-1.5 block text-sm font-medium text-slate-700">
          Paid By
        </label>
        <input
          id="expense-paid-by"
          type="text"
          value={form.paidBy}
          onChange={(e) => set('paidBy', e.target.value)}
          placeholder="Your name or group member"
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="expense-notes" className="mb-1.5 block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="expense-notes"
          rows={3}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Any additional info…"
          className="w-full resize-none rounded-xl border border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        <button
          id="add-expense-submit-btn"
          type="submit"
          className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-[0.98]"
        >
          Add Expense
        </button>
        <Link
          href="/scan"
          id="back-to-scan-link"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Scanner
        </Link>
      </div>
    </form>
  );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function AddExpensePage() {
  return (
    <main className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <div className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-5 sm:px-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500">
            <Receipt className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-800">Add Expense</h1>
            <p className="text-xs text-slate-400">Review and confirm your expense details</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:px-8">
        <Suspense fallback={<div className="text-sm text-slate-400">Loading…</div>}>
          <AddExpenseForm />
        </Suspense>
      </div>
    </main>
  );
}
