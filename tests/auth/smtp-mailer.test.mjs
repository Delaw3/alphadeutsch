import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../auth/preload.cjs");

const {
  SmtpMailAdapter,
  SmtpConfigError,
  readSmtpConfig,
  buildVerificationEmail,
  resolveEmailLogoUrl,
  SMTP_TIMEOUTS,
} = require("../build/auth/smtp-mailer.js");
const { createMailer, resolveEmailProvider, createLazyMailer } = require("../build/auth/email-provider.js");
const { DevOutboxAdapter, FailingMailAdapter } = require("../build/auth/dev-mailer.js");
const { AuthError } = require("../build/auth/auth-errors.js");

const SMTP_ENV = {
  NODE_ENV: "test",
  AUTH_EMAIL_PROVIDER: "smtp",
  SMTP_HOST: "mail.alphadeutsch.com",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USER: "appcentre@alphadeutsch.com",
  SMTP_PASSWORD: "test-smtp-password",
  SMTP_FROM: "appcentre@alphadeutsch.com",
  SMTP_FROM_NAME: "Alpha Deutsch",
};

const RECIPIENT = "student.one@example.com";
const CODE = "042317";

function isGenericProviderError(error) {
  return (
    error instanceof AuthError &&
    error.code === "provider-error" &&
    error.status === 500 &&
    error.message === "Email delivery failed. Please try again."
  );
}

/** Injected Nodemailer transport: records the call, never opens a socket. */
function fakeTransport(outcome = {}) {
  const calls = [];
  let factories = 0;
  return {
    calls,
    get factories() {
      return factories;
    },
    factory: (options) => {
      factories += 1;
      return {
        async sendMail(message) {
          calls.push({ options, message });
          if (outcome.error) throw outcome.error;
          return (
            outcome.result ?? {
              messageId: "<test@alpha>",
              response: "250 OK",
              accepted: [RECIPIENT],
              rejected: [],
            }
          );
        },
      };
    },
  };
}

function makeAdapter(env, outcome) {
  const transport = fakeTransport(outcome);
  const adapter = new SmtpMailAdapter(readSmtpConfig(env), { createTransport: transport.factory });
  return { adapter, transport };
}

/** Captures structured log lines so the tests can prove what was (not) logged. */
function captureConsole() {
  const lines = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  for (const level of Object.keys(original)) {
    console[level] = (...args) => {
      lines.push(args.map((value) => (typeof value === "string" ? value : String(value))).join(" "));
    };
  }
  return {
    lines,
    events() {
      return lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((event) => event && event.event === "email.send");
    },
    restore() {
      for (const level of Object.keys(original)) console[level] = original[level];
    },
  };
}

/**
 * Runs `fn` with a temporary NODE_ENV and restores the previous state exactly:
 * deleting the variable when it was unset (assigning `undefined` would leave the
 * literal string "undefined" in process.env).
 */
