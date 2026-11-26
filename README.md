# Alpha Deutsch — Mobile Learning App

Alpha Deutsch is a German-language school in Awka, Anambra State (Nigeria). This
repository is the **student-facing mobile app** (installable PWA) for the school:
students sign in, browse the live course catalogue, check results, see their
registration/payment status and watch lesson videos. It is a Next.js App Router
application on top of the school's existing MySQL database (`stud2022`,
`courses`, `course_reg`, `results`) plus two app-owned tables (`users`,
`sessions`).

**Status: Phase B+ — working app, not yet feature-complete.** Authentication,
sessions, catalogue, results, registration/payment status, the learning library
(with likes and comments), theming, the PWA shell and brand assets are
implemented and verified. In-app course registration, real e-mail delivery and
server-side social features are still switched off on purpose (see
[Current limitations](#current-limitations)).

## Status at a glance

| Area | State | Notes |
| --- | --- | --- |
| Sign up / sign in (e-mail + password) | ✅ | bcrypt hashes, 5-attempt lockout for 15 minutes |
| "Already a student" setup | ✅ | `/student-setup`: e-mail + reg no + date of birth → choose a new password |
| Sessions | ✅ | 30-day httpOnly cookie plus Bearer token; only the SHA-256 token hash is stored |
| E-mail verification codes | ✅ | Six-digit codes, branded e-mail with the app logo, `/verify-email` screen with resend countdown. Delivery via SMTP (`AUTH_EMAIL_PROVIDER=smtp`) or the dev outbox; `AUTH_REQUIRE_EMAIL_VERIFY` defaults to `false` |
| Course catalogue | ✅ | Live from MySQL, mode filters, course detail page |
| My courses | ✅ | Registrations with Paid / Not paid badges |
| Check result | ✅ | Blocked while unpaid; per-skill scores, grades and total |
| Payments | ⚠️ | Opens the external school payment portal; no in-app processing |
| Course registration | ❌ | `POST /api/me/registrations` is gated (`FEATURE_APP_REGISTRATION=false`); the UI links to the portal |
| Learning videos | ✅ | 6 curated YouTube lessons, in-app player, watched progress |
| Likes & comments on lessons | ⚠️ | Device-local (`localStorage`); no API or table yet |
| Home dashboard | ✅ | Live course/result/unpaid counts, dismissible announcements, quick actions |
| Light / dark theme | ✅ | Persisted in `localStorage`, applied before hydration (no flash) |
| PWA / brand | ✅ | Manifest, maskable icons, Apple touch icon, service worker in production only |
| Push notifications | ❌ | Bell in the top bar is a placeholder (badge hidden at 0) |
| Admin / back office | ❌ | Out of scope for this app |

## Tech stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript 6, `strict` |
| Framework | Next.js 16.2.6 (App Router; `reactStrictMode`) |
| UI | React 19.2.6, Tailwind CSS 4.3, `lucide-react` icons |
| Data | MySQL through a pooled `mysql2` connection that is `server-only` |
| Auth | `bcryptjs`, MySQL-backed sessions, in-memory rate limiting |
| PWA | `public/manifest.webmanifest`, `public/sw.js`, `src/app/layout.tsx` |
| Tests | `node:test` running a `tsc` build of `src/lib/auth` |
| Lint | ESLint 9 flat config (`eslint.config.mjs`) |

## Quick start

### Prerequisites

- Node.js **20.9+** (required by Next.js 16)
- MySQL 8 / MariaDB with the school's legacy schema available
- npm

### 1. Install

```bash
npm install
```

### 2. Configure the database

```bash
cp .env.example .env.local
```

Fill in `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` and `DB_NAME`. The legacy
dump is **not** in the repository (the `sql-db/` folder is git-ignored); import it
into your local MySQL first, for example:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS alphadeutsch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p alphadeutsch < sql-db/alphad.sql
```

Read-only demos can be produced from a local copy with
`scripts/anonymize-demo.sql` (see `scripts/export-demo.md`).

### 3. Apply the app migrations

```bash
node scripts/run-migration.mjs
```

The runner reads credentials from `.env.local` only, records applied files in
`schema_migrations`, and refuses to run against a non-local host unless you pass
`--allow-remote`.

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>. `/` redirects to `/home` when a session token is
present, otherwise to `/sign-in`.

Production check:

```bash
npm run lint
npm run build
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DB_HOST` | — | MySQL host (required by every DB-backed route) |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | — | MySQL user |
| `DB_PASSWORD` | empty | MySQL password |
| `DB_NAME` | — | Database name |
| `NEXT_PUBLIC_API_BASE_URL` | `""` (same origin) | Absolute API base for a packaged WebView build |
| `AUTH_STORE` | `mysql` | `memory` is accepted **only** when `NODE_ENV=test` |
| `AUTH_REQUIRE_EMAIL_VERIFY` | `false` | When `true`, sign-in requires a verified e-mail |
| `AUTH_CODE_PEPPER` | — | Server-only HMAC pepper for e-mail codes: exactly 64 hexadecimal characters (`openssl rand -hex 32`). Required whenever a code is issued or verified; never commit it |
| `AUTH_EMAIL_PROVIDER` | `dev` | E-mail transport: `dev` (in-memory outbox) or `smtp` (WhoGoHost SMTP; requires the `SMTP_*` values) |
| `SMTP_HOST` | — | SMTP server, e.g. `mail.alphadeutsch.com` |
| `SMTP_PORT` | `465` | Submission port: `465` (implicit TLS, `secure: true`) or `587` (STARTTLS, `secure: false`); port 25 is rejected |
| `SMTP_SECURE` | `true` | Must match the port: `true` for 465, `false` for 587 |
| `SMTP_USER` | — | SMTP username (the mailbox address) |
| `SMTP_PASSWORD` | — | SMTP password (hosting environment only; never committed) |
| `SMTP_FROM` | — | From address; use the authenticated mailbox (`EMAIL_FROM` is accepted as a legacy alias) |
| `SMTP_FROM_NAME` | `Alpha Deutsch` | Display name in the From header and e-mail footer |
| `NEXT_PUBLIC_SITE_URL` | `VERCEL_URL` or `http://localhost:3000` | Public origin of this app; also the base for the e-mail logo |
| `EMAIL_LOGO_URL` | `${NEXT_PUBLIC_SITE_URL}/brand/logo-256.png` | Absolute logo URL for the verification e-mail header; with no value the header is a text wordmark |
| `STUDENT_PHOTO_BASE_URL` | `https://portal.alphadeutsch.com/PROFILE_IMAGE/` | Base URL for passport photos; `/Upload/` and the portal root are tried automatically as fallbacks |
| `FEATURE_APP_REGISTRATION` | `false` | Enables `POST /api/me/registrations` |
| `NEXT_PUBLIC_FEATURE_APP_REGISTRATION` | `false` | Shows the in-app registration form instead of the portal link |
| `NEXT_PUBLIC_SITE_REGISTRATION_URL` | `https://portal.alphadeutsch.com/registration` | Fallback registration page |
| `NEXT_PUBLIC_SITE_PAYMENT_URL` | `https://portal.alphadeutsch.com/payment.php` | Payment portal link |

Secrets stay server-side: `src/lib/db.ts` and every auth module import
`server-only`, so a client component cannot bundle the MySQL driver or the
credentials.

### E-mail delivery

Real delivery uses Nodemailer over the WhoGoHost SMTP mailbox. Select it with
`AUTH_EMAIL_PROVIDER=smtp` and provide the `SMTP_*` variables in the hosting
environment. Port `465` uses implicit TLS (`SMTP_SECURE=true`); port `587` uses
STARTTLS (`SMTP_SECURE=false`). Port 25, and any other port/encryption pairing,
is rejected. Sending is awaited inside the route and bounded by an 8-second
socket timeout. `AUTH_EMAIL_PROVIDER=dev` (the default) keeps the in-memory
outbox used by local development and tests.

Verification e-mails use a branded HTML template (`buildVerificationEmail` in
`src/lib/auth/smtp-mailer.ts`): the app logo (`/brand/logo-256.png`) beside the
wordmark as a table-based header, a boxed 6-digit code and a sender footer, plus
a plain-text alternative that never references remote assets. The logo needs an
absolute URL — set `EMAIL_LOGO_URL`, or set `NEXT_PUBLIC_SITE_URL` and the image
is taken from `${NEXT_PUBLIC_SITE_URL}/brand/logo-256.png`. With neither set the
header falls back to the text wordmark, so a broken image is never sent.

Verification is **not mandatory** (`AUTH_REQUIRE_EMAIL_VERIFY=false`). Codes are
stored in `verification_challenges` (`migrations/004_verification_challenges.sql`)
when the MySQL store is active, so the gate can be enabled once that migration is
applied; the in-memory rate limits remain per-instance.

## Screens

All signed-in screens render inside the mobile shell (`MobileScreen`): app bar
with menu + theme switch, floating bottom tab bar (Home, Courses, My Learning,
Profile) and safe-area padding. The slide-in menu also links Check Result, My
Courses, Register and Pay.

| Route | File | What it does |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Redirects to `/home` or `/sign-in` based on the stored token |
| `/sign-in` | `(auth)/sign-in/page.tsx` | E-mail + password; carries `?email=` and `?notice=` from signup |
| `/sign-up` | `(auth)/sign-up/page.tsx` | Name, e-mail, password; issues a 6-digit code and continues to `/verify-email` |
| `/verify-email` | `(auth)/verify-email/page.tsx` | Six-cell code entry, 60-second resend countdown, success state, e-mail step when opened without `?email=` |
| `/student-setup` | `(auth)/student-setup/page.tsx` | Existing students: e-mail + reg no + DOB + new password |
| `/forgot-password` | `(auth)/forgot-password/page.tsx` | Three steps: e-mail → 6-digit code → new password + confirm (reset ticket, 15 min) |
| `/home` | `(app)/home/page.tsx` | Greeting, hero card, announcements, live stat chips, quick actions |
| `/courses` | `(app)/courses/page.tsx` | Open courses from `GET /api/courses`, filtered by learning mode |
| `/courses/[id]` | `(app)/courses/[id]/page.tsx` | Course detail with price and offline/not-found states |
| `/learning` | `(app)/learning/page.tsx` | Featured lesson, level chips, watched progress, likes, comments |
| `/result` | `(app)/result/page.tsx` | Inline student verification, course/sitting pickers, printable result slip (passport photo, skills, total) with **Download PDF** / **Share PDF** |
| `/my-courses` | `(app)/my-courses/page.tsx` | Registration list with payment badges |
| `/register` | `(app)/register/page.tsx` | In-app registration form when enabled, portal link otherwise |
| `/pay` | `(app)/pay/page.tsx` | Opens the external payment portal |
| `/profile` | `(app)/profile/page.tsx` | Account details, theme switch, sign out |

`AuthProvider` (`src/lib/auth-provider.tsx`) guards the `(app)` group: anonymous
visitors are sent to `/sign-in`, and `/sign-in`, `/sign-up`, `/verify-email` and
`/student-setup` are the only public routes.

## API

Every mobile page talks to these route handlers through `apiFetch`
(`src/lib/apiFetch.ts`), which prefixes `NEXT_PUBLIC_API_BASE_URL`, injects
`Authorization: Bearer <localStorage.sessionToken>`, sets JSON headers on writes,
applies a 10-second timeout and throws the server's error message on non-2xx.

| Method | Route | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | public | Creates an account; returns `needsStudentSetup` when the e-mail belongs to an active `stud2022` row |
| POST | `/api/auth/signin` | public | Sets the session cookie **and** returns `sessionToken` for the Bearer flow |
| POST | `/api/auth/signout` | cookie | Revokes the session and clears the cookie |
| GET | `/api/auth/me` | cookie | Legacy cookie-only identity probe (no student data) |
| POST | `/api/auth/verify-email` | public | Consumes a 6-digit code (10-minute TTL, 5 attempts) |
| POST | `/api/auth/forgot-password` | public | Checks the address (`account-not-found` / `email-not-verified`) then e-mails a reset code |
| POST | `/api/auth/verify-reset-code` | public | Consumes the reset code and returns a single-use reset ticket (SHA-256 stored, 15 min) |
| POST | `/api/auth/reset-password` | public | Exchanges the ticket for a new password; revokes all sessions |
| POST | `/api/auth/resend-code` | public | Re-issues a code after a 60-second cooldown; neutral response |
| POST | `/api/auth/student-setup` | public | Verifies e-mail + reg no + DOB, then stores a new bcrypt password |
| GET | `/api/courses` | public | Open courses by default; `?open=all` includes closed ones |
| GET | `/api/courses/[id]` | public | Single course or `404` |
| GET | `/api/me` | cookie or Bearer | Name, e-mail, role, reg no, phone |
| GET | `/api/me/overview` | cookie or Bearer | Counts for home: courses, paid, unpaid, results |
| GET | `/api/me/registrations` | cookie or Bearer | Registrations joined with course title/level + payment status |
| POST | `/api/me/registrations` | cookie or Bearer | Gated by `FEATURE_APP_REGISTRATION`; verifies the course is open |
| POST | `/api/me/link-student` | cookie or Bearer | Links the account to `stud2022` by reg no + DOB (e-mail must match) |
| GET | `/api/me/results?course_id=&sitting=` | cookie or Bearer | Scores + `student` block for the result slip; returns `reason: "unpaid"` until the course is paid |
| GET | `/api/me/photo` | cookie or Bearer | Passport photo proxied from the portal (`Cache-Control: private`); `404` when the student has none |
| GET | `/api/health` | public | `200 ok` when MySQL answers, `503` otherwise (no error details leaked) |

Bearer tokens exist because a packaged WebView cannot rely on cookies; the
browser build uses both.

## How authentication works

1. **New account** — `/sign-up` posts to `/api/auth/signup`. The service decides
   in this order: an existing app account returns “already registered, please
   sign in” (the client opens `/sign-in?notice=exists`), so a student who already
   completed the mobile setup is never sent back to it; otherwise an active
   `stud2022` row returns `{ needsStudentSetup: true }` and the client opens
   `/student-setup`; otherwise a `users` row is created with role `user`,
   `stud2022_id = NULL` (never an admin) and a 6-digit code is e-mailed. The
   client then opens `/verify-email?email=…&sent=1`, where the code is entered,
   can be resent after 60 seconds, and must be confirmed before the first
   sign-in. If delivery fails (`provider-error`) the same screen opens with a
   “could not send” notice so a new code can be requested.
2. **Existing student** — `/student-setup` posts e-mail + registration number +
   date of birth + a new password to `/api/auth/student-setup`. On a match it
   creates or updates the `users` row: bcrypt `password_hash`, `stud2022_id`,
   role `student`, e-mail marked verified and any lockout cleared. The legacy
   `killer` column is never read or written.
3. **Session** — `/api/auth/signin` issues a random token, stores only its
   SHA-256 hash in `sessions` with a 30-day expiry, sets the httpOnly
   `alphadeutsch_session` cookie and returns the raw token in JSON.
4. **Identity** — `/api/me*` accepts either the cookie or `Authorization:
   Bearer`. The registration number is always resolved from
   `users.stud2022_id` → `stud2022.reg_no`, never from the request.
5. **Linking on demand** — "Check result" shows an inline verification panel
   (`reg no` + `DOB`) that calls `/api/me/link-student`; the signed-in account's
   e-mail must match the student record's e-mail. Linking sets
   `users.stud2022_id` and role `student`.
6. **Lockout** — five failed sign-ins lock the account for 15 minutes
   (`failed_logins`, `locked_until`). Password policy: 10–128 characters with
   upper-case, lower-case, digit and symbol, enforced by the API and mirrored in
   the forms (`src/lib/auth/password-rules.ts`).
7. **Forgotten passwords** — self-service reset at `/forgot-password`:
   e-mail → 6-digit code → new password + confirmation. The address is checked
   before any code is sent: an unknown address returns `account-not-found` and an
   unverified one `email-not-verified` (the page offers “Verify my email first”).
   Verifying the code returns a single-use ticket (only its SHA-256 is stored,
   15 min) that `POST /api/auth/reset-password` exchanges for the new password.
   Every existing session for the account is revoked and the ticket is cleared.

## Learning library (lessons, likes, comments)

- The lesson list lives in `src/lib/learning-videos.ts` — currently 6 lessons
  (3 × A1, 2 × A2, 1 × B1). Paste a full YouTube link (watch, `youtu.be`,
  Shorts, Live, `/embed` or a bare 11-character id) into `youtubeUrl`; an empty
  link renders a branded "coming soon" cover so a lesson can be listed before
  its video is published.
- Tapping a lesson opens `VideoPlayerSheet`: a portal-rendered bottom sheet on
  phones / centred dialog on wide screens, using `youtube-nocookie.com`, with
  scroll lock, Escape and backdrop close, and an "Open in YouTube" fallback.
- Watched lessons are remembered in `localStorage`
  (`alphadeutsch-watched-videos`) and drive the progress bar and "watched"
  badges.
- Likes and the comment thread are handled by `src/lib/learning-social.ts`
  under the key `alphadeutsch-video-engagement`: likes are a set of video ids,
  comments are newest-first, capped at 50 per lesson and 500 characters each.
  Reads are defensive — a corrupted payload, a stale schema or private-mode
  storage never breaks the screen. **Because there is no table yet, like counts
  are 0 or 1 and comments exist only on the device that wrote them.** The module
  is shaped so `readEngagement` / `saveEngagement` can be swapped for API calls
  without touching the UI.

## Data model

### App-owned tables (create with the migrations)

| Table | Columns that matter |
| --- | --- |
| `users` | `id`, `email` (unique), `name`, `role` (`user` → `student` when linked), `password_hash` (bcrypt, nullable), `email_verified_at`, `failed_logins`, `locked_until`, `stud2022_id` (unique, nullable) |
| `sessions` | `id`, `user_id` (FK, cascade), `token_hash` (SHA-256, unique), `expires_at`, `last_seen_at`, `request_ip`, `user_agent` |

### Legacy tables used read-only

| Table | Used for | Notes |
| --- | --- | --- |
| `stud2022` | Student identity: `reg_no`, `email`, `dob`, `status` | `killer`, `reset_token` are never selected |
| `courses` | Catalogue: `id`, `title`, `display`, `description`, `price`, `image`, `is_open` | `display` = learning mode (On-Site, Online, Private, Online Private) |
| `course_reg` | Registrations: `student_reg_no`, `student_email`, `course_id`, `payment_status` (`Yes`/`No`), `course_amount`, `date` | Powers My Courses, overview counts and the results gate |
| `results` | Scores: `reg_no`, `course_id`, `sittings`, `horen/lesen/schreiben/sprechen_score` + `_grade`, `total` | Only returned when the course is paid |

Legacy values contain stray whitespace and mixed collations, so every lookup uses
`TRIM(...) COLLATE utf8mb4_general_ci` on both sides of the comparison. The only
code path that writes to legacy tables is the flag-gated
`POST /api/me/registrations`, which can claim/create a `stud2022` row and insert
into `course_reg`; nothing else writes to them.

### Migrations

| File | Purpose |
| --- | --- |
| `migrations/000_baseline_auth_tables.sql` | Creates `users` and `sessions` as they exist in the baseline database |
| `migrations/001_password_auth.sql` | Adds `password_hash`, `email_verified_at`, `failed_logins`, `locked_until`, `stud2022_id` + unique key |
| `migrations/002_drop_magic_links.sql` | Removes the abandoned magic-link table |
| `migrations/003_user_default_role.sql` | Changes `users.role` default to `user` (existing rows untouched) |
| `migrations/004_verification_challenges.sql` | Adds the `verification_challenges` table (HMAC OTPs, attempts, cooldown) |
| `migrations/005_password_reset.sql` | Adds `users.reset_token_hash` / `reset_token_expires_at` for the single-use reset ticket |

```bash
node scripts/run-migration.mjs              # localhost only
node scripts/run-migration.mjs --allow-remote
```

Applied files are recorded in `schema_migrations`; already-applied files are
skipped, so the runner is safe to re-run.

## Project structure

```text
src/
  app/
    (app)/            signed-in screens: home, courses, learning, result,
                      my-courses, register, pay, profile (+ shared layout)
    (auth)/           sign-in, sign-up, verify-email, forgot-password, student-setup (+ brand layout)
    api/              auth/*, courses, courses/[id], me/*, health
    layout.tsx        metadata, manifest, theme bootstrap, SW registration
    page.tsx          session-aware redirect
  components/mobile/  AppMenu, AppTopBar, MobileAppHeader, MobileBottomNav,
                      MobileScreen, MobileStates, MobileLoaders, MobileCourseCard,
                      PasswordInput, OtpCodeInput, VideoPlayerSheet
  lib/
    auth/             auth-service, mysql-users/sessions/students, passwords,
                      password-rules, rate-limit, verification, dev-mailer,
                      auth-errors, auth-routes, auth-store-config
    apiFetch.ts       client fetch helper with Bearer token + timeout
    auth-provider.tsx client auth context and route guard
    db.ts             pooled mysql2 connection (server-only)
    courses.ts        legacy course-row grouping helpers (unused by the mobile UI)
    features.ts       feature registry (check result, register, my courses)
    learning-videos.ts lesson list + YouTube URL parsing/thumbnails
    learning-social.ts device-local likes and comments
    mobile-api.ts     public course API client
    names.ts, constants.ts
  types/              shared domain types (Course, CourseMode, ...)
migrations/           numbered SQL migrations
scripts/              run-migration.mjs, anonymize-demo.sql, seed-demo.sql, export-demo.md
tests/auth/           node:test suites for the auth core
tests/integration/    opt-in MySQL 9.7 OTP integration tests (local only)
public/               manifest, service worker, icons, brand + partner logos
docs/                 project state and auth design notes
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server (Turbopack) on <http://localhost:3000> |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint over the whole project |
| `npm run test:auth` | Compile `src/lib/auth` with `tsc`, then run `node --test tests/auth/*.test.mjs` |
| `npm run test:auth:build` | Only the compile step (output in `tests/build/auth`, git-ignored) |
| `npm run test:auth:integration -- --allow-local-db` | Opt-in MySQL 9.7 integration tests; refuses to run without the flag and only targets local `alphadeutsch` |
| `node scripts/run-migration.mjs` | Apply pending SQL migrations |

## Testing

The auth core is framework-free and dependency-injected (memory user, session,
student, challenge and mail stores), so it runs in plain Node:

```bash
npm run test:auth
```

`tsconfig.auth-tests.json` compiles the modules under `src/lib/auth` to CommonJS
in `tests/build/auth`, and `node:test` loads them through
`tests/auth/preload.cjs` (a `server-only` stub). The current suite is
**99 tests across 6 test files (21 `describe` suites)**:

| Suite | Covers |
| --- | --- |
| `auth-service.test.mjs` | Signup, verification, lockout, resend cooldown, store/provider failures |
| `auth-store.test.mjs` | Store selection (`memory` only in tests) and DB config validation |
| `challenge-store.test.mjs` | Memory + MySQL challenge stores: OTP HMAC, TTL, attempt caps, atomic consume, bounded cleanup |
| `passwords.test.mjs` | bcrypt hashing and policy rules |
| `sessions.test.mjs` | Token creation, validation, expiry, revocation, cookie building |
| `smtp-mailer.test.mjs` | SMTP config, provider selection, adapter behaviour, lazy initialization |

### MySQL integration tests (opt-in, local only)

```bash
npm run test:auth:integration -- --allow-local-db
```

The runner refuses to start without `--allow-local-db`, and refuses a stale or
incomplete `tests/build/auth` (run `npm run test:auth:build`). It loads
`.env.local` and then forces `NODE_ENV=test`, `AUTH_STORE=mysql` and
`AUTH_EMAIL_PROVIDER=dev`.

`.env.local` is the **only** accepted source for `DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASSWORD`, `DB_NAME` and `INTEGRATION_EXPECTED_SERVER_UUID`: values inherited
from the shell are dropped before the file is read, and the guard refuses to run
if one of them did not come from the file. `INTEGRATION_EXPECTED_SERVER_UUID`
must equal the local server's `@@server_uuid` exactly — a loopback host cannot
distinguish a local server from an SSH tunnel that forwards a remote one, but the
UUID can. `SMTP_*` variables are deleted after the load, so an integration run
cannot contact a mail server even if one is configured.

Before any write the guard verifies that `DB_HOST` resolves only to loopback,
`DB_NAME` is exactly `alphadeutsch`, the connected database name, port, version
(9.7) and server UUID match the configuration, the target is writable, the
`CURRENT_USER()` account is loopback-scoped (not `%`), the confirmed peer address
is loopback (an unreadable process list is a failure, not a pass), migration
004's table and required columns exist, and the account's **effective
privileges** (direct grants plus every granted role, active or inactive) are
exactly the DML the suites need.

The account must hold nothing else: no `*.*` grant, no pattern database scope, no
grant on another database, no grant on a table the suites never touch, no DDL, no
`ALL PRIVILEGES` and no `GRANT OPTION`. Roles are inspected with
`SHOW GRANTS … USING`, and an inactive role still counts because `SET ROLE` can
enable it at any time. The recommended setup is a dedicated account with
table-scoped grants:

```sql
CREATE USER 'alphadeutsch_it'@'localhost' IDENTIFIED BY '<local password only>';
GRANT SELECT, INSERT, UPDATE, DELETE ON `alphadeutsch`.`users` TO 'alphadeutsch_it'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON `alphadeutsch`.`verification_challenges` TO 'alphadeutsch_it'@'localhost';
GRANT SELECT, DELETE ON `alphadeutsch`.`sessions` TO 'alphadeutsch_it'@'localhost';
```

A database-wide grant (`ON alphadeutsch.*`) is accepted only when
`information_schema` shows that the schema holds nothing but those three tables;
otherwise it is refused as too broad. That is why the application's own
`alphadeutsch_app` account is normally **not** suitable for the suite.

Every statement on the test pool passes a write barrier that rejects DDL and any
`DELETE`/`UPDATE` without a row-scoping predicate, so the production
expired-challenge sweep (a global `DELETE … LIMIT 100`) cannot remove rows from
real accounts. Tests use `@example.invalid` mailboxes, never send e-mail (the dev
outbox or an injected fake SMTP transport is used), and delete only users whose
stored `(id, email)` still match the registered test row. Cleanup also
reconciles anything created under the run's unique e-mail prefix (for example a
signup that inserted the user and then failed), runs on `SIGINT`/`SIGTERM`, and
verifies with `COUNT(*)` queries that no user, challenge or session row survives.
Files run serially, while concurrency is exercised inside individual tests across
two independent pools. `npm run test:auth` stays DB-free and does not include
these suites.

The runner also refuses any driver version other than `mysql2` 3.24.5: the suite
depends on that release's `timezone: "Z"` DATETIME parsing, while `package.json`
keeps a caret range for the application.

If a run is killed before its hooks complete, follow
[`docs/integration-test-cleanup.md`](docs/integration-test-cleanup.md). It lists
the read-only queries that identify a run's leftovers and the one-row-at-a-time
procedure that verifies the id and the exact e-mail address before deleting
anything. Nothing in this project removes `otp-it+%` rows in bulk.

Manual checks used for the UI and the MySQL routes:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

> Automated coverage currently stops at the auth core: API route handlers
> against a real MySQL instance and the UI flows are verified by hand.

## Design system

- Mobile-first layout: `max-w-lg` shell, safe-area insets, 44–48 px touch
  targets, bottom-sheet patterns, skeleton loaders and retry states.
- Colours are CSS variables in `src/app/globals.css`, exposed as Tailwind tokens
  (`app-bg`, `app-surface`, `app-surface-2`, `app-text`, `app-muted`,
  `app-border`, `app-accent` `#FFCE45`, `app-on-accent`). The dark palette lives
  under `.dark`.
- Theme choice is stored in `localStorage` (`alphadeutsch-theme`) and applied by
  an inline script before hydration, so there is no flash or mismatch.
- Branding: icons and maskable icons in `public/icons`, Apple touch icon and
  logo in `public/brand`, partner logos in `public/logos`; the manifest also
  declares screenshots and a yellow `theme_color`.
- Service worker (`public/sw.js`) is registered **only in production** —
  network-first for navigations and build assets with a cache fallback. In
  development it unregisters itself and clears caches so stale CSS/JS never
  sticks.

## Current limitations

1. **Likes and comments are device-local.** There are no `lesson_likes` /
   `lesson_comments` tables or endpoints yet, so counts are 0 or 1 and
   instructors cannot see feedback.
2. **In-app course registration is switched off.**
   `POST /api/me/registrations` returns `503` unless
   `FEATURE_APP_REGISTRATION=true`; with the public flag off, `/register` opens
   the school portal instead.
3. **No payment processing.** `/pay` links to
   `portal.alphadeutsch.com/payment.php`; payment status is read from
   `course_reg.payment_status`.
4. **E-mail delivery supports SMTP but is opt-in.** Set `AUTH_EMAIL_PROVIDER=smtp`
   plus the `SMTP_*` variables for real delivery; the default `dev` writes codes
   to an in-memory outbox that is lost on restart. `AUTH_REQUIRE_EMAIL_VERIFY` is
   `false` by default, so accounts are usable without confirming an address.
5. **Verification challenges and rate limits are memory-only**, so codes do not
   survive a restart and do not work across multiple server instances. Persist
   them before enabling mandatory verification.
6. **No self-service password reset** — students are told to contact the office.
7. **The lesson list is a code array** (`src/lib/learning-videos.ts`); there is
   no admin endpoint or CMS for it.
8. **No push notifications** — the bell in the app bar is a placeholder and its
   badge stays hidden at 0.
9. **No admin/back-office UI** and no write APIs for courses or results.
10. **The app needs MySQL**; offline support is limited to the cached app shell,
    not to data.

## Suggested next steps

1. Move likes/comments to MySQL (`lesson_likes`, `lesson_comments`) plus
   `/api/learning/*` endpoints, keeping the `learning-social` types and UI.
2. Serve the lesson list from an admin-managed endpoint instead of a code array.
3. Persist verification challenges and rate limits, then turn on
   `AUTH_REQUIRE_EMAIL_VERIFY`. SMTP delivery (WhoGoHost) is already available
   behind `AUTH_EMAIL_PROVIDER=smtp`.
4. Agree seat/capacity rules, then enable in-app registration
   (`FEATURE_APP_REGISTRATION` + `NEXT_PUBLIC_FEATURE_APP_REGISTRATION`).
5. Add payment initiation/callbacks instead of redirecting to the portal.
6. Push notifications for results and registration updates.
7. Password reset flow and an in-app "contact the office" hand-off.

## Security notes

- `src/lib/db.ts` and everything under `src/lib/auth` import `server-only`;
  credentials and `mysql2` can never reach the client bundle.
- All SQL uses parameterized placeholders, and legacy secrets (`killer`,
  `reset_token`, `password_hash`) are never selected into responses.
- Session tokens are random, stored only as SHA-256 hashes, expire after 30 days,
  and travel in an httpOnly `SameSite=Lax` cookie; the Bearer token exists for
  SDKs/WebViews that cannot use cookies.
- Roles are never derived from `stud2022.adminlevel`; linking a student also
  requires the account e-mail to match the student record.
- Sign-in uses a generic error message and a 5-attempt/15-minute lockout.
  Per-IP rate limits: signup 5, sign-in 8, verification 10 and student setup 8
  attempts per 10 minutes, plus a 60-second resend cooldown.
- The migration runner reads `.env.local`, refuses non-local hosts unless
  `--allow-remote` is passed, and records applied files.
- `.env.local`, `sql-db/`, `.next/` and `tests/build/` are git-ignored.

## Further reading

- [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) — phase status, endpoint and
  page history.
- [`docs/auth-design-phase-a.md`](docs/auth-design-phase-a.md) and
  [`docs/auth-foundation-phase-b.md`](docs/auth-foundation-phase-b.md) — auth
  design decisions.
- [`scripts/export-demo.md`](scripts/export-demo.md) — producing an anonymized
  demo database for testing.

## Contact

Alpha Deutsch — St. Lucy Outstation, 259 Ifite Road, Awka, Anambra State,
Nigeria · +234 816 545 5895 · contact@alphadeutsch.com

