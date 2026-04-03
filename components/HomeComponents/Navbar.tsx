"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import {
  Show,
  UserButton,
} from "@clerk/nextjs";

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-[#f5f6fa]/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="text-xl font-semibold tracking-tight text-slate-700"
        >
          <span className="text-indigo-500">Pay</span>
          <span className="text-emerald-500">Matrix</span>
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
            <UserButton />
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