async function withNodeEnv(value, fn) {
  const hadValue = Object.prototype.hasOwnProperty.call(process.env, "NODE_ENV");
  const previous = process.env.NODE_ENV;
  if (value === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = value;
  try {
    return await fn();
  } finally {
    if (hadValue) process.env.NODE_ENV = previous;
    else delete process.env.NODE_ENV;
  }
}

describe("SMTP configuration", () => {
  it("accepts the confirmed WhoGoHost settings", () => {
    const config = readSmtpConfig(SMTP_ENV);
    assert.equal(config.host, "mail.alphadeutsch.com");
    assert.equal(config.port, 465);
    assert.equal(config.secure, true);
    assert.equal(config.user, "appcentre@alphadeutsch.com");
    assert.equal(config.from, "appcentre@alphadeutsch.com");
    assert.equal(config.fromName, "Alpha Deutsch");
    assert.equal(config.password, "test-smtp-password");
    assert.ok(SMTP_TIMEOUTS.socketMs < 10_000, "socket timeout must stay below the Vercel default");
  });

  it("accepts 587 with STARTTLS", () => {
    const config = readSmtpConfig({ ...SMTP_ENV, SMTP_PORT: "587", SMTP_SECURE: "false" });
    assert.equal(config.port, 587);
    assert.equal(config.secure, false);
  });

  it("accepts EMAIL_FROM as the legacy alias for SMTP_FROM", () => {
    const env = { ...SMTP_ENV };
    delete env.SMTP_FROM;
    env.EMAIL_FROM = "legacy@alphadeutsch.com";
    assert.equal(readSmtpConfig(env).from, "legacy@alphadeutsch.com");
  });

  it("prefers SMTP_FROM when both names are configured", () => {
    const config = readSmtpConfig({ ...SMTP_ENV, EMAIL_FROM: "legacy@alphadeutsch.com" });
    assert.equal(config.from, "appcentre@alphadeutsch.com");
  });

  it("rejects port 25", () => {
    assert.throws(
      () => readSmtpConfig({ ...SMTP_ENV, SMTP_PORT: "25" }),
      (error) => error instanceof SmtpConfigError && error.missing.includes("SMTP_PORT"),
    );
  });

  it("rejects an incompatible port/encryption pair (587 + secure=true)", () => {
    assert.throws(
      () => readSmtpConfig({ ...SMTP_ENV, SMTP_PORT: "587", SMTP_SECURE: "true" }),
      (error) => error instanceof SmtpConfigError && error.missing.includes("SMTP_SECURE"),
    );
  });

  it("names missing variables but never prints their values", () => {
    assert.throws(
      () => readSmtpConfig({}),
      (error) => {
        assert.ok(error instanceof SmtpConfigError);
        for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"]) {
          assert.ok(error.missing.includes(key), `${key} should be reported`);
        }
        assert.match(error.message, /SMTP_HOST/);
        assert.doesNotMatch(error.message, /test-smtp-password/);
        return true;
      },
    );
  });

  it("rejects a non-numeric port", () => {
    assert.throws(
      () => readSmtpConfig({ ...SMTP_ENV, SMTP_PORT: "not-a-port" }),
      (error) => error instanceof SmtpConfigError && error.missing.includes("SMTP_PORT"),
    );
  });

  it("refuses secure=false on port 465", () => {
    assert.throws(
      () => readSmtpConfig({ ...SMTP_ENV, SMTP_SECURE: "false" }),
      (error) => error instanceof SmtpConfigError && error.missing.includes("SMTP_SECURE"),
    );
  });
});

describe("verification e-mail content", () => {
  it("builds a professional subject, text and HTML body containing the code", () => {
    const email = buildVerificationEmail({
      code: CODE,
      purpose: "signup",
      from: "notifications@alpha.example",
      fromName: "Alpha Notifications",
    });
    assert.equal(email.subject, "Your Alpha Deutsch verification code");
    assert.match(email.text, new RegExp(CODE));
    assert.match(email.text, /expires in 10 minutes/);
    assert.match(email.html, new RegExp(CODE));
    assert.match(email.html, /Verify your email address/);
    // Footer must come from the configured sender, never a hardcoded address.
    assert.match(email.text, /Alpha Notifications/);
    assert.match(email.text, /notifications@alpha\.example/);
    assert.match(email.html, /Alpha Notifications/);
    assert.match(email.html, /notifications@alpha\.example/);
    assert.doesNotMatch(email.html, /appcentre@alphadeutsch\.com/);
  });

  it("uses reset wording for a reset code, with the same code and expiry", () => {
    const email = buildVerificationEmail({
      code: CODE,
      purpose: "reset",
      from: "notifications@alpha.example",
      fromName: "Alpha Deutsch",
    });
    assert.equal(email.subject, "Reset your Alpha Deutsch password");
    assert.match(email.html, /Reset your password/);
    assert.match(email.text, /reset your password/i);
    // A reset must never ask the recipient to "verify" their address.
    assert.doesNotMatch(email.html, /Verify your email address/);
    assert.doesNotMatch(email.text, /verify your email address/i);
    assert.match(email.text, new RegExp(CODE));
    assert.match(email.html, new RegExp(CODE));
    assert.match(email.text, /expires in 10 minutes/);
  });
});

