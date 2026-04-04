'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, MapPin, RefreshCw, ReceiptIndianRupee } from 'lucide-react';
import { useStore } from '@/lib/store';

type PaymentStatus = 'initiated' | 'processing' | 'success' | 'failed';

interface PaymentRow {
  _id: string;
  from: string;
  to: string;
  amount: number;
  status: PaymentStatus;
  method: 'UPI_DEMO';
  locationTag?: { label?: string; city?: string };
  reminderAt?: string;
  paidAt?: string;
  createdAt?: string;
}

const STATUS_META: Record<PaymentStatus, { text: string; cls: string }> = {
  initiated: { text: 'Initiated', cls: 'bg-slate-500/20 text-slate-300 border border-slate-500/30' },
  processing: { text: 'Processing', cls: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' },
  success: { text: 'Success', cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
  failed: { text: 'Failed', cls: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' },
};

const toDateInputValue = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function PaymentsPage() {
  const { id } = useParams<{ id: string }>();
  const { getGroup } = useStore();
  const group = getGroup(id);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [status, setStatus] = useState<'all' | PaymentStatus>('all');
  const [city, setCity] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(toDateInputValue(new Date()));

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${id}/payments`, { cache: 'no-store' });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const cityOptions = useMemo(() => {
    const allCities = rows
      .map(r => r.locationTag?.city?.trim())
      .filter((c): c is string => Boolean(c));
    return ['all', ...Array.from(new Set(allCities))];
  }, [rows]);

  const filtered = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;

    return rows.filter(r => {
      if (status !== 'all' && r.status !== status) return false;
      if (city !== 'all' && (r.locationTag?.city ?? '').trim() !== city) return false;

      const created = r.createdAt ? new Date(r.createdAt) : null;
      if (from && created && created < from) return false;
      if (to && created && created > to) return false;
      return true;
    });
  }, [rows, status, city, fromDate, toDate]);

  const totalAmount = filtered.reduce((sum, r) => sum + r.amount, 0);
  const successCount = filtered.filter(r => r.status === 'success').length;

  if (!group) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <h2 className="text-xl font-extrabold text-white">Payment History</h2>
          <p className="text-xs text-slate-400">UPI logs with reminder and location details</p>
        </div>
        <button
          onClick={fetchRows}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-slate-400">Transactions</p>
          <p className="text-lg font-extrabold text-white">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <p className="text-[11px] text-emerald-200/80">Successful</p>
          <p className="text-lg font-extrabold text-emerald-300">{successCount}</p>
        </div>
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
          <p className="text-[11px] text-indigo-200/80">Total Amount</p>
          <p className="text-lg font-extrabold text-indigo-300">₹{totalAmount.toFixed(0)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-slate-400">Cities</p>
          <p className="text-lg font-extrabold text-white">{cityOptions.length - 1}</p>
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-4">
        <select
          value={status}
          onChange={e => setStatus(e.target.value as 'all' | PaymentStatus)}
          className="rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-xs text-white"
        >
          <option value="all">All status</option>
          <option value="initiated">Initiated</option>
          <option value="processing">Processing</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>

        <select
          value={city}
          onChange={e => setCity(e.target.value)}
          className="rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-xs text-white"
        >
          {cityOptions.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'All cities' : c}</option>
          ))}
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          className="rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-xs text-white"
        />

        <input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          className="rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-xs text-white"
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">Loading payments...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">No payment rows match your filters.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(row => {
            const from = group.members.find(m => m.id === row.from);
            const to = group.members.find(m => m.id === row.to);
            return (
              <div key={row._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-white">
                    <span className="font-bold" style={{ color: from?.color }}>{from?.name ?? row.from}</span>
                    <span className="mx-1 text-slate-500">pays</span>
                    <span className="font-bold" style={{ color: to?.color }}>{to?.name ?? row.to}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-white"><ReceiptIndianRupee className="h-4 w-4" />{row.amount.toFixed(2)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[row.status].cls}`}>{STATUS_META[row.status].text}</span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  {row.locationTag?.label && (
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{row.locationTag.label}</span>
                  )}
                  {row.locationTag?.city && <span>{row.locationTag.city}</span>}
                  {row.reminderAt && (
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Reminder: {new Date(row.reminderAt).toLocaleString('en-IN')}</span>
                  )}
                  {row.createdAt && <span>Created: {new Date(row.createdAt).toLocaleString('en-IN')}</span>}
                </div>

                {row.status === 'success' && (
                  <div className="mt-3">
                    <a
                      href={`/api/groups/${id}/payments/${row._id}/calendar`}
                      className="text-xs font-semibold text-indigo-300 underline decoration-dotted hover:text-white"
                    >
                      Download reminder .ics
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
