"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, hasSessionToken } from "@/lib/apiFetch";
import { MobileCard, MobileScreen } from "@/components/mobile/MobileScreen";
import { MiniSpinner } from "@/components/mobile/MobileLoaders";
import { MobileStateCard } from "@/components/mobile/MobileStates";
import { useAuth } from "@/lib/auth-provider";

type Me = {
  name: string;
  email: string;
  role: string;
};

type RegSummary = { payment_status: string }[];

type Status = "loading" | "ready" | "unauthenticated" | "error";

export default function LearningPage() {
  const { signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [regs, setRegs] = useState<RegSummary>([]);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!hasSessionToken()) {
      setStatus("unauthenticated");
      return;
    }
    let cancelled = false;

    Promise.all([
      apiFetch<Me>("/api/me"),
      apiFetch<{ data: RegSummary }>("/api/me/registrations"),
    ])
      .then(([meData, regData]) => {
        if (cancelled) return;
        setMe(meData);
        setRegs(regData.data ?? []);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const unpaidCount = regs.filter((r) => r.payment_status !== "Yes").length;
  const firstName = me?.name?.split(" ")[0] ?? "Student";

  if (status === "loading") {
    return (
      <MobileScreen eyebrow="My Learning" title="Loading…">
        <div role="status" aria-label="Loading your profile" className="flex justify-center py-10">
          <MiniSpinner className="size-8" />
        </div>
      </MobileScreen>
    );
  }

  if (status === "unauthenticated") {
    return (
      <MobileScreen eyebrow="My Learning" title="Sign in required">
        <MobileStateCard
          icon="🔒"
          title="You are not signed in"
          description="Sign in to view your registrations, results, and payment status."
          action={
            <Link
              href="/sign-in"
              className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent"
            >
              Sign in
            </Link>
          }
        />
      </MobileScreen>
    );
  }

  if (status === "error") {
    return (
      <MobileScreen eyebrow="My Learning" title="Something went wrong">
        <MobileStateCard
          icon="⚠️"
          title="Could not load your data"
          description="Please check your connection and try again."
          action={
            <button
              type="button"
              onClick={() => setStatus("loading")}
              className="focus-ring inline-flex min-h-[48px] items-center justify-center rounded-full bg-app-accent px-6 text-sm font-black text-app-on-accent"
            >
              Try again
            </button>
          }
        />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen
      eyebrow="My Learning"
      title={`Hello, ${firstName} 👋`}
      description="Manage your courses, check results, and make payments."
    >
      {/* Payment alert */}
      {unpaidCount > 0 ? (
        <div className="rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-[13px] font-bold text-yellow-800 dark:border-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-300">
          You have {unpaidCount} unpaid course{unpaidCount > 1 ? "s" : ""}.{" "}
          <Link href="/pay" className="underline underline-offset-2">
            Pay now
          </Link>
        </div>
      ) : null}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/result"
          className="focus-ring flex min-h-[90px] flex-col items-center justify-center gap-2 rounded-3xl bg-app-accent px-4 text-center font-black text-app-on-accent transition active:scale-[0.98]"
        >
          <span aria-hidden="true" className="text-2xl">🎓</span>
          <span className="text-[13px]">Check result</span>
        </Link>
        <Link
          href="/my-courses"
          className="focus-ring flex min-h-[90px] flex-col items-center justify-center gap-2 rounded-3xl border border-app-border bg-app-surface px-4 text-center font-black text-app-text transition active:scale-[0.98]"
        >
          <span aria-hidden="true" className="text-2xl">📘</span>
          <span className="text-[13px]">My courses</span>
        </Link>
      </div>

      {/* Profile card */}
      <MobileCard>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-3xl bg-app-accent text-xl font-black text-app-on-accent"
          >
            {firstName[0]?.toUpperCase() ?? "A"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-black text-app-text">{me?.name}</p>
            <p className="truncate text-[13px] text-app-muted">{me?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="focus-ring mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-app-border text-[13px] font-black text-app-muted transition hover:bg-app-surface-2"
        >
          Sign out
        </button>
      </MobileCard>
    </MobileScreen>
  );
}
