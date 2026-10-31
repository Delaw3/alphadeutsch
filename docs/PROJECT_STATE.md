# Alpha Deutsch App — Project State

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
