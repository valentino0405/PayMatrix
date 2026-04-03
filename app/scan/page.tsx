import { ScanLine } from 'lucide-react';
import ReceiptScanner from '@/components/receipt-scanner';

export const metadata = {
  title: 'Scan Receipt — PayMatrix',
  description: 'Upload a receipt photo and let PayMatrix auto-extract the amount, date, and description using OCR.',
};

export default function ScanPage() {
  return (
    <main className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <div className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-5 sm:px-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
            <ScanLine className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-800">Receipt Scanner</h1>
            <p className="text-xs text-slate-400">Powered by Tesseract OCR</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8">
        {/* Intro */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-medium text-indigo-500">
            <ScanLine className="h-3.5 w-3.5" />
            Tesseract OCR
          </div>
          <p className="mx-auto max-w-xl text-slate-500">
            Upload a photo of any receipt or invoice. PayMatrix will extract the{' '}
            <strong className="text-slate-700">amount</strong>,{' '}
            <strong className="text-slate-700">date</strong>, and{' '}
            <strong className="text-slate-700">description</strong> and pre-fill your expense form.
          </p>
        </div>

        {/* Scanner */}
        <ReceiptScanner />
      </div>
    </main>
  );
}
