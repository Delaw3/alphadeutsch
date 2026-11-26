# Alpha Deutsch App — Project State

## Phase 2C: E-mail OTP UI (2026-11-25)

- `/verify-email` (`src/app/(auth)/verify-email/page.tsx`): six-cell code entry
  (`OtpCodeInput` — numeric keypad, `one-time-code` autofill, paste spreading,
  auto-advance/backspace), 60-second resend countdown matching
  `VERIFY_RESEND_COOLDOWN_MS`, messages per server error code (`code-invalid`,
  `code-expired`, `code-used`, `code-attempts-exceeded`, `code-resend-cooldown`,
  `rate-limited`, `provider-error`), a success state, and an e-mail step for
  accounts that arrive without `?email=`.
- `/sign-up` now continues to `/verify-email?email=…&sent=1` instead of signing
  the new account in; a failed first delivery (`provider-error`) opens the same
  screen with `notice=delivery` so a new code can be requested.
- `/sign-in` offers a “Verify my email” action when the API answers
  `email-not-verified`, and understands `notice=verified`.
- `/verify-email` is public in `auth-provider.tsx` (`PUBLIC_ROUTES`).
- `apiFetch` now attaches the server error `code` (read with `apiErrorCode()`),
  so screens can react to `email-not-verified` and OTP failures.
- Local testing: `AUTH_DEV_EXPOSE_CODES=true` prints the dev-outbox code in the
  dev server log (ignored in production); `AUTH_REQUIRE_EMAIL_VERIFY` is now
  documented in `.env.example`.
- Signup precedence fixed: an existing app account is resolved **before** the
  `stud2022` lookup, so a student who already completed the mobile setup is sent
  to `/sign-in?notice=exists` instead of `/student-setup`. The student lookup
  moved from the route into `AuthService.signup` via the new
  `StudentStore.findByEmail` (MySQL + memory).
- Verification e-mails now carry the app logo as a table-based header
  (`buildVerificationEmail`), using `EMAIL_LOGO_URL` or
  `${NEXT_PUBLIC_SITE_URL}/brand/logo-256.png`; with neither set the header is
  the text wordmark, so no broken image is ever sent. The plain-text part stays
  image-free.
- Forgot-password flow: `/forgot-password` (e-mail → 6-digit code → new
  password + confirm). `POST /api/auth/forgot-password` verifies the address
  first (`account-not-found` / `email-not-verified`, nothing is sent), then
  issues a code (3/hour per IP); `POST /api/auth/verify-reset-code` consumes the
  code and returns a single-use ticket, and `POST /api/auth/reset-password`
  exchanges it for the new password, revoking all sessions. Only the SHA-256 of
  the ticket is stored (`migrations/005_password_reset.sql`, 15-minute TTL).
- Result screen is now a printable slip: passport photo
  (`GET /api/me/photo` proxies `stud2022.ProfileImage` with
  `Cache-Control: private`; `PROFILE_IMAGE/` → `/Upload/` fallbacks), reg no,
  DOB, place of birth, course, four skills, total and remark, plus
  **Download PDF** / **Share PDF** built locally by the dependency-free
  `src/lib/result-pdf.ts` (A4, Helvetica, JPEG `/DCTDecode`); `@media print`
  keeps the slip clean on paper.

## Small demo database for manual testing (2026-11-19)

