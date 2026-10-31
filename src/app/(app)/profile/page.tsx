"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Metadata } from "next";
import { apiFetch, hasSessionToken } from "@/lib/apiFetch";
import { MobileCard, MobileScreen } from "@/components/mobile/MobileScreen";
import { siteConfig } from "@/lib/constants";
import { MiniSpinner } from "@/components/mobile/MobileLoaders";
import { useAuth } from "@/lib/auth-provider";

// Note: metadata must be in a separate server component; profile is client-rendered.

type Me = { name: string; email: string; role: string; reg_no?: string | null };

export default function MobileProfilePage() {
  const { signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSessionToken()) { setLoading(false); return; }
    apiFetch<Me>("/api/me")
      .then((d) => { setMe(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const firstName = me?.name?.split(" ")[0] ?? "";

  return (
    <MobileScreen
      eyebrow="Profile"
      title={me ? `Hi, ${firstName}` : "Profile"}
      description={me ? "Your account and app settings." : "Sign in to access your personal details."}
    >
      <MobileCard>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-3xl bg-app-accent text-xl font-black text-app-on-accent"
          >
            {loading ? <MiniSpinner /> : (firstName[0]?.toUpperCase() ?? "AD")}
          </span>
          <div className="min-w-0">
            {me ? (
              <>
                <p className="truncate font-black text-app-text">{me.name}</p>
                <p className="truncate text-[13px] text-app-muted">{me.email}</p>
                {me.reg_no ? (
                  <p className="mt-0.5 truncate text-[12px] text-app-muted">Reg: {me.reg_no}</p>
                ) : null}
              </>
            ) : loading ? (
              <p className="text-[13px] text-app-muted">Loading…</p>
            ) : (
              <>
                <p className="font-black text-app-text">Guest</p>
                <p className="text-[13px] text-app-muted">Not signed in</p>
              </>
            )}
          </div>
        </div>

        {me ? (
          <button
            type="button"
            onClick={signOut}
            className="focus-ring mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-app-border text-[13px] font-black text-app-muted transition hover:bg-app-surface-2"
          >
            Sign out
          </button>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href="/sign-in"
              className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-app-accent text-[13px] font-black text-app-on-accent"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="focus-ring inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-app-border text-[13px] font-black text-app-text"
            >
              Create account
            </Link>
          </div>
        )}
      </MobileCard>

      {/* Contact / Support */}
      <MobileCard>
        <h2 className="text-base font-black text-app-text">Support</h2>
        <div className="mt-3 grid gap-2 text-sm">
          <div className="rounded-2xl bg-app-surface-2 px-4 py-3">
            <p className="font-black text-app-text">Phone</p>
            <p className="mt-1 text-app-muted">{siteConfig.phone}</p>
          </div>
          <div className="rounded-2xl bg-app-surface-2 px-4 py-3">
            <p className="font-black text-app-text">Email</p>
            <p className="mt-1 text-app-muted">{siteConfig.email}</p>
          </div>
          <div className="rounded-2xl bg-app-surface-2 px-4 py-3">
            <p className="font-black text-app-text">Address</p>
            <p className="mt-1 leading-6 text-app-muted">{siteConfig.address}</p>
          </div>
        </div>
      </MobileCard>

      <MobileCard>
        <h2 className="text-base font-black text-app-text">About this app</h2>
        <p className="mt-1 text-sm leading-6 text-app-muted">
          Alpha Deutsch mobile app — course catalogue, results, payment status, and registration.
        </p>
      </MobileCard>
    </MobileScreen>
  );
}
