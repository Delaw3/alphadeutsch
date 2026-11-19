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
| E-mail verification codes | ⚠️ | 6-digit codes exist, but delivery is a dev outbox; `AUTH_REQUIRE_EMAIL_VERIFY` defaults to `false` |
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
| `AUTH_EMAIL_PROVIDER` | unset | Reserved hook for a real mail provider; production delivery stays blocked until one is wired up |
| `FEATURE_APP_REGISTRATION` | `false` | Enables `POST /api/me/registrations` |
| `NEXT_PUBLIC_FEATURE_APP_REGISTRATION` | `false` | Shows the in-app registration form instead of the portal link |
| `NEXT_PUBLIC_SITE_REGISTRATION_URL` | `https://portal.alphadeutsch.com/registration` | Fallback registration page |
| `NEXT_PUBLIC_SITE_PAYMENT_URL` | `https://portal.alphadeutsch.com/payment.php` | Payment portal link |

Secrets stay server-side: `src/lib/db.ts` and every auth module import
`server-only`, so a client component cannot bundle the MySQL driver or the
credentials.

## Screens

All signed-in screens render inside the mobile shell (`MobileScreen`): app bar
with menu + theme switch, floating bottom tab bar (Home, Courses, My Learning,
Profile) and safe-area padding. The slide-in menu also links Check Result, My
Courses, Register and Pay.

| Route | File | What it does |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Redirects to `/home` or `/sign-in` based on the stored token |
| `/sign-in` | `(auth)/sign-in/page.tsx` | E-mail + password; carries `?email=` and `?notice=` from signup |
| `/sign-up` | `(auth)/sign-up/page.tsx` | Name, e-mail, password; auto-signs in on success |
| `/student-setup` | `(auth)/student-setup/page.tsx` | Existing students: e-mail + reg no + DOB + new password |
| `/home` | `(app)/home/page.tsx` | Greeting, hero card, announcements, live stat chips, quick actions |
| `/courses` | `(app)/courses/page.tsx` | Open courses from `GET /api/courses`, filtered by learning mode |
| `/courses/[id]` | `(app)/courses/[id]/page.tsx` | Course detail with price and offline/not-found states |
| `/learning` | `(app)/learning/page.tsx` | Featured lesson, level chips, watched progress, likes, comments |
| `/result` | `(app)/result/page.tsx` | Inline student verification, course/sitting pickers, score table |
| `/my-courses` | `(app)/my-courses/page.tsx` | Registration list with payment badges |
| `/register` | `(app)/register/page.tsx` | In-app registration form when enabled, portal link otherwise |
| `/pay` | `(app)/pay/page.tsx` | Opens the external payment portal |
| `/profile` | `(app)/profile/page.tsx` | Account details, theme switch, sign out |

`AuthProvider` (`src/lib/auth-provider.tsx`) guards the `(app)` group: anonymous
visitors are sent to `/sign-in`, and `/sign-in`, `/sign-up`, `/student-setup` are
the only public routes.

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
| POST | `/api/auth/verify-email` | public | Consumes a 6-digit code (15-minute TTL, 5 attempts) |
| POST | `/api/auth/resend-code` | public | Re-issues a code after a 60-second cooldown; neutral response |
| POST | `/api/auth/student-setup` | public | Verifies e-mail + reg no + DOB, then stores a new bcrypt password |
| GET | `/api/courses` | public | Open courses by default; `?open=all` includes closed ones |
| GET | `/api/courses/[id]` | public | Single course or `404` |
| GET | `/api/me` | cookie or Bearer | Name, e-mail, role, reg no, phone |
| GET | `/api/me/overview` | cookie or Bearer | Counts for home: courses, paid, unpaid, results |
| GET | `/api/me/registrations` | cookie or Bearer | Registrations joined with course title/level + payment status |
| POST | `/api/me/registrations` | cookie or Bearer | Gated by `FEATURE_APP_REGISTRATION`; verifies the course is open |
| POST | `/api/me/link-student` | cookie or Bearer | Links the account to `stud2022` by reg no + DOB (e-mail must match) |
| GET | `/api/me/results?course_id=&sitting=` | cookie or Bearer | Scores; returns `reason: "unpaid"` until the course is paid |
| GET | `/api/health` | public | `200 ok` when MySQL answers, `503` otherwise (no error details leaked) |

Bearer tokens exist because a packaged WebView cannot rely on cookies; the
browser build uses both.

## How authentication works

1. **New account** — `/sign-up` posts to `/api/auth/signup`. The handler first
   checks whether the e-mail matches an active `stud2022` row. If it does, it
   returns `{ needsStudentSetup: true }` and the client goes to
   `/student-setup`; otherwise a `users` row is created with role `user`,
   `stud2022_id = NULL` (never an admin), and the client signs in immediately.
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
7. **Forgotten passwords** — there is no self-service reset yet; the sign-in
   screen tells students to contact the school office.

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
    (auth)/           sign-in, sign-up, student-setup (+ brand layout)
    api/              auth/*, courses, courses/[id], me/*, health
    layout.tsx        metadata, manifest, theme bootstrap, SW registration
    page.tsx          session-aware redirect
  components/mobile/  AppMenu, AppTopBar, MobileAppHeader, MobileBottomNav,
                      MobileScreen, MobileStates, MobileLoaders, MobileCourseCard,
                      PasswordInput, VideoPlayerSheet
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
**31 tests across 5 test files (7 `describe` suites)**:

| Suite | Covers |
| --- | --- |
| `auth-service.test.mjs` | Signup, duplicate/generic errors, e-mail verification, sign-in, lockout |
| `sessions.test.mjs` | Token creation, validation, expiry, revocation, cookie building |
| `passwords.test.mjs` | bcrypt hashing and policy rules |
| `verification.test.mjs` | Code issuance, TTL, attempt limits, single use |
| `auth-store.test.mjs` | Store selection (`memory` only in tests) and DB config validation |

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
4. **E-mail delivery is development-only.** Verification codes go to an
   in-memory outbox and are lost on restart; production delivery throws until a
   real provider is wired up behind `AUTH_EMAIL_PROVIDER`.
   `AUTH_REQUIRE_EMAIL_VERIFY` is `false` by default, so accounts are usable
   without confirming an address.
5. **Verification challenges are memory-only**, so codes do not survive a
   restart and do not work across multiple server instances.
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
3. Add a real mail provider behind `AUTH_EMAIL_PROVIDER`, persist verification
   challenges, then turn on `AUTH_REQUIRE_EMAIL_VERIFY`.
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