- `scripts/seed-demo-small.sql` — tiny, mostly emulated, **single-load** database for testing the app by hand: `users` (0), `sessions` (0), `stud2022` (10), `courses` (24), `packages` (6), `course_reg` (14), `results` (9) = 7 tables. Load into an **empty** database only; starts with `SET NAMES utf8mb4;`, uses `CREATE TABLE IF NOT EXISTS` from the live DDL plus the auth tables from `migrations/000+001+003` (guarded, re-runnable), one `INSERT` per data table, no destructive statements, no `schema_migrations`.
- Built read-only from the local DB. `courses`/`packages` are verbatim copies; `results.total` is always the sum of the four skill scores (true for 230 of 617 live rows; the other live rows carry a legacy `0`).
- 9 fictional students (`demo.student2..10@example.com`, `0801000000N`, `2022/AD/90001..90008` + `2022/ADA/901`) cover: paid + result, fail on 1st sitting then pass on 2nd, paid without result, unpaid only, multi-course, Online course, Private Family Reunion course, and the `2022/ADA/...` reg_no format. #10 is an admin row (`adminlevel Yes`, `super 1`) with no registrations.
- Student #1 is the real `lauphix1@gmail.com` account (reg `2026/AD/98766`) copied exactly (only `killer`/`reset_token` replaced), so the file is **git-ignored**.
- Matching test sheet `alphadeutsch_demo_students.txt` (Desktop copy) lists expected app output per course/sitting, HOW TO TEST, and DBeaver loading steps.

## Project seed for DBeaver (2026-11-19)

- `scripts/seed-project.sql` — standalone, mostly masked seed (tables + data) for a fresh project database: `stud2022` (10 rows), `courses` (24), `packages` (6), `course_reg` (26), `results` (18).
- Built read-only from the local `alphadeutsch` database (`SELECT` / `SHOW` only); the table definitions are the live `SHOW CREATE TABLE` output rewritten as `CREATE TABLE IF NOT EXISTS`, followed by explicit-id `INSERT`s.
- 9 students are masked (`Demo Student 1`–`Demo Student 9`, fake reg_no `2026/AD/10001`–`2026/AD/10009`, fake `studentN@example.com` / `0800000000N`); masked identity is shared across `stud2022`, `course_reg` and `results` through `reg_no`. One real account is kept unchanged, which is why the file is **git-ignored**.
- Coverage: paid course with a result, paid course without a result, unpaid course, students holding several courses, and results from later sittings (sitting 2 and sitting 5).
- Excludes `users`, `sessions`, `schema_migrations` — create/link those with `migrations/*.sql` and `scripts/run-migration.mjs`.
- Plain MySQL 8 / TiDB-compatible SQL: no triggers, routines, events, table locks or destructive statements.
- Load it into an empty database in DBeaver (open file, Alt+X); the table description lives in `alphadeutsch_project_db.txt` next to the seed copy on the Desktop.

## Phase B+: Mobile UI Complete (2026-10-29)

### Authentication
- General platform: anyone can sign up (name, email, password); `stud2022_id` stays NULL; role 'user'.
- Student record is created/linked only inside "Check result" and "Register for a course" features.
- Role becomes 'student' on link/create; admin is never derived from `stud2022`.
- Sessions persisted in MySQL (`sessions` table, SHA-256 token hash)
- Lockout after repeated failed logins (`failed_logins`, `locked_until` in `users`)
- `AUTH_REQUIRE_EMAIL_VERIFY` flag (default `false`) controls e-mail gate

### Migrations applied
| File | Description |
|------|-------------|
| `migrations/000_baseline_auth_tables.sql` | CREATE TABLE IF NOT EXISTS `users`, `sessions` |
| `migrations/001_password_auth.sql` | Adds `password_hash`, `failed_logins`, `locked_until`, `reg_no` to users |
| `migrations/002_drop_magic_links.sql` | Drops legacy `magic_links` table |
| `migrations/003_user_default_role.sql` | Changes `users.role` DEFAULT to 'user' (ALTER only; existing rows untouched) |

### API routes
| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| POST | `/api/auth/signup` | — | Validates against `stud2022` |
| POST | `/api/auth/signin` | — | Returns session cookie |
| POST | `/api/auth/signout` | cookie | Revokes session |
| GET | `/api/auth/me` | cookie | Legacy – cookie-only |
| GET | `/api/me` | cookie OR Bearer | Name, email, role, reg_no, phone |
| GET | `/api/me/registrations` | cookie OR Bearer | Course list + payment status |
| POST | `/api/me/registrations` | cookie OR Bearer | Gated by `FEATURE_APP_REGISTRATION=true` |
| GET | `/api/me/results?course_id=&sitting=` | cookie OR Bearer | Results; unpaid → `reason: "unpaid"` |
| GET | `/api/courses` | — | Open courses (default); `?open=all` for all |

