import Link from 'next/link';
import { ArrowRight, Bot, ChevronRight, PieChart, ScanLine, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/HomeComponents/Navbar';

const featureCards = [
  {
    icon: Zap,
    title: 'Min Cash Flow',
    desc: 'Optimizes settlements to reduce the total number of transactions using graph algorithms.',
  },
  {
    icon: Users,
    title: 'Group Management',
    desc: 'Create groups, add members, and track expenses with equal, unequal, or percentage splits.',
  },
  {
    icon: PieChart,
    title: 'Visual Insights',
    desc: 'Category-wise spending charts and trend analysis to understand your group finances.',
  },
  {
    icon: Bot,
    title: 'NLP Input',
    desc: 'Type "Paid 500 for food" and PayMatrix auto-extracts amount, category, and details.',
  },
  {
    icon: ScanLine,
    title: 'Receipt Scanner',
    desc: 'Snap a photo of any receipt — Tesseract OCR auto-fills the amount, date, and merchant.',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f5f6fa] text-slate-900">
      <Navbar/>

      <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-5 pb-16 pt-24 text-center sm:px-8 md:pb-20 md:pt-28">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-medium text-indigo-500 sm:text-sm">
          <Zap className="h-3.5 w-3.5" />
          AI-Powered Settlement Optimizer
        </div>

        <h1 className="mt-8 max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl md:text-7xl">
          Split expenses.
          <br />
          <span className="text-indigo-600">Settle smarter.</span>
        </h1>

        <p className="mt-7 max-w-2xl text-pretty text-base leading-relaxed text-slate-500 sm:text-xl">
          PayMatrix minimizes the number of transactions in your group using graph optimization algorithms. Add expenses naturally,
          settle with fewer payments.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/dashboard">
            <Button className="h-11 rounded-xl bg-indigo-600 px-8 text-[15px] font-medium text-white hover:bg-indigo-500">
              Get Started
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/scan">
            <Button
              variant="outline"
              className="h-11 rounded-xl border-slate-300 bg-white px-8 text-[15px] font-medium text-slate-800 hover:bg-slate-100"
            >
              <ScanLine className="h-4 w-4" />
              Scan a Receipt
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8 md:pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {featureCards.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-[0_4px_18px_rgba(15,23,42,0.03)]"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
                <feature.icon className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{feature.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">© 2026 PayMatrix - Smart Expense Settlement System</div>
      </footer>
    </main>
  );
}
