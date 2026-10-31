"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasSessionToken } from "@/lib/apiFetch";

export default function RedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(hasSessionToken() ? "/home" : "/sign-in");
  }, [router]);
  return null;
}
