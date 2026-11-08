# The Syndicate Accord — Handover Document

Generated: 2026-11-08  
Workspace: `C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon`

## 1) Working locations (important)

| Path | Purpose | Status |
|---|---|---|
| `plan\` | **Authoritative planning/spec docs** (`01-architecture-and-hosting.md`, `02-data-model-and-scoring.md`, `03-ui-design-system.md`, `04-open-questions.md`, `04-answers-form.md`, `APPLIED-DECISIONS.md`) | Reference; `APPLIED-DECISIONS.md` reflects current product decisions |
| `app\` | **Main game app (Next.js App Router + TypeScript)** — all implementation in this pass | Scaffolded, auth/admin basics implemented, **build/typecheck passing** |
| `role-builder\` | **Separate pre-event role/bio builder workspace** (independent from game app/scoring) | Directory created for separate work; **not scaffolded by this implementation** |
| `WORKING.md` | Root index of locations/status | Updated |
| `Gamification Architecture & App Integration - Nov 23 Gala.md` | Original source brief | Reference; plan docs override details where specified |

## 2) Product decisions applied

Source: `plan/APPLIED-DECISIONS.md`, `app/src/lib/decisions.ts`.

- **A1 (settled):** Badge payload plain text `SA1|<6digits>|<name>|<roleLetter>`. 6-digit code is the identifier; name/role display-only (server resolves code). Parser: `app/src/lib/badge.ts`.
- **A2/C1/C6 (PII/auth):** Players sign in/register with `@aurak.ac.ae` email + **6-digit PIN**. Main game stores **minimal management data only** (email ID for management/conflict resolution). **No character/bio data in main game app.** All event data to be **deleted immediately after the event** (export-before-delete workflow still needs operational implementation). Auth conflicts are surfaced to admins.
- **A3:** Intake via Microsoft Forms. `role-builder/` is a **separate directory** for independent work; not integrated into main app/scoring.
- **A4 (patron balance, computed/configurable):** Patrons are randomly selected students and compete on the same board. Patron bonus **reduced**:
  - Patron scan base bonus = **+1** (reduced from +2) → cross-faction patron base = 3 (initiate) + 2 (cross-faction) + 1 (patron) = **6**.
  - Patron Touch (B8 adjusted): first **3** patron scans/week = **+3** each; next **3** = **+1**; after = **+0**.
  - These values are **defaults/config assumptions**; confirm/finalize before production scoring SQL.
- **A5 (dates):** **Start 2026-11-16**. **Closing session 2026-11-23 (Monday)**. **Weekend track start assumed 2026-11-21**. Timezone `Asia/Dubai`. Lock/ceremony exact times **TBD**. Dates/times are **configurable** (env/`game_config`), not hardcoded.
- **A6:** University Wi-Fi considered reliable; no aggressive offline UX. **Keep server-side idempotency/duplicate protection** and basic retries.
- **A7:** Free event; budget for non-website expenses only.
- **A8 (admin/wardens):** Hidden game-warden/admin portal via **unguessable env secret path/token (not linked on main portal)** **+ admin login required**. Portal manages fields/conflicts; bootstrap admin can add other admin/warden users.
- **A9:** Badge printing feasible; format/owner/deadline/QR export details pending.
- **A10:** Cash prizes TBD.
- **B1:** Patron + cross-faction stacks (with reduced patron component).
- **B2:** Day ends at **00:00 (midnight) Asia/Dubai** (override of 04:00 default).
- **B3–B21 (except B1, B2, B8-adjusted):** plan defaults remain unless changed (see `plan/04-open-questions.md`).
- **D1:** Author/main admin owns operational accounts. **D6:** Prefer admin controls + presentation controls on separate devices.

## 3) Current implementation status (main app: `app/`)

### Tech stack
- Next.js **14.2.33** (App Router), React 18, TypeScript
- `@supabase/supabase-js` added (Supabase provisioning deferred)
- Node >= 20 (dev used Node v24.12.0 / npm 11.6.2)

### Verification
- `npm install` completed in `app/`.
- `npm run typecheck` — **passed**
- `npm run build` — **passed**

### Implemented
- **Home/status:** `/` — shows working locations and high-level applied decisions.
- **Health:** `/api/health` — reports `ok`, `phase`, and DB mode (`configured` / `dev_no_db` / `not_configured`).
- **Player auth (A2):**
  - `/login` UI (sign in/register)
  - `POST /api/auth/register` — validates `@aurak.ac.ae` + 6-digit PIN + display name; creates minimal player record; logs duplicate-registration conflict to `auth_conflicts`; issues player session cookie.
  - `POST /api/auth/login` — validates credentials; logs not-found/inactive login conflicts; issues player session cookie.
  - `GET /api/auth/me` — current player session; `POST /api/auth/me` or `POST /api/auth/logout` — logout/revoke.
  - **Note:** current registration assigns a random role and temporary badge code for bootstrap/dev. Align with final Microsoft Forms/ops/roster flow.
- **Protected player pages:** `/deck` (session required), `/scan` (stub, session required).
- **Admin/warden portal (A8):**
  - Hidden route: `/warden/[secret]` — returns **404** if secret path segment doesn’t match `ADMIN_PORTAL_SECRET_PATH`; **not linked** from main portal.
  - `POST /api/admin/login` — requires `portalSecret` + admin credentials. If no admin users exist, first valid login using `ADMIN_BOOTSTRAP_USERNAME`/`ADMIN_BOOTSTRAP_PASSWORD` creates the bootstrap admin and writes an audit log entry.
  - `GET/POST /api/admin/me` — admin session / logout.
  - `GET/POST /api/admin/users` — list/add admin/warden users (**admin session required**).
  - `GET /api/admin/conflicts` — view auth conflicts (**admin session required**).
- **Server libs:** `src/lib/db.ts` (Supabase or DEV_NO_DB fallback), `src/lib/dev-store.ts`, `src/lib/session.ts`, `src/lib/crypto.ts` (scrypt PIN/password hashing, SHA-256 token hashes), `src/lib/validation.ts`, `src/lib/badge.ts`, `src/lib/decisions.ts`.
- **Schema skeleton:** `app/supabase/migrations/0001_initial_skeleton.sql` — includes `game_config`, `players` (with `email`), `player_sessions`, `retired_badges`, `admin_users`, `admin_sessions`, `auth_conflicts`, `scans`, `audit_log`, and indexes reflecting A2/A4/A5/A8/B2 defaults.

### Not implemented yet / TODO
- Full plan 02 schema details as needed: notes, challenges, questionnaires, reports, LinkedIn submissions, ledger adjustments, snapshots; **RLS enable + revoke grants** for production posture.
- **`rpc_scan`**, `game_day_for`, `fn_ledger`, `fn_winners` SQL (fixture-driven). Plan 02 §6 SQL is a sketch — do not copy blindly.
- **Fixture-driven scoring tests** (plan 02 §4.5 worked example + plan 01 §11 cases).
- Scan UI/API, offline/idempotent scan flow (keep idempotency), leaderboard/arena/closing surfaces, roster import, badge/QR export.
- Rate limiting / lockout enforcement (PIN brute-force, scan lookup abuse) — required before production.
- Explicit “delete all data immediately after event” operational flow (exports + DB/project deletion steps).
- Final consent/privacy copy for check-in.
- Align patron-bonus config everywhere (DB `game_config`, scoring SQL, UI) once A4/B8 values are confirmed.

## 4) Supabase deferred — DEV_NO_DB mode

You can skip Supabase setup until later.

- **DEV_NO_DB=true** (non-production only, no Supabase vars) enables an **in-memory dev store** (`src/lib/dev-store.ts`).
- **Use for:** local UI/auth/admin flow testing.
- **Not for production:** no real Postgres constraints, no RLS, no RPCs/ledger SQL, minimal query emulation, **data resets on server restart**.
- `/api/health` returns `db:"dev_no_db"` when active.
- When Supabase is configured (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`), Supabase is used.