describe("branded e-mail header", () => {
  const BASE = {
    code: CODE,
    purpose: "signup",
    from: "notifications@alpha.example",
    fromName: "Alpha Deutsch",
  };

  it("renders the app logo as the header from an absolute URL", () => {
    const email = buildVerificationEmail({
      ...BASE,
      logoUrl: "https://app.alphadeutsch.com/brand/logo-256.png",
    });
    assert.match(
      email.html,
      /<img src="https:\/\/app\.alphadeutsch\.com\/brand\/logo-256\.png" width="48" height="48" alt="Alpha Deutsch"/,
    );
    // Header must be table-based so Gmail/Outlook keep the layout.
    assert.match(email.html, /<table role="presentation"/);
    // Exactly one image: no tracking pixels are added.
    assert.equal((email.html.match(/<img /g) ?? []).length, 1);
    // The plain-text alternative never carries markup or remote assets.
    assert.doesNotMatch(email.text, /<img|https?:\/\//);
  });

  it("falls back to the text wordmark when no logo URL is available", () => {
    const email = buildVerificationEmail({ ...BASE, logoUrl: null });
    assert.doesNotMatch(email.html, /<img /);
    assert.match(email.html, />Alpha Deutsch</);
  });

  it("resolves the URL from EMAIL_LOGO_URL, then NEXT_PUBLIC_SITE_URL, and rejects unsafe values", () => {
    assert.equal(
      resolveEmailLogoUrl({ EMAIL_LOGO_URL: "https://cdn.example/logo.png" }),
      "https://cdn.example/logo.png",
    );
    assert.equal(
      resolveEmailLogoUrl({ NEXT_PUBLIC_SITE_URL: "https://app.example/" }),
      "https://app.example/brand/logo-256.png",
    );
    assert.equal(resolveEmailLogoUrl({}), null);
    assert.equal(resolveEmailLogoUrl({ NEXT_PUBLIC_SITE_URL: "  " }), null);
    assert.equal(resolveEmailLogoUrl({ EMAIL_LOGO_URL: "javascript:alert(1)" }), null);
    assert.equal(resolveEmailLogoUrl({ EMAIL_LOGO_URL: "brand/logo-256.png" }), null);
    assert.equal(resolveEmailLogoUrl({ EMAIL_LOGO_URL: "https://cdn.example/a\r\nb.png" }), null);
  });

  it("adds the logo to delivered mail when the site URL is configured", async () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.alphadeutsch.com";
    const { adapter, transport } = makeAdapter(SMTP_ENV);
    const capture = captureConsole();
    try {
      await adapter.sendVerificationCode({ to: RECIPIENT, purpose: "signup", code: CODE });
    } finally {
      capture.restore();
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previous;
    }
    assert.match(
      transport.calls[0].message.html,
      /<img src="https:\/\/app\.alphadeutsch\.com\/brand\/logo-256\.png"/,
    );
  });
});

