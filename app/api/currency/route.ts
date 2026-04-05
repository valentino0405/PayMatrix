import { NextResponse } from 'next/server';

// Cache rates for 1 hour to avoid hammering the free API
let cachedRates: Record<string, number> | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET() {
  try {
    // Return cached rates if still fresh
    if (cachedRates && Date.now() - cacheTime < CACHE_TTL) {
      return NextResponse.json({
        base: 'INR',
        rates: cachedRates,
        updatedAt: new Date(cacheTime).toISOString(),
        cached: true,
      });
    }

    // Frankfurter gives rates FROM a base currency.
    // We fetch with base=EUR and include INR, then compute everything relative to INR.
    const res = await fetch(
      'https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,INR,AED,SGD,JPY,AUD,CAD,CHF,CNY,THB,MYR,NZD,SEK,NOK,DKK,ZAR,BRL,MXN,HKD,KRW',
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) throw new Error(`Frankfurter API error: ${res.status}`);

    const data = await res.json();
    // data.rates is relative to EUR. We need relative to INR.
    const eurToInr: number = data.rates['INR'];

    // Compute all rates relative to INR
    const ratesFromInr: Record<string, number> = { INR: 1, EUR: 1 / eurToInr };
    for (const [currency, rate] of Object.entries(data.rates as Record<string, number>)) {
      if (currency === 'INR') continue;
      // rate = EUR→currency, eurToInr = EUR→INR
      // INR→currency = rate / eurToInr
      ratesFromInr[currency] = (rate as number) / eurToInr;
    }

    cachedRates = ratesFromInr;
    cacheTime = Date.now();

    return NextResponse.json({
      base: 'INR',
      rates: ratesFromInr,
      updatedAt: new Date(cacheTime).toISOString(),
      cached: false,
    });
  } catch (err) {
    console.error('Currency API error:', err);
    return NextResponse.json({ error: 'Failed to fetch exchange rates' }, { status: 500 });
  }
}