## 5) Local run instructions

From `app/`:

```powershell
Set-Location "C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon\app"
& "C:\Program Files\nodejs\npm.cmd" install   # if needed
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Default local URLs (with current dev config):
- App: `http://localhost:3000`
- Health: `http://localhost:3000/api/health`
- Player login/register: `http://localhost:3000/login`
- Player deck (after login): `http://localhost:3000/deck`
- Scan stub: `http://localhost:3000/scan`
- **Hidden admin portal:** `/warden/<ADMIN_PORTAL_SECRET_PATH>` (not linked; requires secret path + admin login). For local dev, the secret path and bootstrap admin values are set in `app/.env.local` — **do not reuse dev secrets in shared/staging/production**.

## 6) Environment / secrets

- `app/.env.example` — template (safe to commit).
- `app/.env.local` — local dev config (**gitignored**, not committed). Contains DEV_NO_DB mode and local secrets/bootstrap values.
- **Never commit** `.env.local`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `ARENA_TOKEN`, `ADMIN_PORTAL_SECRET_PATH`, or admin passwords.
- **Security notes:**
  - Hidden link is obscurity only; **admin login is required** (keep it that way).
  - Bootstrap credentials were used for local setup; **rotate/change passwords before any shared/staging/production use**.
  - Player/admin PIN/password hashes use scrypt (Node crypto). Session tokens are random; stored as SHA-256 hashes.

