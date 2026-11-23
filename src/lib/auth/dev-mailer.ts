import "server-only";

import { AuthError } from "./auth-errors";

/**
 * Email-code delivery boundary.
 *
 * Two adapters implement `MailAdapter`:
 * - `DevOutboxAdapter` (here): in-memory outbox for local development and tests.
 * - `SmtpMailAdapter` (smtp-mailer.ts): real delivery, selected with
 *   AUTH_EMAIL_PROVIDER=smtp.
 *
 * The dev adapter refuses every delivery when NODE_ENV=production, so production
 * can never silently send through the outbox; a configured SMTP provider is
 * required there. The provider is resolved lazily (email-provider.ts), so a
 * misconfigured SMTP setup cannot stop unrelated auth routes from loading.
 */

export type CodeDelivery = {
  channel: "dev-outbox" | "smtp";
  to: string;
  purpose: "signup" | "claim" | "reset";
  code: string;
  sentAt: number;
};

/**
 * `trigger` distinguishes which endpoint initiated the send so delivery metrics
 * can report "signup" vs "resend". It is optional for backwards compatibility
 * and is never sent to the recipient.
 */
export type VerificationMailInput = {
  to: string;
  purpose: CodeDelivery["purpose"];
  code: string;
  trigger?: "signup" | "resend";
};

export type MailAdapter = {
  sendVerificationCode(input: VerificationMailInput): Promise<CodeDelivery>;
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Guard: the development outbox must never deliver in production. */
export function assertDevDeliveryAllowed(): void {
  // The dev adapter is never a production sender, even when a provider is
  // selected; production must use SmtpMailAdapter via AUTH_EMAIL_PROVIDER=smtp.
  if (isProduction() && !process.env.AUTH_EMAIL_PROVIDER) {
    throw new AuthError("provider-error", 500, "Email delivery is not configured.");
  }
  if (isProduction()) {
    throw new AuthError("provider-error", 500, "Development code delivery is disabled in production.");
  }
}

export class DevOutboxAdapter implements MailAdapter {
  readonly outbox: CodeDelivery[] = [];

  async sendVerificationCode(input: VerificationMailInput) {
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
