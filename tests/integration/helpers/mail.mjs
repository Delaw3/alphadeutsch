// Mail adapters for the integration tests.
//
// The preload deletes every SMTP_* variable, so no adapter could build a real
// transport even if one were requested. The service path always uses
// DevOutboxAdapter (in-memory, NODE_ENV=test), and the SMTP adapter is only
// constructed with an injected fake transport, so a real Nodemailer socket is
// never created. Codes are returned to the test and are never logged.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../preload.cjs");

const { SMTP_ENV_KEYS } = require("./env-keys.cjs");
const { DevOutboxAdapter } = require("../../build/auth/dev-mailer.js");
const { SmtpMailAdapter, readSmtpConfig } = require("../../build/auth/smtp-mailer.js");
const { resolveEmailProvider } = require("../../build/auth/email-provider.js");

export const DEV_CHANNEL = "dev-outbox";

export function assertDevProvider(env) {
  const provider = resolveEmailProvider(env);
  if (provider !== "dev") {
    throw new Error("Integration tests require AUTH_EMAIL_PROVIDER=dev.");
  }
}

/**
 * Asserts that no SMTP credential survived the preload. `AUTH_EMAIL_PROVIDER=dev`
 * alone is not enough: a mistyped provider or a future `createMailer()` call must
 * still be unable to open a socket. Checked against the live process environment
 * because the env snapshot intentionally carries no SMTP keys.
 */
export function assertSmtpIsolated(env = process.env) {
  for (const key of SMTP_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.trim() !== "") {
      throw new Error(`${key} must not be present during integration tests.`);
    }
  }
}

export function createCapturedMailer() {
  const adapter = new DevOutboxAdapter();
  return {
    adapter,
    get size() {
      return adapter.outbox.length;
    },
    latestFor(email) {
      return adapter.latestFor(email);
    },
    all() {
      return adapter.outbox.slice();
    },
    clear() {
      adapter.clear();
    },
  };
}

/** Records sendMail calls; no socket, no DNS, no SMTP handshake. */
export function createFakeSmtpTransport() {
  const calls = [];
  let factories = 0;
  return {
    calls,
    get factories() {
      return factories;
    },
    factory(options) {
      factories += 1;
      return {
        async sendMail(message) {
          calls.push({ options, message });
          return {
            messageId: "<integration@example.invalid>",
            response: "250 OK",
            accepted: [message.to],
            rejected: [],
          };
        },
        close() {
          // No-op: the fake transport owns no resources.
        },
      };
    },
  };
}

/**
 * Builds SmtpMailAdapter with a fake transport. The config below is local
 * dummy data, not a credential from .env.local.
 */
export function createMockSmtpAdapter(overrides = {}) {
  const env = {
    NODE_ENV: "test",
    AUTH_EMAIL_PROVIDER: "smtp",
    SMTP_HOST: "smtp.example.invalid",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "integration-test",
    SMTP_PASSWORD: "not-a-real-password",
    SMTP_FROM: "no-reply@example.invalid",
    SMTP_FROM_NAME: "Alpha Deutsch",
    ...overrides,
  };
  const transport = createFakeSmtpTransport();
  const adapter = new SmtpMailAdapter(readSmtpConfig(env), {
    createTransport: transport.factory,
  });
  return { adapter, transport };
}
