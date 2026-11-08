# Working locations (Syndicate Accord)

| Path | Purpose |
| --- | --- |
| `C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon\plan\` | **Authoritative planning docs** (architecture, schema/scoring, UI, open questions, applied decisions). |
| `C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon\app\` | **Main game app** (Next.js App Router + TypeScript). Run commands from here. |
| `C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon\role-builder\` | **Separate role-builder workspace** for you to work on independently (no game logic/scoring impact). |
| `C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon\Gamification Architecture & App Integration - Nov 23 Gala.md` | Original source brief. |

## App commands (run from `app/`)

```powershell
Set-Location "C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon\app"
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run dev
```

## Current status
- Main game app (`app/`): **Fully functional core built & passing production build (`npm run build`)**.
- Design System: "The Inked Ledger" aesthetic complete (`globals.css` with dark ink scale, faction colors, Cinzel/Inter/Mono typography, CSS noise overlay, brass divider rules).
- Implemented Routes:
  - `/login`: Player registration & authentication (`@aurak.ac.ae` + 6-digit PIN).
  - `/welcome`: 3D role reveal card flip animation with haptic feedback.
  - `/deck`: Player dashboard with 15-rung diminishing returns ladder, point hero, and daily tasks.
  - `/scan`: Live QR camera scanning + 6-digit manual fallback with bottom result sheet breakdown.
  - `/contracts`: Daily directives with animated ProgressRings & locked weekend syndication countdown.
  - `/ledger`: Chronological audit trail with exact arithmetic and receipt-style subtotal breakdowns.
  - `/network`: Connected agents filterable by faction with badge codes.
  - `/me`: Live personal badge QR code (with tap-to-expand), mark code, and privacy disclosures.
  - `/arena`: Projector-ready (1920×1080) real-time leaderboard with 5s edge polling and faction distribution bar.
  - `/warden/[secret]`: Hidden game-warden portal for conflict and audit management.
- API Endpoints:
  - `POST /api/scans`: Idempotent scan processing with tier & patron scoring logic.
  - `GET /api/me`: Real-time player reputation summary and tier state.
  - `GET /api/arena`: Presentation leaderboard and global telemetry statistics.
  - `GET /api/health`: Uptime and DB mode reporting.
- Verified test suite: `src/lib/scoring.test.ts` validates all tier, cross-faction, patron, and diversity multiplier fixtures.

## Key decisions (latest)
- A5: start **2026-11-16**, closing **2026-11-23 Mon** (session), weekend start assumed **2026-11-21**; configurable/times TBD.
- A2/C1/C6: `@aurak.ac.ae` + 6-digit PIN; minimal email management data only; no character data in main app; all data deleted immediately after event.
- A4: patron bonus reduced (computed): patron base +1; cross-faction patron = 6 base; Patron Touch 3×(+3) then 3×(+1).
- A8: hidden admin portal = unguessable env path/token + admin login; bootstrap admin can add users.

## Security
Use `.env.local`/secure seed for secrets. Never commit real credentials; **rotate bootstrap password before shared/staging/production**.