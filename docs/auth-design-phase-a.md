# Alpha Deutsch — Phase A: Auth Audit & Design

Local design task only. No production changes, no migrations executed,
no emails sent, no PII printed. `sql-db/alphad.sql` is absent from this
working tree (git-ignored historical snapshot); treated as read-only.

## A1. Existing app inventory (working tree)

Public mobile-app shell (white surfaces, gold accent, theme toggle kept):
- `src/app/layout.tsx` — shell + `MobileAppHeader` + `MobileBottomNav`
- `src/app/page.tsx` — landing, open-courses preview (public)
- `src/app/courses/page.tsx` + `src/app/courses/[id]/page.tsx` — public catalogue (client fetch)
- `src/app/learning/page.tsx` — placeholder, no records loaded
- `src/app/profile/page.tsx` — guest placeholder, support contacts
- `src/components/mobile/AppMenu.tsx` — icon-only menu button (kept)
- `src/components/mobile/MobileBottomNav.tsx` — Home / Courses / My Learning / Profile
- `GET /api/courses` (open filter, `?open=all`), `GET /api/courses/[id]`, `GET /api/health`
- No auth routes, no session code, no result/registration APIs exist yet.
- Deleted (in HEAD history, still visible via git): `student-portal` +
  `PortalPreview` — legacy UX was reg_no + course + DOB + sitting, with
  notice "must have fully paid course fees". No backend was wired.

## A2. Database facts (local dev DB, read-only SELECTs + schema introspection)

Tables: `course_reg` (734), `courses`, `magic_links` (4), `packages`,
`results` (616 rows / 360 students / 7 courses), `sessions` (0),
`stud2022` (472, all Active; 5 adminlevel=Yes), `users` (1 test student).

Keys/integrity (names only):
- FKs exist only: `magic_links.user_id -> users.id`,
  `sessions.user_id -> users.id`. No FKs on `stud2022`/`course_reg`/`results`.
- `stud2022` unique: `email`, `reg_no`, `phone_no`. Zero duplicate emails/reg_nos.
- `course_reg`: 6 (student_reg_no, course_id) duplicate pairs exist.
- Zero orphans: every `course_reg.student_reg_no` and `results.reg_no`
  exists in `stud2022.reg_no`. 438/472 students have registrations;
  360/472 have results; 619 rows join across all three.
- `results.sittings`: mostly 1 (599), some 2/0/5. `course_reg.payment_status`:
  Yes=658, No=76. `results` has per-skill scores/grades + `total`.
- `users` (id, email UNIQUE, name, role=student, timestamps) has NO link to
  `stud2022`: 0 email overlaps with legacy students.
- Sessions/magic_links store `token_hash char(64)` (SHA-256-shaped), expiry,
  request_ip; magic_links has `used_at` (single-use capable).

## A3. Legacy password algorithm: UNVERIFIED (blocking)

- `stud2022.killer varchar(100)`: 259/472 filled, 213 blank. All filled values
  are 32-char lowercase/uppercase hex; zero bcrypt (`$2%`), zero argon, zero
  40-char hex. Shape is *consistent with* MD5 but NOT proof.

## A4. Required UX routes (public vs protected)

Public: `/` (adds Sign In / Sign Up entry), `/courses`, `/courses/[id]`,
`/signin`, `/signup`, `/verify-email`, `/forgot-password` (design only),
`GET /api/courses*`, `GET /api/health`, auth APIs.
Protected (server-side session required, redirect to `/signin?next=...`):
`/dashboard` (Check Result, Register for Course, My Registrations, Profile,
Logout), `/results`, `/register-course?course=<id>`, `/learning`, `/profile`.

## A5. Identity matching rules (no duplicates, no reg_no+DOB alone)

- `stud2022.email`, `reg_no`, `phone_no` are each UNIQUE; matching key is email
  (case-insensitive) OR reg_no; phone only as auxiliary contact data.
