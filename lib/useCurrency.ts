'use client';
import { useState, useEffect, useCallback } from 'react';

export interface CurrencyRates {
  base: string;
  rates: Record<string, number>;
  updatedAt: string;
}

// Session-level cache so we don't re-fetch on every component mount
let sessionCache: CurrencyRates | null = null;
let sessionFetchPromise: Promise<CurrencyRates> | null = null;

export const SUPPORTED_CURRENCIES: { code: string; name: string; symbol: string; flag: string }[] = [
  { code: 'INR', name: 'Indian Rupee',        symbol: '₹',  flag: '🇮🇳' },
  { code: 'USD', name: 'US Dollar',            symbol: '$',  flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro',                 symbol: '€',  flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound',        symbol: '£',  flag: '🇬🇧' },
  { code: 'AED', name: 'UAE Dirham',           symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SGD', name: 'Singapore Dollar',     symbol: 'S$', flag: '🇸🇬' },
  { code: 'JPY', name: 'Japanese Yen',         symbol: '¥',  flag: '🇯🇵' },
  { code: 'AUD', name: 'Australian Dollar',    symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar',      symbol: 'C$', flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc',          symbol: 'Fr', flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan',         symbol: '¥',  flag: '🇨🇳' },
  { code: 'THB', name: 'Thai Baht',            symbol: '฿',  flag: '🇹🇭' },
  { code: 'MYR', name: 'Malaysian Ringgit',    symbol: 'RM', flag: '🇲🇾' },
  { code: 'NZD', name: 'New Zealand Dollar',   symbol: 'NZ$', flag: '🇳🇿' },
  { code: 'HKD', name: 'Hong Kong Dollar',     symbol: 'HK$', flag: '🇭🇰' },
  { code: 'SEK', name: 'Swedish Krona',        symbol: 'kr', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone',      symbol: 'kr', flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone',         symbol: 'kr', flag: '🇩🇰' },
  { code: 'ZAR', name: 'South African Rand',   symbol: 'R',  flag: '🇿🇦' },
  { code: 'BRL', name: 'Brazilian Real',       symbol: 'R$', flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso',         symbol: '$',  flag: '🇲🇽' },
  { code: 'KRW', name: 'South Korean Won',     symbol: '₩',  flag: '🇰🇷' },
];

async function fetchRates(): Promise<CurrencyRates> {
  if (sessionCache) return sessionCache;
  if (sessionFetchPromise) return sessionFetchPromise;

  sessionFetchPromise = fetch('/api/currency')
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch rates');
      return res.json();
    })
    .then(data => {
      sessionCache = data;
      sessionFetchPromise = null;
      return data as CurrencyRates;
    })
    .catch(err => {
      sessionFetchPromise = null;
      throw err;
    });

  return sessionFetchPromise;
}

export function useCurrency() {
  const [rates, setRates] = useState<CurrencyRates | null>(sessionCache);
  const [loading, setLoading] = useState(!sessionCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionCache) {
      setRates(sessionCache);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchRates()
      .then(data => { setRates(data); setLoading(false); })
      .catch(() => { setError('Could not load exchange rates'); setLoading(false); });
  }, []);

  const convert = useCallback((amount: number, from: string, to: string): number => {
    if (!rates || from === to) return amount;
    const fromRate = rates.rates[from] ?? 1; // rate relative to INR base
    const toRate = rates.rates[to] ?? 1;
    // amount in `from` → INR → `to`
    const inInr = amount / fromRate;
    return inInr * toRate;
  }, [rates]);

  const getSymbol = useCallback((code: string) =>
    SUPPORTED_CURRENCIES.find(c => c.code === code)?.symbol ?? code, []);

  return { rates, loading, error, convert, getSymbol };
}