describe("SmtpMailAdapter", () => {
  it("sends via port 465 with implicit TLS, auth, timeouts and no pooling", async () => {
    const { adapter, transport } = makeAdapter(SMTP_ENV);
    const capture = captureConsole();
    let delivery;
    try {
      delivery = await adapter.sendVerificationCode({
        to: RECIPIENT,
        purpose: "signup",
        code: CODE,
        trigger: "signup",
      });
    } finally {
      capture.restore();
    }

    assert.equal(transport.calls.length, 1, "exactly one sendMail call");
    const { options, message } = transport.calls[0];

    assert.equal(options.host, "mail.alphadeutsch.com");
    assert.equal(options.port, 465);
    assert.equal(options.secure, true);
    assert.deepEqual(options.auth, { user: "appcentre@alphadeutsch.com", pass: "test-smtp-password" });
    assert.equal(options.pool, false);
    assert.equal(options.requireTLS, false, "implicit TLS needs no STARTTLS flag");
    assert.equal(options.connectionTimeout, SMTP_TIMEOUTS.connectionMs);
    assert.equal(options.greetingTimeout, SMTP_TIMEOUTS.greetingMs);
    assert.equal(options.socketTimeout, SMTP_TIMEOUTS.socketMs);
    assert.equal(options.logger, false);
    assert.equal(options.debug, false);
    // TLS verification must remain at the secure default.
    assert.equal(options.tls, undefined);
    assert.equal(options.rejectUnauthorized, undefined);

    assert.equal(message.from, '"Alpha Deutsch" <appcentre@alphadeutsch.com>');
    assert.equal(message.to, RECIPIENT);
    assert.equal(message.subject, "Your Alpha Deutsch verification code");
    assert.match(message.text, new RegExp(CODE));
    assert.match(message.html, new RegExp(CODE));
    // Configured sender is used in the body footer as well as the header.
    assert.match(message.text, /Alpha Deutsch/);
    assert.match(message.text, /appcentre@alphadeutsch\.com/);
    assert.match(message.html, /Alpha Deutsch/);
    assert.match(message.html, /appcentre@alphadeutsch\.com/);

    assert.equal(delivery.channel, "smtp");
    assert.equal(delivery.to, RECIPIENT);
    assert.equal(delivery.purpose, "signup");
    assert.equal(delivery.code, CODE);

    const events = capture.events();
    assert.equal(events.length, 1);
    assert.equal(events[0].event, "email.send");
    assert.equal(events[0].purpose, "signup");
    assert.equal(events[0].outcome, "success");
    assert.equal(typeof events[0].ms, "number");
    assert.equal(events[0].errorCode, undefined);

    const output = capture.lines.join("\n");
    assert.doesNotMatch(output, new RegExp(RECIPIENT), "recipient must never be logged");
    assert.doesNotMatch(output, new RegExp(CODE), "code must never be logged");
  });

  it("requires STARTTLS when configured for port 587", async () => {
    const { adapter, transport } = makeAdapter({ ...SMTP_ENV, SMTP_PORT: "587", SMTP_SECURE: "false" });
    const capture = captureConsole();
    try {
      await adapter.sendVerificationCode({ to: RECIPIENT, purpose: "signup", code: CODE });
    } finally {
      capture.restore();
    }
    const { options } = transport.calls[0];
    assert.equal(options.port, 587);
    assert.equal(options.secure, false);
    assert.equal(options.requireTLS, true);
    assert.equal(options.tls, undefined, "certificate verification stays enabled");
  });

  it("reuses a single transporter across sends", async () => {
    const { adapter, transport } = makeAdapter(SMTP_ENV);
    const capture = captureConsole();
    try {
      await adapter.sendVerificationCode({ to: RECIPIENT, purpose: "signup", code: CODE });
      await adapter.sendVerificationCode({ to: RECIPIENT, purpose: "signup", code: CODE });
    } finally {
      capture.restore();
    }
    assert.equal(transport.factories, 1, "transporter factory must run once");
    assert.equal(transport.calls.length, 2, "both sends go through the same transporter");
  });

  it("fails when the provider accepted no recipients", async () => {
    const { adapter } = makeAdapter(SMTP_ENV, { result: { accepted: [], rejected: [] } });
    const capture = captureConsole();
    try {
      await assert.rejects(
        adapter.sendVerificationCode({ to: RECIPIENT, purpose: "signup", code: CODE }),
        isGenericProviderError,
      );
    } finally {
      capture.restore();
    }
    assert.equal(capture.events()[0].outcome, "failure");
  });

  it("fails when any recipient is rejected", async () => {
    const { adapter } = makeAdapter(SMTP_ENV, {
      result: { accepted: [RECIPIENT], rejected: [RECIPIENT] },
    });
    const capture = captureConsole();
    try {
      await assert.rejects(
        adapter.sendVerificationCode({ to: RECIPIENT, purpose: "signup", code: CODE }),
        isGenericProviderError,
      );
    } finally {
      capture.restore();
    }
    assert.equal(capture.events()[0].outcome, "failure");
  });

  it("rejects a malformed recipient or code before contacting SMTP", async () => {
    const { adapter, transport } = makeAdapter(SMTP_ENV);
    await assert.rejects(
      adapter.sendVerificationCode({ to: "not-an-email", purpose: "signup", code: CODE }),
      isGenericProviderError,
    );
    await assert.rejects(
      adapter.sendVerificationCode({ to: RECIPIENT, purpose: "signup", code: "12ab" }),
      isGenericProviderError,
    );
    assert.equal(transport.calls.length, 0, "validation failures never open a connection");
  });

  it("maps an SMTP authentication failure to a generic error without leaking details", async () => {
    const error = Object.assign(
      new Error(`Invalid login: 535 5.7.8 Authentication failed for appcentre@alphadeutsch.com (${CODE})`),
      { code: "EAUTH" },
    );
    const { adapter } = makeAdapter(SMTP_ENV, { error });
    const capture = captureConsole();
    let thrown;
    try {
      await adapter.sendVerificationCode({
        to: RECIPIENT,
        purpose: "signup",
        code: CODE,
        trigger: "resend",
      }).catch((reason) => {
        thrown = reason;
        throw reason;
      });
    } catch {
      /* asserted below */
    } finally {
      capture.restore();
    }

    assert.ok(thrown instanceof AuthError);
    assert.equal(thrown.code, "provider-error");
    assert.equal(thrown.status, 500);
    assert.equal(thrown.message, "Email delivery failed. Please try again.");

    const output = capture.lines.join("\n");
    assert.doesNotMatch(output, /Invalid login/);
    assert.doesNotMatch(output, /appcentre@alphadeutsch\.com/);
    assert.doesNotMatch(output, new RegExp(CODE));
    assert.doesNotMatch(output, /test-smtp-password/);

    const events = capture.events();
    assert.equal(events.length, 1);
    assert.equal(events[0].outcome, "failure");
    assert.equal(events[0].purpose, "resend");
    assert.equal(events[0].errorCode, "EAUTH");
  });

  it("handles a connection timeout and records only its code", async () => {
    const { adapter } = makeAdapter(SMTP_ENV, { error: Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }) });
    const capture = captureConsole();
    try {
      await assert.rejects(
        adapter.sendVerificationCode({ to: RECIPIENT, purpose: "signup", code: CODE }),
        (reason) => reason instanceof AuthError && reason.message === "Email delivery failed. Please try again.",
      );
    } finally {
      capture.restore();
    }
    assert.equal(capture.events()[0].errorCode, "ETIMEDOUT");
  });

  it("omits unsafe error codes instead of logging them", async () => {
    const { adapter } = makeAdapter(SMTP_ENV, {
      error: Object.assign(new Error("weird"), { code: "bad code<script>" }),
    });
    const capture = captureConsole();
    try {
      await assert.rejects(adapter.sendVerificationCode({ to: RECIPIENT, purpose: "signup", code: CODE }));
    } finally {
      capture.restore();
    }
    const event = capture.events()[0];
    assert.equal(Object.prototype.hasOwnProperty.call(event, "errorCode"), false);
    assert.doesNotMatch(capture.lines.join("\n"), /bad code/);
  });

  it("still delivers when the log transport throws", async () => {
    const { adapter } = makeAdapter(SMTP_ENV);
    const original = { log: console.log, warn: console.warn, error: console.error };
    const thrower = () => {
      throw new Error("log transport down");
    };
    console.log = thrower;
    console.warn = thrower;
    console.error = thrower;
    try {
      const delivery = await adapter.sendVerificationCode({ to: RECIPIENT, purpose: "signup", code: CODE });
      assert.equal(delivery.channel, "smtp");
    } finally {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
    }
  });
});

