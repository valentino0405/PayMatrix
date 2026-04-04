import Link from 'next/link';
import { ScanLine } from 'lucide-react';
import ReceiptScanner from '@/components/receipt-scanner';

export const metadata = {
  title: 'Scan Receipt — PayMatrix',
  description: 'Upload a receipt photo and let PayMatrix auto-extract the amount, date, and description using OCR.',
};

export default function ScanPage() {
  return (
    <main className="min-h-screen bg-[#07070f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-125 w-125 rounded-full bg-indigo-700/15 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-100 w-100 rounded-full bg-violet-700/10 blur-[120px]" />
      </div>
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07070f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
            <ScanLine className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Receipt Scanner</h1>
            <p className="text-xs text-slate-500">Powered by Tesseract OCR</p>
          </div>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-white/10 hover:text-white"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        {/* Intro */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
            <ScanLine className="h-3.5 w-3.5" />
            Tesseract OCR
          </div>
          <p className="mx-auto max-w-xl text-slate-400">
            Upload a photo of any receipt or invoice. PayMatrix will extract the{' '}
            <strong className="text-white">amount</strong>,{' '}
            <strong className="text-white">date</strong>, and{' '}
            <strong className="text-white">description</strong> and pre-fill your expense form.
          </p>
        </div>

        {/* Scanner */}
        <ReceiptScanner />
      </div>
    </main>
  );
}
