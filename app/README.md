# Syndicate Accord — App

Next.js (App Router) + TypeScript app for *The Syndicate Accord*.

## Working locations

- **Plan (authoritative):** `..\plan\` — architecture, schema/scoring, UI, open questions, applied decisions.
- **This app:** `.\` (`...\networking hackathon\app\`) — run all commands here.
- **Role builder (separate):** `..\role-builder\` — independent workspace.
- **Root index:** `..\WORKING.md`

## Setup

### Fast local dev (no Supabase yet)
```powershell
Set-Location "C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon\app"
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run dev
```
`app/.env.local` is preconfigured for **DEV_NO_DB=true** (in-memory, resets on restart; **never production**). Check `http://localhost:3000/api/health` → `db:"dev_no_db"`.

### With Supabase (production path)
```powershell
Copy-Item .env.example .env.local   # or edit existing
# set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, remove/false DEV_NO_DB, set strong secrets
& "C:\Program Files\nodejs\npm.cmd" run dev
```
Apply `supabase/migrations/0001_initial_skeleton.sql` in Supabase.

- App: `http://localhost:3000`
- Health: `http://localhost:3000/api/health`
- Player auth: `/login` (AURAK `@aurak.ac.ae` + 6-digit PIN)
- Player deck (after login): `/deck`, `/scan` (stub)
- **Hidden game-warden portal (A8):** `/warden/<ADMIN_PORTAL_SECRET_PATH>` — requires matching env secret **and** admin login. Not linked from main portal.
  - With default dev `.env.local`: `http://localhost:3000/warden/warden-dev-secret` (bootstrap `Arsh` / password from `.env.local`; first login seeds admin when store is empty). Dev data resets on restart.


## Key files

- `src/app/api/auth/*` — player register/login/me/logout
- `src/app/api/admin/*` — admin login/me/users/conflicts (session-protected)
- `src/app/warden/[secret]/` — hidden portal entry (404 if secret mismatch)
- `src/lib/*` — Supabase service client, crypto, validation, sessions, badge parser, decisions
- `supabase/migrations/0001_initial_skeleton.sql` — schema skeleton (apply in Supabase; includes players/admin tables/config defaults reflecting A2/A4/A5/A8/B2)
- `../plan/APPLIED-DECISIONS.md` — applied product decisions

## Applied decisions reflected
- A5: start **2026-11-16**, closing session **2026-11-23 Mon** (Asia/Dubai), configurable.
- A2/C1/C6: AURAK email + 6-digit PIN; minimal email management data; no character data in main app; delete all data immediately after event.
- A4: reduced patron bonus (config defaults): patron scan bonus +1 (cross-faction patron base 6), Patron Touch 3×+3 then 3×+1.
- A8: hidden portal + admin login; bootstrap admin can add users. Configure via `.env.local`.

## Security
- Never commit `.env.local`. Keep `ADMIN_PORTAL_SECRET_PATH`, `SESSION_SECRET`, service role key, and bootstrap/admin passwords secret.
- Rotate bootstrap password before shared/staging/production. Admin login is required even with the hidden link.