describe("provider selection", () => {
  it("defaults to the development outbox when unset or explicitly dev", () => {
    assert.equal(resolveEmailProvider({}), "dev");
    assert.equal(resolveEmailProvider({ AUTH_EMAIL_PROVIDER: " DEV " }), "dev");
    assert.ok(createMailer({}) instanceof DevOutboxAdapter);
    assert.ok(createMailer({ AUTH_EMAIL_PROVIDER: "dev" }) instanceof DevOutboxAdapter);
  });

  it("uses SMTP only when explicitly selected and fully configured", () => {
    assert.equal(resolveEmailProvider(SMTP_ENV), "smtp");
    assert.ok(createMailer(SMTP_ENV) instanceof SmtpMailAdapter);
  });

  it("never falls back to the dev adapter when SMTP is selected but misconfigured", () => {
    assert.throws(
      () => createMailer({ AUTH_EMAIL_PROVIDER: "smtp" }),
      (error) => error instanceof SmtpConfigError,
    );
    assert.throws(
      () => createMailer({ ...SMTP_ENV, SMTP_PASSWORD: "" }),
      (error) => error instanceof SmtpConfigError && error.missing.includes("SMTP_PASSWORD"),
    );
  });

  it("rejects an unknown provider without echoing its value", () => {
    assert.throws(
      () => resolveEmailProvider({ AUTH_EMAIL_PROVIDER: "mailgun" }),
      (error) => error instanceof Error && /expected "dev" or "smtp"/.test(error.message) && !error.message.includes("mailgun"),
    );
  });

  it("keeps the production refusal inside the development adapter", async () => {
    const mailer = createMailer({ AUTH_EMAIL_PROVIDER: "dev", NODE_ENV: "production" });
    assert.ok(mailer instanceof DevOutboxAdapter);

    await withNodeEnv("production", async () => {
      await assert.rejects(
        mailer.sendVerificationCode({ to: RECIPIENT, purpose: "signup", code: CODE }),
        (error) => error instanceof AuthError && error.code === "provider-error",
      );
    });
  });
});