## 7) Supabase setup (when ready)

1. Create Supabase project (prefer club-owned account). Region per plan (e.g. Mumbai) — confirm final choice.
2. Set in `app/.env.local`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; disable/remove `DEV_NO_DB`; set strong `SESSION_SECRET`, `ARENA_TOKEN`, `ADMIN_PORTAL_SECRET_PATH`.
3. Apply `app/supabase/migrations/0001_initial_skeleton.sql` (and future migrations).
4. Implement/apply RLS/revokes and SQL RPCs (`rpc_scan`, ledger/winners) with fixture tests.
5. Validate end-to-end auth/admin/scan flows against real DB.

## 8) Open items / decisions still needed

- **A5:** exact start-time-of-day, weekend start/lock/closing ceremony times (dates are set/configurable).
- **A4/B8:** confirm computed reduced patron values or provide final numbers.
- **A9:** badge printing owner, format, deadline, and QR/roster export requirements.
- **A10/C6/legal:** final consent/privacy copy; confirm immediate deletion workflow and any export required before deletion.
- **B3–B21 (except applied overrides):** confirm or accept defaults in `plan/04-open-questions.md`.
- **Registration/roster flow:** final intake (Microsoft Forms/CSV/import) and how real roles/badge codes are assigned vs current dev bootstrap behavior.

## 9) Known risks / cautions

- **Scoring correctness:** highest-risk area. Do not ship without fixture-driven tests for tiers, diversity, caps, voids, idempotency, and concurrency.
- **Plan 02 ledger SQL is abbreviated/sketchy:** implement from fixtures/contracts, not copy-paste.
- **DEV_NO_DB is dev-only:** it will not catch DB constraint, RLS, or scoring-RPC issues.
- **PII handling:** AURAK email is stored for management; no character data in main app. Follow immediate post-event deletion requirement and verify secure handling.
- **Rate limits/lockouts:** scaffold logic exists conceptually but production-grade controls should be enforced before event use.

## 10) Quick file map (app)

```text
app/
  .env.example
  .env.local                (local, gitignored)
  package.json
  supabase/migrations/0001_initial_skeleton.sql
  src/
    app/
      page.tsx              (home)
      login/                (player auth UI)
      deck/                 (protected player home)
      scan/                 (protected stub)
      warden/[secret]/      (hidden admin portal, 404 on wrong secret)
      api/
        health/
        auth/register|login|me|logout/
        admin/login|me|users|conflicts/
    lib/
      db.ts                 (Supabase or DEV_NO_DB)
      dev-store.ts          (dev-only in-memory fallback)
      session.ts
      crypto.ts
      validation.ts
      badge.ts
      decisions.ts
```  
