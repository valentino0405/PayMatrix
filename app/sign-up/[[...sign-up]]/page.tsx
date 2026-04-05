import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

const authAppearance = {
  variables: {
    colorPrimary: "#6366f1",
    colorBackground: "#0f1020",
    colorInputBackground: "#12142a",
    colorInputText: "#e2e8f0",
    colorText: "#f8fafc",
    colorTextSecondary: "#cbd5e1",
    borderRadius: "0.875rem",
  },
  elements: {
    card: "bg-[#0f1020] border border-white/10 shadow-2xl shadow-black/40",
    headerTitle: "!text-slate-50",
    headerSubtitle: "!text-slate-300",
    socialButtonsBlockButton:
      "!border !border-white bg-white/5 text-slate-200 hover:bg-white/10 [&_.cl-badge]:!border [&_.cl-badge]:!border-white/80 [&_.cl-badge]:!bg-white/20 [&_.cl-badge]:!text-slate-50 [&_.cl-badge]:!opacity-100",
    socialButtonsBlockButtonText: "!text-slate-200",
    badge: "!border !border-white/80 !bg-white/20 !text-slate-50 !opacity-100",
    dividerLine: "bg-white/10",
    dividerText: "!text-slate-400",
    formFieldLabel: "!text-slate-200",
    formFieldInput:
      "border border-white/10 bg-[#12142a] text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:ring-indigo-400/30",
    formButtonPrimary:
      "bg-indigo-500 text-white hover:bg-indigo-400 focus-visible:ring-indigo-400",
    footerActionText: "!text-slate-300",
    footerActionLink: "!text-emerald-400 hover:!text-emerald-300",
    identityPreviewText: "!text-slate-200",
    formFieldAction: "!text-slate-300 hover:!text-white",
  },
};

export default function SignUpPage() {
  return (
    <main className="relative min-h-screen overflow-y-auto bg-[#07070f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-125 w-125 rounded-full bg-indigo-700/15 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-100 w-100 rounded-full bg-violet-700/10 blur-[120px]" />
      </div>

      <header className="fixed inset-x-0 top-0 z-20 border-b border-white/10 bg-[#07070f]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-sm font-bold">
            <span className="text-indigo-400">Pay</span><span className="text-emerald-400">Matrix</span>
          </Link>
          <Link href="/" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-all hover:bg-white/10 hover:text-white">
            Home
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex min-h-screen items-start justify-center px-4 pb-8 pt-20 sm:items-center sm:pb-10 sm:pt-24">
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          // appearance={authAppearance}
        />
      </div>
    </main>
  );
}