describe("lazy provider initialization", () => {
  it("does not fail auth-route initialization when SMTP config is missing", () => {
    // createAuthStores() uses createLazyMailer(), so module load cannot throw.
    assert.doesNotThrow(() => createLazyMailer({ AUTH_EMAIL_PROVIDER: "smtp" }));
  });

  it("fails safely on send and never falls back to the dev outbox", async () => {
    const mailer = createLazyMailer({ AUTH_EMAIL_PROVIDER: "smtp" });
    const capture = captureConsole();
    let thrown;
    try {
      await mailer
        .sendVerificationCode({ to: RECIPIENT, purpose: "signup", code: CODE })
        .catch((error) => {
          thrown = error;
          throw error;
        });
    } catch {
      /* asserted below */
    } finally {
      capture.restore();
    }

    assert.ok(isGenericProviderError(thrown));
    const output = capture.lines.join("\n");
    assert.match(output, /SMTP_HOST/, "safe diagnostic names the missing variable");
    assert.doesNotMatch(output, /test-smtp-password/);
  });

  it("delegates to the resolved adapter", async () => {
    const seen = [];
    const mailer = createLazyMailer(
      { AUTH_EMAIL_PROVIDER: "smtp" },
      {
        createMailer: () => ({
          async sendVerificationCode(input) {
            seen.push(input);
            return {
              channel: "smtp",
              to: input.to,
              purpose: input.purpose,
              code: input.code,
              sentAt: Date.now(),
            };
          },
        }),
      },
    );

    const delivery = await mailer.sendVerificationCode({ to: RECIPIENT, purpose: "signup", code: CODE });
    assert.equal(delivery.channel, "smtp");
    assert.equal(seen.length, 1);
  });
});

describe("development adapters (unchanged behaviour)", () => {
  it("DevOutboxAdapter still records deliveries for local development", async () => {
    await withNodeEnv("test", async () => {
      const mailer = new DevOutboxAdapter();
      const delivery = await mailer.sendVerificationCode({
        to: RECIPIENT,
        purpose: "signup",
        code: CODE,
        trigger: "signup",
      });
      assert.equal(delivery.channel, "dev-outbox");
      assert.equal(mailer.latestFor(RECIPIENT).code, CODE);
    });
  });

  it("FailingMailAdapter still rejects with a provider error", async () => {
    await assert.rejects(
      new FailingMailAdapter().sendVerificationCode(),
      (error) => error instanceof AuthError && error.code === "provider-error",
    );
  });
});

describe("test environment hygiene", () => {
  it("restores an unset NODE_ENV instead of writing the string 'undefined'", async () => {
    const hadValue = Object.prototype.hasOwnProperty.call(process.env, "NODE_ENV");
    const previous = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      await withNodeEnv("production", async () => {
        assert.equal(process.env.NODE_ENV, "production");
      });
      assert.equal(Object.prototype.hasOwnProperty.call(process.env, "NODE_ENV"), false);
      assert.equal(process.env.NODE_ENV, undefined);
    } finally {
      if (hadValue) process.env.NODE_ENV = previous;
      else delete process.env.NODE_ENV;
    }
  });
});
