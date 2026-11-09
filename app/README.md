# Syndicate Accord — App

Next.js (App Router) + TypeScript app for *The Syndicate Accord*.

## Working locations

- **Plan (authoritative):** `..\plan\` — architecture, schema/scoring, UI, open questions, applied decisions.
- **This app:** `.\` (`...\networking hackathon\app\`) — run all commands here.
- **Role builder (separate):** `..\role-builder\` — independent workspace.
- **Root index:** `..\WORKING.md`

## Setup

### Fast local development
```powershell
Set-Location "C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon\app"
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run dev
```
For local UI testing without a database, `DEV_NO_DB=true` enables a development-only store (resets on restart; **never production**). The admin panel, character invitations, and durable player data require Supabase. Check `http://localhost:3000/api/health` for the configured database mode.

### Supabase setup (database used by the app)
Supabase hosts the PostgreSQL database where players, admin accounts, scans, and character invitations are stored. Set it up once:

1. Create a project at [supabase.com](https://supabase.com/).
2. In the project dashboard, open **SQL Editor**. For each file below, create a query, paste the file contents, and run it **in this order**:
   - `supabase/migrations/0001_initial_skeleton.sql`
   - `supabase/migrations/0002_complete_production_setup.sql`
   - `supabase/migrations/0003_character_dossiers.sql`
3. In **Project Settings → API** (or **API Keys**), copy the **Project URL** and the **service role/secret key**. The service key is private: use it only in server environment settings, never browser code or public client variables.
4. Put those values into `app/.env.local` for local work, or into your hosting provider's server-side environment variables for the deployed app. The file should contain entries like these (with your real values):
```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-private-service-role-key
SESSION_SECRET=your-long-random-secret
ADMIN_PORTAL_SECRET_PATH=your-private-hard-to-guess-path
ADMIN_BOOTSTRAP_USERNAME=Arsh
ADMIN_BOOTSTRAP_PASSWORD=your-private-first-admin-password
```
Then start the app from PowerShell:
```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev
```
Replace the example values; do not commit `.env.local`. Your local `.env.local` already has non-empty values for the database and admin settings, but those values still need to match the Supabase project where you run the SQL files. The second migration installs the scan RPC and admin tables; the third adds character-linked registration and profile dossiers.

The role-builder writes private `.txt` dossiers locally and syncs generated character records to `character_dossiers`. It must use the **same** Supabase URL and service-role key as the app. It creates registration links in a private CSV for you to share yourself; it does not send email. Never commit intake CSVs, registry exports, invitation links, or character text files.

- App: `http://localhost:3000`
- Health: `http://localhost:3000/api/health`
- Player auth: `/login` (AURAK `@aurak.ac.ae` + 6-digit PIN)
- Player deck (after login): `/deck`, `/scan`
- **Hidden game-warden portal (A8):** `/warden/<ADMIN_PORTAL_SECRET_PATH>` — replace the placeholder with the exact value configured in the app environment, then sign in with the bootstrap username/password. The first successful login creates the bootstrap admin only if the `admin_users` table has no accounts yet. If it already has an account, use that account's password instead.


## Key files

- `src/app/api/auth/*` — player register/login/me/logout
- `src/app/api/admin/*` — admin login/me/users/conflicts (session-protected)
- `src/app/warden/[secret]/` — hidden portal entry (404 if secret mismatch)
- `src/lib/*` — Supabase service client, crypto, validation, sessions, badge parser, decisions
- `supabase/migrations/` — apply schema and RPC migrations in filename order
- `../plan/APPLIED-DECISIONS.md` — applied product decisions

## Applied decisions reflected
- A5: start **2026-11-16**, closing session **2026-11-23 Mon** (Asia/Dubai), configurable.
- A2/C1/C6: AURAK email + 6-digit PIN; registration requires the character invitation link; the generated dossier is shown in `/me`.
- A4: reduced patron bonus (config defaults): patron scan bonus +1 (cross-faction patron base 6), Patron Touch 3×+3 then 3×+1.
- A8: hidden portal + admin login; bootstrap admin can add users. Configure via `.env.local`.

## Security
- Never commit `.env.local`. Keep `ADMIN_PORTAL_SECRET_PATH`, `SESSION_SECRET`, service role key, and bootstrap/admin passwords secret.
- Rotate bootstrap password before shared/staging/production. Admin login is required even with the hidden link.
