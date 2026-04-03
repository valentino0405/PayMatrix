'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Tesseract from 'tesseract.js';
import {
  CheckCircle2,
  FileImage,
  Loader2,
  ScanLine,
  Upload,
  X,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
interface ParsedReceipt {
  amount: string;
  date: string;
  description: string;
}

/* ─── Helpers ────────────────────────────────────────────── */
function parseReceiptText(text: string): ParsedReceipt {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  /* Amount — look for "total / grand total / amount due" near a $ value */
  let amount = '';
  const amountPatterns = [
    /(?:grand\s+total|total\s+amount|amount\s+due|total)[^\d]*(\$?\s*[\d,]+\.?\d{0,2})/i,
    /\$\s*([\d,]+\.?\d{0,2})/i,
    /([\d,]+\.\d{2})/,
  ];
  for (const pat of amountPatterns) {
    const m = text.match(pat);
    if (m) {
      amount = m[1].replace(/,/g, '').trim();
      if (!amount.startsWith('$')) amount = `$${amount}`;
      break;
    }
  }

  /* Date — common receipt date formats */
  let date = '';
  const datePatterns = [
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/,
    /\b(\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/,
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/i,
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) { date = m[1]; break; }
  }

  /* Description — first meaningful line (skip blank / pure-digit lines) */
  const description = lines.find(
    (l) => l.length > 2 && !/^[\d\s\.\,\$\/\-]+$/.test(l),
  ) ?? '';

  return { amount, date, description };
}

/* ─── Component ───────────────────────────────────────────── */
export default function ReceiptScanner() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  /* ── file handling ── */
  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG, PNG, WEBP, etc.).');
      return;
    }
    setError('');
    setRawText('');
    setParsed(null);
    setProgress(0);
    setProgressLabel('');
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }, []);

  /* ── scan ── */
  const handleScan = async () => {
    if (!preview) return;
    setScanning(true);
    setError('');
    setProgress(0);
    setProgressLabel('Initialising…');

    try {
      const result = await Tesseract.recognize(preview, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round((m.progress ?? 0) * 100));
            setProgressLabel(`Recognising text… ${Math.round((m.progress ?? 0) * 100)}%`);
          } else {
            setProgressLabel(m.status ?? '');
          }
        },
      });
      const text = result.data.text;
      setRawText(text);
      setParsed(parseReceiptText(text));
      setProgress(100);
      setProgressLabel('Done!');
    } catch (err) {
      setError(`OCR failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
    }
  };

  /* ── navigate to add-expense ── */
  const handleUseData = () => {
    if (!parsed) return;
    const params = new URLSearchParams({
      amount: parsed.amount.replace('$', ''),
      date: parsed.date,
      description: parsed.description,
    });
    router.push(`/dashboard/add-expense?${params.toString()}`);
  };

  /* ── clear ── */
  const handleClear = () => {
    setPreview(null);
    setFileName('');
    setRawText('');
    setParsed(null);
    setProgress(0);
    setProgressLabel('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  /* ─── Render ─────────────────────────────────────────── */
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">

      {/* ── Drop Zone ── */}
      <div
        id="receipt-dropzone"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          'relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-colors',
          dragging
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/40',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          id="receipt-file-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {preview ? (
          <>
            {/* preview thumbnail */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Receipt preview"
              className="max-h-56 rounded-xl object-contain shadow-md"
            />
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <FileImage className="h-4 w-4 text-indigo-400" />
              {fileName}
            </p>
            <button
              id="receipt-clear-btn"
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="absolute right-3 top-3 rounded-full bg-slate-100 p-1 text-slate-500 hover:bg-red-50 hover:text-red-500"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-400">
              <Upload className="h-6 w-6" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">
                Drag &amp; drop a receipt image here
              </p>
              <p className="mt-1 text-xs text-slate-400">
                or click to browse — JPEG, PNG, WEBP supported
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Scan Button ── */}
      {preview && !scanning && !parsed && (
        <button
          id="receipt-scan-btn"
          type="button"
          onClick={handleScan}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-[0.98]"
        >
          <ScanLine className="h-4 w-4" />
          Scan Receipt
        </button>
      )}

      {/* ── Progress ── */}
      {scanning && (
        <div id="receipt-progress" className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            {progressLabel || 'Processing…'}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <p id="receipt-error" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* ── Results ── */}
      {parsed && (
        <div id="receipt-results" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="font-semibold">Receipt Scanned Successfully</h2>
          </div>

          {/* Parsed fields */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Amount', value: parsed.amount, id: 'result-amount' },
              { label: 'Date', value: parsed.date, id: 'result-date' },
              { label: 'Description', value: parsed.description, id: 'result-description' },
            ].map(({ label, value, id }) => (
              <div key={label} className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
                <p id={id} className="mt-1 truncate text-sm font-semibold text-slate-800">
                  {value || <span className="font-normal italic text-slate-400">Not detected</span>}
                </p>
              </div>
            ))}
          </div>

          {/* Raw text collapsible */}
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-600">
              Show raw extracted text
            </summary>
            <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              {rawText}
            </pre>
          </details>

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              id="receipt-use-data-btn"
              type="button"
              onClick={handleUseData}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-[0.98]"
            >
              Use This Data → Add Expense
            </button>
            <button
              id="receipt-rescan-btn"
              type="button"
              onClick={handleClear}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Scan Another
            </button>
            <Link
              id="receipt-home-btn"
              href="/"
              className="flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              🏠 Back to Home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
