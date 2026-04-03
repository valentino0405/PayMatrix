import Link from 'next/link';
import { ArrowRight, Zap, Users, PieChart, GitMerge, CheckCircle, TrendingDown, Shield } from 'lucide-react';

const features = [
  { icon: Zap, label: 'Min Cash Flow', desc: 'Graph algorithm minimizes the total number of transactions needed to fully settle the group.' },
  { icon: Users, label: 'Group Management', desc: 'Create groups for trips, roommates, or events. Invite members and track everything in one place.' },
  { icon: PieChart, label: 'Visual Debt Graph', desc: 'Interactive graph — nodes are people, edges show who owes whom and how much.' },
  { icon: GitMerge, label: 'Smart Splits', desc: 'Equal, unequal, or percentage splits — PayMatrix handles the math automatically.' },
];

const steps = [
  { n: '01', title: 'Create a Group', desc: 'Name your group, pick a type (Trip, Roommates, Event), and add your friends.' },
  { n: '02', title: 'Add Expenses', desc: 'Log expenses with equal, custom, or percentage splits. Assign who paid.' },
  { n: '03', title: 'Optimize & Settle', desc: 'Hit Optimize — our algorithm finds the fewest transactions to clear all debts.' },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#07070f] text-white overflow-x-hidden">
      {/* radial glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-700/20 blur-[120px]" />
        <div className="absolute top-1/2 -right-60 w-[500px] h-[500px] rounded-full bg-violet-700/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-emerald-700/10 blur-[120px]" />
      </div>

      {/* NAV */}
      <nav className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07070f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-indigo-400">Pay</span><span className="text-emerald-400">Matrix</span>
          </span>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="hidden sm:flex text-sm text-slate-400 hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
            >
              Open App <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-5 pb-20 pt-28 text-center sm:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-8">
          <Zap className="h-3.5 w-3.5" /> Graph-Based Settlement Optimizer
        </div>

        <h1 className="max-w-4xl text-5xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl md:text-7xl">
          Split expenses.{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
            Settle smarter.
          </span>
        </h1>

        <p className="mt-7 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-xl">
          PayMatrix uses the <strong className="text-white">Min-Cash-Flow algorithm</strong> to minimize the number of transactions needed to fully settle your group — fewer payments, zero confusion.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-bold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:-translate-y-0.5"
          >
            Get Started <ArrowRight className="h-4.5 w-4.5" />
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-all"
          >
            View Demo
          </Link>
        </div>

        {/* Stats row */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-center">
          {[
            { val: '75%', label: 'Fewer Transactions' },
            { val: '3', label: 'Split Types' },
            { val: 'Real-time', label: 'Balance Updates' },
            { val: 'Visual', label: 'Debt Graph' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-2xl font-extrabold text-white">{s.val}</div>
              <div className="mt-0.5 text-xs text-slate-500 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
        <h2 className="mb-10 text-center text-3xl font-bold text-white">Everything you need</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(f => (
            <div
              key={f.label}
              className="group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-6 backdrop-blur transition-all hover:border-indigo-500/40 hover:bg-white/[0.06] hover:-translate-y-1"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">{f.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
        <h2 className="mb-12 text-center text-3xl font-bold">How it works</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.n} className="relative flex flex-col items-center text-center">
              {i < steps.length - 1 && (
                <div className="absolute top-7 left-[calc(50%+28px)] hidden w-[calc(100%-56px)] h-px bg-gradient-to-r from-indigo-500/50 to-transparent sm:block" />
              )}
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-indigo-500/40 bg-indigo-500/10 text-xl font-extrabold text-indigo-400">
                {step.n}
              </div>
              <h3 className="text-lg font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="mx-auto mb-20 w-full max-w-4xl px-5 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 to-violet-900/30 p-10 text-center backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-violet-600/5" />
          <div className="relative">
            <div className="mb-3 flex justify-center gap-4 text-emerald-400">
              <CheckCircle className="h-6 w-6" /><TrendingDown className="h-6 w-6" /><Shield className="h-6 w-6" />
            </div>
            <h2 className="text-3xl font-extrabold text-white">Ready to settle up?</h2>
            <p className="mt-3 text-slate-300">No signup required. Create a group and start in seconds.</p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-bold text-white hover:bg-indigo-500 transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]"
            >
              Launch PayMatrix <ArrowRight className="h-4.5 w-4.5" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.07] py-8 text-center text-sm text-slate-600">
        © 2026 PayMatrix — Smart Expense Settlement System
      </footer>
    </main>
  );
}
