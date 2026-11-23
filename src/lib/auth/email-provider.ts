import "server-only";

import { logUnexpectedError } from "../monitoring/perf";
import { AuthError } from "./auth-errors";
import {
  DevOutboxAdapter,
  type CodeDelivery,
  type MailAdapter,
  type VerificationMailInput,
} from "./dev-mailer";
import { SmtpMailAdapter, readSmtpConfig } from "./smtp-mailer";

/**
 * E-mail provider selection (Phase 2A).
 *
 *   AUTH_EMAIL_PROVIDER unset / "dev" -> DevOutboxAdapter (unchanged default)
 *   AUTH_EMAIL_PROVIDER "smtp"        -> SmtpMailAdapter with validated config
 *
 * There is never a fallback: selecting "smtp" without configuration throws
 * `SmtpConfigError` (variable names only), and the dev adapter refuses to
 * deliver under NODE_ENV=production via `assertDevDeliveryAllowed()`.
 */

export type EmailProvider = "dev" | "smtp";

export function resolveEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  const raw = env.AUTH_EMAIL_PROVIDER?.trim().toLowerCase();
  if (!raw || raw === "dev") return "dev";
  if (raw === "smtp") return "smtp";
  throw new Error('Unsupported AUTH_EMAIL_PROVIDER; expected "dev" or "smtp".');
}

export function createMailer(env: NodeJS.ProcessEnv = process.env): MailAdapter {
  if (resolveEmailProvider(env) === "smtp") {
    // Fail fast and loudly when SMTP is selected but misconfigured.
    return new SmtpMailAdapter(readSmtpConfig(env));
  }

  // Development default. Its own guard refuses delivery in production, so a
  // missing provider can never silently send through the dev outbox there.
  return new DevOutboxAdapter();
}

/**
 * Defers provider construction until the first send attempt.
 *
 * `createAuthStores()` runs at module load for every auth route. Building the
 * SMTP transport there meant one missing variable could take down sign-in,
 * sign-out and non-email routes. This wrapper keeps those routes available and
 * turns configuration errors into the same generic `provider-error` a failed
 * send would produce — never a fallback to the development outbox.
 */
export class LazyMailAdapter implements MailAdapter {
  private delegate: MailAdapter | null = null;

  constructor(private readonly resolveAdapter: () => MailAdapter) {}

  private adapter(): MailAdapter {
    if (!this.delegate) {
      try {
        this.delegate = this.resolveAdapter();
      } catch (error) {
        // Safe diagnostic: SmtpConfigError lists variable names only.
        try {
          logUnexpectedError(error);
        } catch {
          // Logging must not mask the provider error.
        }
        throw new AuthError("provider-error", 500, "Email delivery failed. Please try again.");
      }
    }
    return this.delegate;
  }

  async sendVerificationCode(input: VerificationMailInput): Promise<CodeDelivery> {
    // Async so a configuration failure is a rejection, matching MailAdapter
    // and keeping `await`/`.catch()` callers working as before.
    return this.adapter().sendVerificationCode(input);
  }
}

export function createLazyMailer(
  env: NodeJS.ProcessEnv = process.env,
  options: { createMailer?: (environment: NodeJS.ProcessEnv) => MailAdapter } = {},
): MailAdapter {
  const factory = options.createMailer ?? createMailer;
  return new LazyMailAdapter(() => factory(env));
}