### Mobile UI pages (`src/app/`)
| Route | File | Description |
|-------|------|-------------|
| `/signin` | `signin/page.tsx` | Email + password form, links to sign-up |
| `/signup` | `signup/page.tsx` | Name, email, password, reg_no, date-picker DOB |
| `/learning` | `learning/page.tsx` | Authenticated home: greeting, quick-action buttons, sign-out |
| `/result` | `result/page.tsx` | Course + sitting dropdowns, score table, unpaid notice, share |
| `/my-courses` | `my-courses/page.tsx` | Registration list with Paid/Not paid badges |
| `/register` | `register/page.tsx` | Gated by `NEXT_PUBLIC_FEATURE_APP_REGISTRATION`; pre-fills profile |
| `/pay` | `pay/page.tsx` | Link to `portal.alphadeutsch.com/payment.php` |
| `/profile` | `profile/page.tsx` | Auth-aware: shows user or sign-in/up buttons; contact info |

### Shared mobile components (`src/components/mobile/`)
- `MobileAppHeader`, `MobileBottomNav` (updated with new routes in AppMenu)
- `MobileScreen`, `MobileCard`, `MobileStateCard`, `MobileLoadingList`, `MobileRetryButton`
- `MiniSpinner`, `NavigationLoader`
- `MobileCourseCard`

### API fetch helper
`src/lib/apiFetch.ts` — prefixes `NEXT_PUBLIC_API_BASE_URL`, injects `Authorization: Bearer` from `localStorage.sessionToken`, throws on non-2xx with server error message. Also exports `saveSessionToken`, `clearSessionToken`, `hasSessionToken`.

### Feature flags
| Variable | Default | Effect |
|----------|---------|--------|
| `AUTH_REQUIRE_EMAIL_VERIFY` | `false` | Gate sign-in on verified email |
| `FEATURE_APP_REGISTRATION` | `false` | Enable POST /api/me/registrations |
| `NEXT_PUBLIC_FEATURE_APP_REGISTRATION` | `false` | Show/hide register UI |
| `NEXT_PUBLIC_API_BASE_URL` | `""` (same origin) | Override for Capacitor WebView |

### Security notes
- `apiFetch` never exposes DB credentials; all secrets stay server-side
- `/api/me*` routes accept Bearer tokens (Capacitor cannot set cookies); `POST /api/auth/signin` also returns `sessionToken` in its JSON body so the mobile bearer flow works without cookies
- DB queries always use parameterized placeholders; never select `killer`, `reset_token`, or `password_hash`
- `run-migration.mjs` host-guard: only runs on localhost/127.0.0.1 unless `--allow-remote` passed

### Database schema alignment (verified with read-only `DESCRIBE` against local copy)
- `users` links to `stud2022` via `users.stud2022_id → stud2022.id` (users has no `reg_no`)
- `course_reg` columns: `student_reg_no`, `student_email`, `course_id`, `payment_status` (Yes/No), `course_amount`, `date` — no `course_name`/`date_registered`/`phone`
- `results` columns: `reg_no`, `course_id`, `sittings`, per-skill `*_score`/`*_grade`, `total` — no `overall_grade`/`sitting`/`total_score`
- All `/api/me*` queries join on `users.stud2022_id` and filter with `COLLATE utf8mb4_general_ci`; `reg_no` is derived from the session only

### Build status
✅ `tsc --noEmit` — 0 errors  
✅ `next build` — 23 routes compiled, 0 errors


## Home modernization
- Header avatar initials, time-based greeting, dark-mode toggle, notification bell (badge 0).
- Hero banner card, dismissible announcement cards, stat chips, quick actions.
- Floating rounded bottom tab bar with brand-yellow active state.

## Home UI fixes
- Bottom padding accounts for floating tab bar; hamburger removed; badge hidden at 0 (cap 9+).
- Stat chips use inline SVG icons; third chip "Unpaid 0"; right-edge fade.
- Hero card has faded "A" decoration; contrast verified AA.
