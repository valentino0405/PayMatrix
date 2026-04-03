'use client';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Check, Zap, BarChart3, Scale, ListTodo } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/lib/store';

const TABS = [
  { label: 'Expenses', href: '', icon: ListTodo },
  { label: 'Balances', href: '/balances', icon: Scale },
  { label: 'Settle ⚡', href: '/settle', icon: Zap },
  { label: 'Graph', href: '/graph', icon: BarChart3 },
];

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { getGroup } = useStore();
  const [copied, setCopied] = useState(false);

  const group = getGroup(id);

  if (!group) {
    router.replace('/dashboard');
    return null;
  }

  const base = `/groups/${id}`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(`Join my group "${group.name}" on PayMatrix! Code: ${group.inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-700/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07070f]/90 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          {/* Top bar */}
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold text-white">{group.name}</h1>
                <span className="shrink-0 rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-400">{group.type}</span>
              </div>
            </div>
            {/* Members */}
            <div className="hidden sm:flex items-center gap-1">
              {group.members.slice(0, 5).map(m => (
                <div
                  key={m.id}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white text-[10px] font-bold ring-2 ring-[#07070f]"
                  style={{ backgroundColor: m.color }}
                  title={m.name}
                >
                  {m.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {group.members.length > 5 && (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px] text-slate-400 ring-2 ring-[#07070f]">
                  +{group.members.length - 5}
                </div>
              )}
            </div>
            <button
              onClick={handleCopyInvite}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-all"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied!' : 'Invite'}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 pb-0">
            {TABS.map(tab => {
              const href = base + tab.href;
              const isActive = tab.href === '' ? pathname === base : pathname.startsWith(href);
              return (
                <Link
                  key={tab.label}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                    isActive
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
