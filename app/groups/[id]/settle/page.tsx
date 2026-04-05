"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Script from "next/script";
import {
  Zap,
  ArrowRight,
  Check,
  TrendingDown,
  Users,
  Receipt,
  DollarSign,
  Loader2,
  CreditCard,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  calculateSettlements,
  naiveTransactionCount,
  Transaction,
} from "@/lib/settlement";
import { generateTransactionReceipt } from "@/lib/pdf-utils";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaidRecord {
  from: string;
  to: string;
  amount: number;
}
interface PaymentRecord {
  _id: string;
  from: string;
  to: string;
  amount: number;
  status: "initiated" | "processing" | "success" | "failed";
  reminderAt?: string;
  locationTag?: { label?: string; city?: string };
  createdAt?: string;
}
interface PayDraft {
  payAmount: string;
  amountMode: "manual" | "full" | "half" | "random";
  city: string;
  note: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export default function SettlePage() {
  const { id } = useParams<{ id: string }>();
  const { getGroup, getGroupExpenses, getNetBalances } = useStore();
  const [optimized, setOptimized] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [paidRecords, setPaidRecords] = useState<PaidRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [payDrafts, setPayDrafts] = useState<Record<string, PayDraft>>({});
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [cityTouched, setCityTouched] = useState<Record<string, boolean>>({});
  const group = getGroup(id);
  const expenses = getGroupExpenses(id);

  // ── Fetch existing paid records ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`/api/groups/${id}/settlements`).then((r) =>
        r.ok ? r.json() : [],
      ),
      fetch(`/api/groups/${id}/payments`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([settlements, paymentRows]) => {
        setPaidRecords(
          settlements.map(
            (r: { from: string; to: string; amount: number }) => ({
              from: r.from,
              to: r.to,
              amount: r.amount,
            }),
          ),
        );
        setPayments(paymentRows);
        if (settlements.length > 0) setOptimized(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (!group) return null;

  const netBalances = getNetBalances(id);
  const transactions: Transaction[] = calculateSettlements(
    netBalances,
    group.members,
  );
  const naive = naiveTransactionCount(netBalances);
  const optimizedCount = transactions.length;
  const reduction =
    naive > 0 ? Math.round(((naive - optimizedCount) / naive) * 100) : 0;
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

  const getMember = (mid: string) => group.members.find((m) => m.id === mid);
  const txnKey = (txn: Transaction) => `${txn.from}-${txn.to}-${txn.amount}`;
  const emptyDraft = (): PayDraft => ({
    payAmount: "",
    amountMode: "full",
    city: "",
    note: "",
  });
  const getDraft = (key: string): PayDraft => payDrafts[key] ?? emptyDraft();
  const updateDraft = (key: string, patch: Partial<PayDraft>) => {
    setPayDrafts((prev) => ({
      ...prev,
      [key]: { ...getDraft(key), ...patch },
    }));
  };

  const getPaidAmount = (txn: Transaction) => {
    const total = payments
      .filter(
        (p) => p.status === "success" && p.from === txn.from && p.to === txn.to,
      )
      .reduce((sum, p) => sum + p.amount, 0);
    return round2(Math.min(total, txn.amount));
  };

  const getRemaining = (txn: Transaction) =>
    round2(Math.max(0, txn.amount - getPaidAmount(txn)));

  const getPayAmountFromDraft = (draft: PayDraft, remaining: number) => {
    const manualAmount = draft.payAmount.trim()
      ? Number(draft.payAmount)
      : remaining;
    return draft.amountMode === "full"
      ? remaining
      : draft.amountMode === "half"
        ? round2(Math.max(1, remaining / 2))
        : manualAmount;
  };

  const isPaid = (txn: Transaction) =>
    paidRecords.some(
      (r) => r.from === txn.from && r.to === txn.to && r.amount === txn.amount,
    ) || getRemaining(txn) <= 0;

  const handleOptimize = () => {
    if (optimized) return;
    setAnimating(true);
    setTimeout(() => {
      setOptimized(true);
      setAnimating(false);
    }, 800);
  };

  const togglePaid = async (txn: Transaction) => {
    const key = txnKey(txn);
    setSaving(key);
    const draft = getDraft(key);
    const remaining = getRemaining(txn);
    const payAmount = getPayAmountFromDraft(draft, remaining);
    const alreadyPaid = isPaid(txn);

    if (!alreadyPaid) {
      if (!draft.city.trim()) {
        setCityTouched((prev) => ({ ...prev, [key]: true }));
        setFeedback({ type: "error", text: "City is required." });
        setSaving(null);
        return;
      }
      if (!(payAmount >= 1)) {
        setFeedback({ type: "error", text: "Amount must be at least ₹1." });
        setSaving(null);
        return;
      }
      if (payAmount > remaining) {
        setFeedback({
          type: "error",
          text: `Amount exceeds remaining ₹${remaining.toFixed(2)}.`,
        });
        setSaving(null);
        return;
      }
    }

    try {
      if (alreadyPaid) {
        await fetch(`/api/groups/${id}/settlements`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: txn.from,
            to: txn.to,
            amount: txn.amount,
          }),
        });
        setPaidRecords((p) =>
          p.filter(
            (r) =>
              !(
                r.from === txn.from &&
                r.to === txn.to &&
                r.amount === txn.amount
              ),
          ),
        );
      } else {
        const res = await fetch(`/api/groups/${id}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: txn.from,
            to: txn.to,
            amount: payAmount,
            targetAmount: txn.amount,
            city: draft.city.trim() || undefined,
            reminderAt: new Date().toISOString(),
            note: draft.note.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.error || "Failed to save cash payment");

        if (data?.transaction) {
          const cashTxn = data.transaction as PaymentRecord;
          setPayments((prev) => [cashTxn, ...prev]);
        }

        if (
          data?.settlement ||
          data?.alreadySettled ||
          Number(data?.remaining ?? 0) <= 0
        ) {
          setPaidRecords((prev) => {
            const exists = prev.some(
              (r) =>
                r.from === txn.from &&
                r.to === txn.to &&
                r.amount === txn.amount,
            );
            return exists
              ? prev
              : [...prev, { from: txn.from, to: txn.to, amount: txn.amount }];
          });
        }

        const remainingAfter = Number(
          data?.remaining ?? Math.max(0, remaining - payAmount),
        );
        if (remainingAfter <= 0) {
          setFeedback({
            type: "success",
            text: "Cash payment saved. Fully settled.",
          });
        } else {
          setFeedback({
            type: "success",
            text: `Cash payment saved. ₹${remainingAfter.toFixed(2)} still remaining.`,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const handlePayNow = async (txn: Transaction, isUpi: boolean = false) => {
    const key = txnKey(txn);
    const draft = getDraft(key);
    const remaining = getRemaining(txn);
    const payAmount = getPayAmountFromDraft(draft, remaining);

    if (!draft.city.trim()) {
      setCityTouched((prev) => ({ ...prev, [key]: true }));
      setFeedback({ type: "error", text: "City is required." });
      return;
    }
    if (!(payAmount >= 1)) {
      setFeedback({ type: "error", text: "Amount must be at least ₹1." });
      return;
    }
    if (payAmount > remaining) {
      setFeedback({
        type: "error",
        text: `Amount exceeds remaining ₹${remaining.toFixed(2)}.`,
      });
      return;
    }
    setSaving(key);
    setFeedback(null);

    try {
      // 1. Create Razorpay order via backend
      const resOrder = await fetch(
        `/api/groups/${id}/payments/razorpay/order`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: txn.from,
            to: txn.to,
            amount: payAmount,
            targetAmount: txn.amount,
            city: draft.city.trim() || undefined,
            reminderAt: new Date().toISOString(),
            note: draft.note.trim() || undefined,
          }),
        },
      );

      const orderData = await resOrder.json();
      if (!resOrder.ok)
        throw new Error(orderData?.error || "Failed to initialize payment");

      const { order, transactionId } = orderData;

      // 2. Initialize Razorpay popup
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Enter the Key ID generated from the Dashboard
        amount: order.amount,
        currency: order.currency,
        name: "PayMatrix Demo",
        description: `Settlement payment`,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            // 3. Verify Payment
            const resVerify = await fetch(
              `/api/groups/${id}/payments/razorpay/verify`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  transactionId,
                  targetAmount: txn.amount,
                }),
              },
            );

            const verifyData = await resVerify.json();
            if (!resVerify.ok)
              throw new Error(
                verifyData?.error || "Payment verification failed",
              );

            // 4. Update UI state on successful verification
            if (verifyData?.transaction) {
              const updatedTxn = verifyData.transaction as PaymentRecord;
              setPayments((prev) => [updatedTxn, ...prev]);

              // Trigger professional PDF receipt download automatically
              if (group) {
                generateTransactionReceipt(updatedTxn, {
                  id: group.id,
                  name: group.name,
                  members: group.members,
                });
              }
            }

            if (
              verifyData?.settlement ||
              verifyData?.alreadySettled ||
              Number(verifyData?.remaining ?? 0) <= 0
            ) {
              setPaidRecords((prev) => {
                const exists = prev.some(
                  (r) =>
                    r.from === txn.from &&
                    r.to === txn.to &&
                    r.amount === txn.amount,
                );
                return exists
                  ? prev
                  : [
                      ...prev,
                      { from: txn.from, to: txn.to, amount: txn.amount },
                    ];
              });
            }

            const remainingAfter = Number(
              verifyData?.remaining ?? Math.max(0, remaining - payAmount),
            );
            if (remainingAfter <= 0) {
              setFeedback({
                type: "success",
                text: "Payment successful. Fully settled.",
              });
            } else {
              setFeedback({
                type: "success",
                text: `Payment successful. ₹${remainingAfter.toFixed(2)} still remaining.`,
              });
            }
          } catch (err) {
            setFeedback({
              type: "error",
              text: err instanceof Error ? err.message : "Verification failed",
            });
          } finally {
            setSaving(null);
          }
        },
        prefill: {
          name: group.members.find((m) => m.id === txn.from)?.name || "User",
        },
        theme: {
          color: "#6366f1",
        },
        modal: {
          ondismiss: function () {
            setSaving(null);
            setFeedback({ type: "error", text: "Payment cancelled by user." });
          },
        },
        ...(isUpi
          ? {
              config: {
                display: {
                  blocks: {
                    upi: {
                      name: "Pay via UPI",
                      instruments: [{ method: "upi" }],
                    },
                  },
                  sequence: ["block.upi"],
                  preferences: { show_default_blocks: true },
                },
              },
            }
          : {}),
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setSaving(null);
        setFeedback({
          type: "error",
          text: `Payment Failed: ${response.error.description}`,
        });
      });
      rzp.open();
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to initialize Razorpay checkout",
      });
      setSaving(null);
    }
  };

  const allSettled = transactions.length > 0 && transactions.every(isPaid);
  const settledCount = transactions.filter(isPaid).length;

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-slate-400 text-sm">Loading settlement records...</p>
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
      {/* Hero */}
      <div className="mb-8 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500/30 to-violet-500/20 border border-indigo-500/30 mb-4">
          <Zap className="h-8 w-8 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-extrabold text-white">
          Settlement Optimizer
        </h2>
        <p className="mt-1 text-slate-400 text-sm">
          Min-Cash-Flow algorithm · Payments tracked automatically
        </p>
      </div>

      {feedback && (
        <div
          className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-300" : "border-rose-500/25 bg-rose-500/8 text-rose-300"}`}
        >
          {feedback.text}
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          {
            icon: Users,
            label: "People",
            value: group.members.length,
            color: "text-indigo-400",
          },
          {
            icon: DollarSign,
            label: "Total",
            value: `₹${totalAmount.toLocaleString("en-IN")}`,
            color: "text-emerald-400",
          },
          {
            icon: Receipt,
            label: "Expenses",
            value: expenses.length,
            color: "text-violet-400",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4 text-center"
          >
            <s.icon className={`mx-auto mb-1 h-4 w-4 ${s.color}`} />
            <div className="text-lg font-extrabold text-white">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {!optimized ? (
        <>
          <div className="mb-6 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Without Optimization
              </span>
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-bold text-rose-400">
                UNOPTIMIZED
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-4xl font-black text-rose-400">{naive}</div>
              <div className="text-sm text-slate-400">
                potential transactions
                <br />
                <span className="text-slate-500 text-xs">
                  Each debtor pays each creditor directly
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleOptimize}
            id="optimize-btn"
            disabled={animating || transactions.length === 0}
            className={`w-full rounded-2xl py-4 text-base font-extrabold transition-all ${animating ? "bg-indigo-600/50 text-indigo-300 cursor-wait" : transactions.length === 0 ? "bg-white/5 text-slate-400 border border-white/10 cursor-not-allowed" : "bg-linear-to-r from-indigo-600 to-violet-600 text-white hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] hover:-translate-y-0.5"}`}
          >
            {animating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Optimizing...
              </span>
            ) : transactions.length === 0 ? (
              "✅ Everyone is settled up!"
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Zap className="h-5 w-5" /> ⚡ Optimize Settlements
              </span>
            )}
          </button>

          {transactions.length === 0 && (
            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] p-5 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <p className="font-bold text-emerald-400">
                All debts are settled!
              </p>
              <p className="text-sm text-slate-400 mt-1">
                No transactions needed.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Before vs After */}
          {/* <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/6 p-4 text-center">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Before
              </div>
              <div className="text-3xl font-black text-rose-400">{naive}</div>
              <div className="text-xs text-slate-400">transactions</div>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-4 text-center">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                After ⚡
              </div>
              <div className="text-3xl font-black text-emerald-400">
                {optimizedCount}
              </div>
              <div className="text-xs text-slate-400">transactions</div>
            </div>
          </div> */}

          {reduction > 0 && (
            <div className="mb-5 flex items-center justify-center gap-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.07] px-4 py-3">
              <TrendingDown className="h-5 w-5 text-indigo-400" />
              <span className="text-indigo-300 font-bold">
                {reduction}% fewer transactions
              </span>
              <span className="text-slate-400 text-sm">
                — saving {naive - optimizedCount} payments
              </span>
            </div>
          )}

          {/* Progress bar */}
          {transactions.length > 0 && (
            <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-400 font-semibold">
                  Settlement Progress
                </span>
                <span className="text-white font-bold">
                  {settledCount} / {transactions.length} paid
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-linear-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                  style={{
                    width: `${transactions.length > 0 ? (settledCount / transactions.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {allSettled && transactions.length > 0 && (
            <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4 text-center">
              <div className="text-2xl mb-1">🎉</div>
              <p className="font-bold text-emerald-400">
                All transactions settled!
              </p>
            </div>
          )}

          {/* Transactions */}
          <div className="space-y-3">
            {transactions.map((txn, i) => {
              const from = getMember(txn.from);
              const to = getMember(txn.to);
              const key = txnKey(txn);
              const draft = getDraft(key);
              const paidAmount = getPaidAmount(txn);
              const remaining = getRemaining(txn);
              const isAmountLocked =
                draft.amountMode === "full" || draft.amountMode === "half";
              const currentPayAmount =
                draft.amountMode === "full"
                  ? remaining.toFixed(2)
                  : draft.amountMode === "half"
                    ? round2(Math.max(1, remaining / 2)).toFixed(2)
                    : draft.payAmount;
              const isSettled = isPaid(txn);
              const isSaving = saving === key;
              const showCityError = Boolean(cityTouched[key]) && !draft.city.trim();

              return (
                <div
                  key={key}
                  className={`rounded-2xl border p-4 transition-all ${isSettled ? "border-emerald-500/20 bg-emerald-500/4 opacity-70" : "border-white/8 bg-white/4 hover:border-white/15"}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isSettled ? "bg-emerald-500/20 text-emerald-400" : "bg-indigo-500/20 text-indigo-400"}`}
                    >
                      {isSettled ? <Check className="h-4 w-4" /> : i + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ backgroundColor: from?.color }}
                      >
                        {from?.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-white text-sm">
                        {from?.name}
                      </span>
                    </div>
                    <div className="flex flex-1 items-center gap-1 justify-center">
                      <div className="h-px flex-1 bg-linear-to-r from-rose-500/50 to-emerald-500/50" />
                      <div className="shrink-0 px-2 text-center">
                        <div className="text-base font-extrabold text-white">
                          ₹{txn.amount.toFixed(0)}
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 mx-auto" />
                      </div>
                      <div className="h-px flex-1 bg-linear-to-r from-emerald-500/50 to-emerald-500/20" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">
                        {to?.name}
                      </span>
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ backgroundColor: to?.color }}
                      >
                        {to?.name.charAt(0)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    <p className="text-xs text-slate-400">
                      <span style={{ color: from?.color }}>{from?.name}</span>{" "}
                      pays <span style={{ color: to?.color }}>{to?.name}</span>{" "}
                      ₹{txn.amount.toFixed(2)}
                      {isSettled && (
                        <span className="ml-2 text-emerald-400 font-semibold">
                          · Settled ✓
                        </span>
                      )}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-300">
                        Paid: ₹{paidAmount.toFixed(2)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-1 ${remaining > 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}
                      >
                        Remaining: ₹{remaining.toFixed(2)}
                      </span>
                    </div>

                    {!isSettled && (
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="md:col-span-2 grid gap-2 md:grid-cols-4">
                          <input
                            type="number"
                            min="1"
                            max={remaining}
                            step="0.01"
                            value={currentPayAmount}
                            onChange={(e) => {
                              const raw = e.target.value;
                              updateDraft(key, {
                                payAmount: raw,
                                amountMode: "manual",
                              });
                            }}
                            onBlur={(e) => {
                              const raw = e.target.value.trim();
                              if (!raw) {
                                updateDraft(key, { payAmount: "" });
                                return;
                              }
                              const parsed = Number(raw);
                              if (Number.isNaN(parsed)) {
                                updateDraft(key, { payAmount: "1.00" });
                                return;
                              }
                              const clamped = round2(
                                Math.min(remaining, Math.max(1, parsed)),
                              );
                              updateDraft(key, {
                                payAmount: clamped.toFixed(2),
                              });
                            }}
                            placeholder="Amount to pay now"
                            disabled={isAmountLocked}
                            className={`rounded-lg border px-3 py-2 text-xs text-white placeholder:text-slate-500 ${isAmountLocked ? "border-white/10 bg-white/3 opacity-70 cursor-not-allowed" : "border-white/10 bg-white/5"}`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft(key, {
                                amountMode: "full",
                                payAmount: remaining.toFixed(2),
                              })
                            }
                            className={`rounded-lg border px-3 py-2 text-xs transition-colors ${draft.amountMode === "full" ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                          >
                            Full
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft(key, {
                                amountMode: "half",
                                payAmount: round2(
                                  Math.max(1, remaining / 2),
                                ).toFixed(2),
                              })
                            }
                            className={`rounded-lg border px-3 py-2 text-xs transition-colors ${draft.amountMode === "half" ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                          >
                            Half
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const start = round2(Math.min(remaining, 1));
                              updateDraft(key, {
                                amountMode: "random",
                                payAmount: start.toFixed(2),
                              });
                            }}
                            className={`rounded-lg border px-3 py-2 text-xs transition-colors ${draft.amountMode === "random" ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                          >
                            Random
                          </button>
                        </div>

                        <input
                          value={draft.city}
                          onChange={(e) => {
                            updateDraft(key, { city: e.target.value });
                            if (cityTouched[key]) {
                              setCityTouched((prev) => ({ ...prev, [key]: true }));
                            }
                          }}
                          onBlur={() =>
                            setCityTouched((prev) => ({ ...prev, [key]: true }))
                          }
                          placeholder="City"
                          required
                          className={`rounded-lg border bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 ${showCityError ? "border-rose-500/70" : "border-white/10"}`}
                        />
                        <input
                          value={draft.note}
                          onChange={(e) =>
                            updateDraft(key, { note: e.target.value })
                          }
                          placeholder="Optional note"
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500"
                        />
                        {showCityError && (
                          <p className="md:col-span-2 text-[11px] text-rose-300">City is required.</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      {!isSettled && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePayNow(txn, true)}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 rounded-lg bg-linear-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                          >
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Zap className="h-3 w-3" />
                            )}
                            UPI
                          </button>
                          <button
                            onClick={() => handlePayNow(txn)}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 rounded-lg bg-linear-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                          >
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CreditCard className="h-3 w-3" />
                            )}
                            Cards / NetBanking
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => togglePaid(txn)}
                        disabled={isSaving}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${isSettled ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10"}`}
                      >
                        {isSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        {isSettled ? "Unmark Paid" : "Paid as cash"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => {
              setOptimized(false);
            }}
            className="mt-4 w-full rounded-xl border border-white/10 py-2.5 text-sm text-slate-400 hover:bg-white/5 transition-all"
          >
            ↺ Reset View
          </button>
        </>
      )}
    </div>
  );
}
