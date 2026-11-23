import "server-only";

import nodemailer from "nodemailer";
import type { SendMailOptions } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import { logEmailSend } from "../monitoring/perf";
import { AuthError } from "./auth-errors";
import type { CodeDelivery, MailAdapter, VerificationMailInput } from "./dev-mailer";

/**
 * WhoGoHost SMTP delivery (Phase 2A).
 *
 * Server-side only. One Nodemailer transporter per process (reused by warm
 * serverless instances) with SMTP connection pooling deliberately disabled:
 * a pooled socket cannot be assumed to survive Vercel freezing an instance.
 *
 * Sending is always awaited by the caller chain (`signup`, `resend-code`), so
 * the exchange completes before the function responds.
 */

/** Timeouts stay below Vercel's 10 s default function limit (no Fluid compute). */
export const SMTP_TIMEOUTS = {
  connectionMs: 8_000,
  greetingMs: 8_000,
  socketMs: 8_000,
} as const;

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
};

/**
 * Missing/invalid configuration. The message lists variable NAMES only, so it
 * can be thrown at startup without exposing a single value.
 */
export class SmtpConfigError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(`Missing or invalid SMTP configuration: ${missing.join(", ")}`);
    this.name = "SmtpConfigError";
    this.missing = missing;
  }
}

const EMAIL_SHAPE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const SAFE_ERROR_CODE = /^[A-Za-z0-9_.-]{1,40}$/;
const VERIFICATION_CODE = /^\d{6}$/;

/**
 * Supported submission ports only, each with its required TLS mode:
 *   465 -> implicit TLS (`secure: true`)
 *   587 -> STARTTLS (`secure: false`)
 * Port 25 is rejected (Vercel blocks outbound port 25 entirely).
 */
const PORT_ENCRYPTION: Readonly<Record<number, boolean>> = { 465: true, 587: false };

/** Rejects CR/LF and other control characters (header-injection guard). */
function hasControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function envValue(env: NodeJS.ProcessEnv, key: string): string {
  const raw = env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Reads SMTP settings from the environment (no defaults for credentials).
 * Confirmed contract: port 465, implicit TLS (`secure: true`), auth required.
 */
export function readSmtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig {
  const host = envValue(env, "SMTP_HOST");
  const user = envValue(env, "SMTP_USER");
  // Passwords may contain leading/trailing spaces; only an empty value is invalid.
  const password = typeof env.SMTP_PASSWORD === "string" ? env.SMTP_PASSWORD : "";
  const from = envValue(env, "SMTP_FROM");
  const fromName = envValue(env, "SMTP_FROM_NAME") || "Alpha Deutsch";
  const port = Number(envValue(env, "SMTP_PORT") || "465");
  const secureRaw = (envValue(env, "SMTP_SECURE") || "true").toLowerCase();
  const secure = secureRaw === "true" ? true : secureRaw === "false" ? false : null;

  const invalid: string[] = [];
  if (!host || hasControlChars(host)) invalid.push("SMTP_HOST");
  if (!user || hasControlChars(user)) invalid.push("SMTP_USER");
  if (!password) invalid.push("SMTP_PASSWORD");
  if (!from || !EMAIL_SHAPE.test(from) || hasControlChars(from)) invalid.push("SMTP_FROM");
  if (!Number.isInteger(port) || port <= 0 || port > 65535 || PORT_ENCRYPTION[port] === undefined) {
    invalid.push("SMTP_PORT");
  }
  if (secure === null) invalid.push("SMTP_SECURE");
  else if (PORT_ENCRYPTION[port] !== undefined && secure !== PORT_ENCRYPTION[port]) {
    invalid.push("SMTP_SECURE");
  }
  if (hasControlChars(fromName)) invalid.push("SMTP_FROM_NAME");

  if (invalid.length > 0) throw new SmtpConfigError([...new Set(invalid)]);

  return { host, port, secure: secure === true, user, password, from, fromName };
}

const CODE_TTL_MINUTES = 15;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Verification email content. Fixed copy only — the sole dynamic value is the
 * code, so no student data, links or tracking are included.
 */
export function buildVerificationEmail(input: {
  code: string;
  purpose: CodeDelivery["purpose"];
  from: string;
  fromName: string;
}): { subject: string; text: string; html: string } {
  const code = input.code;
  const subject = "Your Alpha Deutsch verification code";

  const text = [
    "Hello,",
    "",
    "Use the code below to verify your email address for Alpha Deutsch.",
    "",
    `    ${code}`,
    "",
    `This code expires in ${CODE_TTL_MINUTES} minutes and can be used once.`,
    "",
    "If you did not request this email, you can safely ignore it.",
    "",
    input.fromName,
    input.from,
  ].join("\n");

  const safeCode = escapeHtml(code);
  const safeFromName = escapeHtml(input.fromName);
  const safeFrom = escapeHtml(input.from);
  const html = [
    '<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#f6f7fb;">',
    '<div style="padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0b1220;">',
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;">',
    '<p style="margin:0 0 24px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#b45309;">Alpha Deutsch</p>',
    '<h1 style="margin:0 0 16px;font-size:20px;line-height:28px;color:#0b1220;">Verify your email address</h1>',
    '<p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#334155;">Use the code below to verify your email address for Alpha Deutsch.</p>',
    `<p style="margin:0 0 24px;padding:16px 24px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;font-size:30px;line-height:38px;font-weight:700;letter-spacing:8px;text-align:center;color:#0b1220;">${safeCode}</p>`,
    `<p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#475569;">This code expires in ${CODE_TTL_MINUTES} minutes and can be used once.</p>`,
    '<p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#475569;">If you did not request this email, you can safely ignore it.</p>',
    `<p style="margin:0;font-size:13px;line-height:20px;color:#64748b;">${safeFromName}<br>${safeFrom}</p>`,
    "</div></div></body></html>",
  ].join("");

  return { subject, text, html };
}

/** Minimal structural type so tests can inject a fake transport. */
export type SmtpTransporter = {
  sendMail(options: SendMailOptions): Promise<unknown>;
};

export type SmtpTransportFactory = (options: SMTPTransport.Options) => SmtpTransporter;

/** Only allowlist-shaped driver codes reach the logger; never the raw message. */
function safeErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && SAFE_ERROR_CODE.test(code) ? code : undefined;
}

