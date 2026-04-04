"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { Show, UserButton } from "@clerk/nextjs";

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#07070f]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="text-xl font-semibold tracking-tight text-slate-700"
        >
          <span className="text-indigo-400">Pay</span>
          <span className="text-emerald-400">Matrix</span>
        </Link>
        <Show when="signed-in">
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button
                size="sm"
                className="h-9 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Open App
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <UserButton
              showName
              appearance={{
                variables: {
                  colorBackground: "#111118",
                  colorText: "#ffffff",
                  colorTextSecondary: "#94a3b8",
                  colorPrimary: "#4f46e5",
                  borderRadius: "0.75rem",
                },
                elements: {
                  userButtonBox: "gap-2",
                  userButtonOuterIdentifier:
                    "text-sm font-semibold !text-white",
                  userButtonTrigger:
                    "h-9 rounded-xl border border-white/10 bg-white/5 px-2 text-white hover:bg-white/10 transition-all shadow-none focus:shadow-none focus:ring-0",
                  userButtonAvatarBox:
                    "h-7 w-7 rounded-full border border-white/10",
                  userButtonPopoverCard:
                    "rounded-2xl border border-white/[0.07] bg-[#111118] !text-white shadow-2xl",
                  userButtonPopoverActions: "gap-1 p-2",
                  userButtonPopoverActionButton:
                    "rounded-xl border border-transparent bg-transparent !text-white hover:bg-white/10 hover:border-white/10 active:bg-white/10",
                  userButtonPopoverActionButtonText:
                    "text-sm font-semibold !text-white",
                  userButtonPopoverActionButtonIcon: "!text-slate-400",
                  userPreviewMainIdentifier:
                    "text-sm font-semibold !text-white",
                  userPreviewSecondaryIdentifier: "text-xs !text-slate-400",
                  userButtonPopoverMain: "!text-white",
                  userButtonPopoverActionButton__manageAccount:
                    "rounded-xl border border-transparent bg-transparent !text-white hover:bg-white/10 hover:border-white/10 active:bg-white/10",
                  userButtonPopoverActionButton__signOut:
                    "rounded-xl border border-transparent bg-transparent !text-white hover:bg-white/10 hover:border-white/10 active:bg-white/10",
                  userButtonPopoverFooter: "hidden",
                },
              }}
            />
          </div>
        </Show>
        <Show when="signed-out">
          <div className="flex items-center gap-2">
            <Link href="/sign-in">
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-xl border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button
                size="sm"
                className="h-9 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Sign Up
              </Button>
            </Link>
          </div>
        </Show>
      </div>
    </nav>
  );
};

export default Navbar;
