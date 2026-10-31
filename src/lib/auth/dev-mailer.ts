import "server-only";

import { AuthError } from "./auth-errors";

/**
 * Email-code delivery boundary (Phase B: local dev only).
 *
 * Production email is NOT configured. The dev adapter writes codes to an
 * in-memory outbox (and optionally a local log file wired by the caller) so
 * tests and local flows can retrieve them. It refuses to run when
 * NODE_ENV=production unless an explicit provider is configured — which does
 * not exist yet, so production delivery always throws.
 */

export type CodeDelivery = {
  channel: "dev-outbox";
  to: string;
  purpose: "signup" | "claim" | "reset";
  code: string;
  sentAt: number;
};

export type MailAdapter = {
  sendVerificationCode(input: { to: string; purpose: CodeDelivery["purpose"]; code: string }): Promise<CodeDelivery>;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Guard: dev-only delivery must never be reachable in production. */
export function assertDevDeliveryAllowed(): void {
  // An explicit provider env would allow production delivery later; absent = blocked.
  if (isProduction() && !process.env.AUTH_EMAIL_PROVIDER) {
    throw new AuthError("provider-error", 500, "Email delivery is not configured.");
  }
  if (isProduction()) {
    throw new AuthError("provider-error", 500, "Development code delivery is disabled in production.");
  }
}

export class DevOutboxAdapter implements MailAdapter {
  readonly outbox: CodeDelivery[] = [];

  async sendVerificationCode(input: { to: string; purpose: CodeDelivery["purpose"]; code: string }) {
    assertDevDeliveryAllowed();
    if (!input.to || !input.code) {
      throw new AuthError("provider-error", 500, "Email delivery failed. Please try again.");
    }
    const entry: CodeDelivery = {
      channel: "dev-outbox",
      to: input.to,
      purpose: input.purpose,
      code: input.code,
      sentAt: Date.now(),
    };
    this.outbox.push(entry);
    return entry;
  }

  latestFor(to: string): CodeDelivery | null {
    const lower = to.toLowerCase();
    for (let i = this.outbox.length - 1; i >= 0; i -= 1) {
      const entry = this.outbox[i];
      if (entry && entry.to.toLowerCase() === lower) return entry;
    }
    return null;
  }

  clear(): void {
    this.outbox.length = 0;
  }
}

/** Failing adapter for testing provider-error paths. */
export class FailingMailAdapter implements MailAdapter {
  async sendVerificationCode(): Promise<CodeDelivery> {
    throw new AuthError("provider-error", 500, "Email delivery failed. Please try again.");
  }
}
