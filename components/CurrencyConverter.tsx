'use client';
import { useState, useEffect } from 'react';
import { X, ArrowLeftRight, RefreshCw, TrendingUp } from 'lucide-react';
import { useCurrency, SUPPORTED_CURRENCIES } from '@/lib/useCurrency';

interface CurrencyConverterProps {
  onClose: () => void;
  /** Optional pre-filled amount (e.g. group total in INR) */
  initialAmount?: number;
}

export default function CurrencyConverter({ onClose, initialAmount }: CurrencyConverterProps) {
  const { rates, loading, error, convert, getSymbol } = useCurrency();
  const [amount, setAmount] = useState(initialAmount !== undefined ? String(initialAmount) : '');
  const [from, setFrom] = useState('INR');
  const [to, setTo] = useState('USD');

  const numAmount = parseFloat(amount) || 0;
  const converted = convert(numAmount, from, to);

  const fromCurrency = SUPPORTED_CURRENCIES.find(c => c.code === from)!;
  const toCurrency = SUPPORTED_CURRENCIES.find(c => c.code === to)!;

  // Swap currencies
  const handleSwap = () => {
    setFrom(to);
    setTo(from);
  };

  // Live rate for 1 unit of `from` in `to`
  const unitRate = convert(1, from, to);

  // Popular pairs relative to INR for the quick reference
  const popularTargets = ['USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY'].filter(c => c !== from && c !== to).slice(0, 4);

  // Format number nicely
  const fmt = (n: number, code: string) => {
    if (isNaN(n) || !isFinite(n)) return '—';
    const decimals = code === 'JPY' || code === 'KRW' ? 0 : 2;
    return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111118] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className="h-1 bg-linear-to-r from-indigo-500 via-violet-500 to-emerald-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.07]">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-xl">💱</span> Currency Converter
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Live rates · ECB via Frankfurter</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Amount
            </label>
            <input
              autoFocus
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-2xl font-bold text-white placeholder-slate-600 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          {/* From / Swap / To row */}
          <div className="flex items-center gap-3">
            {/* From */}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">From</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none">
                  {fromCurrency?.flag}
                </span>
                <select
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 pl-9 pr-4 py-3 text-sm font-semibold text-white outline-none focus:border-indigo-500/60 transition-all cursor-pointer"
                  style={{ backgroundImage: 'none' }}
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code} className="bg-[#1a1a2e] text-white">
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Swap button */}
            <button
              onClick={handleSwap}
              className="mt-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-300 hover:border-indigo-500/40 transition-all active:scale-90"
              title="Swap currencies"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>

            {/* To */}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">To</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none">
                  {toCurrency?.flag}
                </span>
                <select
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 pl-9 pr-4 py-3 text-sm font-semibold text-white outline-none focus:border-indigo-500/60 transition-all cursor-pointer"
                  style={{ backgroundImage: 'none' }}
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code} className="bg-[#1a1a2e] text-white">
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/8 p-5">
            {loading ? (
              <div className="flex items-center gap-3 text-slate-400">
                <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
                <span className="text-sm">Fetching live rates...</span>
              </div>
            ) : error ? (
              <div className="text-sm text-rose-400">{error}</div>
            ) : (
              <>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">
                  Converted Amount
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl font-extrabold text-white">
                    {getSymbol(to)}{fmt(converted, to)}
                  </span>
                  <span className="text-sm text-slate-400 font-medium">{to}</span>
                </div>

                {/* Exchange rate info */}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span>
                    1 {from} = <span className="text-white font-semibold">{fmt(unitRate, to)} {to}</span>
                  </span>
                  {rates?.updatedAt && (
                    <span className="ml-auto text-slate-600">
                      Updated {new Date(rates.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Quick reference — other popular conversions */}
          {!loading && !error && numAmount > 0 && popularTargets.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Quick Reference
              </div>
              <div className="grid grid-cols-2 gap-2">
                {popularTargets.map(code => {
                  const cur = SUPPORTED_CURRENCIES.find(c => c.code === code)!;
                  const val = convert(numAmount, from, code);
                  return (
                    <button
                      key={code}
                      onClick={() => setTo(code)}
                      className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/3 px-3 py-2.5 text-left hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group"
                    >
                      <span className="text-base">{cur.flag}</span>
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                          {getSymbol(code)}{fmt(val, code)}
                        </div>
                        <div className="text-[10px] text-slate-600">{code}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer note */}
          <p className="text-center text-[11px] text-slate-600">
            Rates are indicative · Powered by Frankfurter (ECB) · Free &amp; no API key
          </p>
        </div>
      </div>
    </div>
  );
}