- Signup email that matches a `stud2022.email` (case-insensitive) => EXISTING
  student claim flow: time-limited single-use email code to that address,
  then set app password. Never create a second `stud2022` row.
- Signup email with no match => NEW student flow: email code first, then create
  identity per the school's real admission process (owner must confirm whether
  the app may insert into `stud2022` or must queue for staff approval —
  see E1). New `reg_no` issuance is an owner decision, never invented here.
- reg_no + DOB alone is explicitly rejected as proof (legacy portal used
  reg_no+DOB+sitting; new flow requires email-code ownership + password).
- Authenticated `reg_no` comes ONLY from the server session binding
  (`users` -> `stud2022` link row), never from client-supplied IDs (IDOR-safe).
- Legacy `killer` values: never compared until algorithm confirmed; never
  overwritten silently. After confirmed verification, upgrade path is
  bcrypt re-hash into the new app credential store, original left intact
  until owner approves cleanup.

## A6. Auth API design (all behind Next.js server routes, MySQL via pool)

- `POST /api/auth/signup` — validate name/email/password/reg-claim; generic
  responses; rate-limited; issues email code, never logs the code.
- `POST /api/auth/verify-email` — single-use, expiry (15 min), max 5 attempts,
  resend cooldown 60s; binds session on success.
- `POST /api/auth/signin` — email+password, bcrypt compare, constant-time
  generic failure, rate-limited + lockout backoff.
- `POST /api/auth/signout` — revoke current session token server-side, clear cookie.
- `GET /api/auth/me` — session -> { id, email, name, reg_no?, role }.
- `GET /api/results?course_id=&sitting=` — session reg_no only; preserves
  legacy paid-fees gate (join `course_reg.payment_status='Yes'`); generic 404
  when no record (no existence oracle).
- `GET /api/registrations` — session reg_no only.
- `POST /api/registrations` — session reg_no, open-course check, duplicate
  guard (unique pair), no invented fees/policies.
- Sessions: 256-bit random token, SHA-256 hash stored (`sessions.token_hash`
  shape already fits), HttpOnly+Secure+SameSite=Lax cookie, 30-day expiry
  with sliding refresh, revoke on logout/password change. `magic_links`
  reused for email codes (hash + expiry + used_at + attempt counter TBD).
- Rate limiting: in-memory sliding window per IP+endpoint in Phase B
  (documented as single-instance dev-grade; production needs shared store).

## A7. Minimal proposed schema changes (PROPOSAL ONLY — not executed)

1. `users`: add `password_hash varchar(255) NULL`, `email_verified_at datetime NULL`,
   `stud2022_id int NULL UNIQUE` (nullable link to legacy record; unique prevents
   two app accounts claiming one student). Why: credentials + verified binding
   without touching `stud2022`.
2. `magic_links`: add `attempts int DEFAULT 0`, `purpose varchar(20)` if the
   table is reused for signup/claim/reset codes. Why: attempt limits + purpose
   separation; smallest change to existing single-use design.
3. `course_reg`: add `UNIQUE(student_reg_no, course_id)` — or enforce in code
   if owner refuses DDL — because 6 duplicate pairs exist today. Needs owner
   data-cleanup decision first.
4. Optional hardening later: indexes on `results(reg_no)`, `course_reg(student_reg_no)`.
No new tables proposed; `sessions`/`magic_links` shapes already fit.

- `grep -rni` over `src/` and `git grep HEAD` for killer|md5|password: zero hits.
  `git log -S killer`: zero hits. No authoritative code or docs found.
- `stud2022.reset_token text` exists but no code references it.
- DECISION: do NOT verify legacy passwords yet; do NOT migrate/overwrite
  `killer`, `reset_token`, or any student fields. Phase B builds only the
  safe, independent parts (new-account hashing with bcrypt, sessions, email
  codes via `magic_links`, protected scaffolding). Legacy-password path stays
  designed-but-disabled until the owner confirms the algorithm.
