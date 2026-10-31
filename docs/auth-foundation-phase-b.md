# Alpha Deutsch — Phase B: Auth Foundation (local, no DB writes)

Implemented against `docs/auth-design-phase-a.md`. All logic proven with
isolated in-memory stores; MySQL adapter lands in Phase C. Zero production
writes, zero migrations executed, zero real emails, zero PII in logs.

## B1. What was built

- `src/lib/auth/auth-errors.ts` — `AuthError` codes/statuses, generic login
  message (no enumeration), email/name/password validators (10+ chars,
  upper+lower+digit+symbol), generic signup message.
- `src/lib/auth/passwords.ts` — bcryptjs, cost 12 prod / 4 tests;
  malformed-hash safe-fail; dummy compare for unknown-email timing.
- `src/lib/auth/rate-limit.ts` — in-memory sliding window + presets
  (signup 5, signin 8, verify 10, resend 3 per 10 min). Dev-grade:
  single-instance, documented for Redis/DB replacement in production.
- `src/lib/auth/verification.ts` — 6-digit codes, SHA-256 at rest,
  15-min TTL, single-use (`used_at`), 5-attempt cap, 60s resend cooldown,
  expiry cleanup. Injectable `ChallengeStore` mirrors `magic_links` shape.
- `src/lib/auth/sessions.ts` — 256-bit tokens, SHA-256 stored, 30-day
  sliding expiry, revoke/logout, `requireSessionUser` 401 guard,
  HttpOnly + SameSite=Lax + Secure-in-production cookies. Injectable
  `SessionStore` mirrors `sessions` table shape.
- `src/lib/auth/dev-mailer.ts` — dev-only outbox adapter; refuses to run
  under `NODE_ENV=production`; failing adapter for error-path tests.
- `src/lib/auth/auth-service.ts` — signup (generic response, duplicate-safe),
  verify, resend, signin (verified-only), signout; `MemoryUserStore`;
  `IdentityLinkService` stubbed (legacy linking disabled).
- `src/lib/auth/auth-routes.ts` + 6 routes: `POST signup|verify-email|
  resend-code|signin|signout`, `GET me` (session proof, no student data).
- Tests: `tests/auth/*.test.mjs` (20 tests) + `preload.cjs` server-only
  stub + `tsconfig.auth-tests.json` isolated build config.

## B2. Schema verification (read-only SHOW COLUMNS, local dev DB)

- `sessions`: fits as-is (token_hash char(64) UNIQUE, expires_at indexed,
  user FK, request_ip/user_agent). No change needed.
- `users`: MISSING `password_hash`, `email_verified_at`, `stud2022_id` —
  proposed (not executed), see B4.
- `magic_links`: fits token shape + single-use; MISSING `attempts`,
  `purpose` — proposed (not executed), see B4.

## B3. Legacy restrictions honored

No `killer` reads/compares/writes; no reg_no+DOB activation; no `stud2022`
inserts; mock fixtures only in tests.

## B4. Proposed migrations (NOT executed — owner review required)

```sql
-- 1. App credentials + verified legacy link (nullable, unique claim guard)
ALTER TABLE users
  ADD COLUMN password_hash VARCHAR(255) NULL,
  ADD COLUMN email_verified_at DATETIME NULL,
  ADD COLUMN stud2022_id INT NULL,
  ADD UNIQUE KEY uq_users_stud2022 (stud2022_id);
-- 2. Challenge hardening for magic_links reuse
ALTER TABLE magic_links
  ADD COLUMN attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN purpose VARCHAR(20) NOT NULL DEFAULT 'signup';
-- 3. Duplicate registration guard (6 duplicate pairs exist; cleanup first)
-- ALTER TABLE course_reg ADD UNIQUE KEY uq_reg_student_course (student_reg_no, course_id);
-- 4. Optional lookup indexes
-- CREATE INDEX idx_results_reg ON results (reg_no);
-- CREATE INDEX idx_creg_student ON course_reg (student_reg_no);
```