/** Nodemailer reports per-recipient acceptance; a missing list counts as empty. */
function addressList(result: unknown, key: "accepted" | "rejected"): unknown[] {
  if (!result || typeof result !== "object") return [];
  const value = (result as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : [];
}

function safeLogEmail(sample: {
  purpose: string;
  ok: boolean;
  ms: number;
  errorCode?: string;
}): void {
  try {
    logEmailSend(sample);
  } catch {
    // Monitoring must never change the outcome of a delivery attempt.
  }
}

export class SmtpMailAdapter implements MailAdapter {
  private readonly config: SmtpConfig;
  private readonly transporter: SmtpTransporter;

  constructor(config: SmtpConfig, options: { createTransport?: SmtpTransportFactory } = {}) {
    this.config = config;
    const createTransport =
      options.createTransport ??
      ((transportOptions: SMTPTransport.Options) => nodemailer.createTransport(transportOptions));

    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      // No SMTP connection pooling in serverless (see module header).
      pool: false,
      // Port 587 uses STARTTLS; require the upgrade so a server that fails to
      // advertise TLS can never silently fall back to plaintext. Implicit TLS
      // on 465 needs no extra flag.
      requireTLS: config.secure === false,
      connectionTimeout: SMTP_TIMEOUTS.connectionMs,
      greetingTimeout: SMTP_TIMEOUTS.greetingMs,
      socketTimeout: SMTP_TIMEOUTS.socketMs,
      // TLS certificate verification stays at Nodemailer's secure default.
      logger: false,
      debug: false,
    });
  }

  async sendVerificationCode(input: VerificationMailInput): Promise<CodeDelivery> {
    const to = typeof input.to === "string" ? input.to.trim() : "";
    const code = typeof input.code === "string" ? input.code : "";
    if (!to || !EMAIL_SHAPE.test(to) || hasControlChars(to) || !VERIFICATION_CODE.test(code)) {
      throw new AuthError("provider-error", 500, "Email delivery failed. Please try again.");
    }

    const message = buildVerificationEmail({
      code,
      purpose: input.purpose,
      from: this.config.from,
      fromName: this.config.fromName,
    });
    const purpose = input.trigger ?? input.purpose;
    const startedAt = performance.now();

    let result: unknown;
    try {
      result = await this.transporter.sendMail({
        from: this.fromHeader(),
        to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } catch (error) {
      safeLogEmail({
        purpose,
        ok: false,
        ms: performance.now() - startedAt,
        errorCode: safeErrorCode(error),
      });
      // Fixed message: provider text can contain the mailbox identity or code.
      throw new AuthError("provider-error", 500, "Email delivery failed. Please try again.");
    }

    // A resolved promise is not proof of delivery: nodemailer reports the
    // recipients the server actually accepted. Zero accepted or any rejected
    // recipient means the message did not reach everyone.
    const accepted = addressList(result, "accepted");
    const rejected = addressList(result, "rejected");
    if (accepted.length === 0 || rejected.length > 0) {
      safeLogEmail({ purpose, ok: false, ms: performance.now() - startedAt });
      throw new AuthError("provider-error", 500, "Email delivery failed. Please try again.");
    }

    safeLogEmail({
      purpose,
      ok: true,
      ms: performance.now() - startedAt,
    });

    return {
      channel: "smtp",
      to,
      purpose: input.purpose,
      code,
      sentAt: Date.now(),
    };
  }

  private fromHeader(): string {
    const name = this.config.fromName.replace(/"/g, "").replace(/[\r\n]/g, " ").trim();
    return name ? `"${name}" <${this.config.from}>` : this.config.from;
  }
}
