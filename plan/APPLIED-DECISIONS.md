# Applied Decisions / Conflicts (from 04 updates)

Working locations remain:
- **Plan:** `C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon\plan\`
- **App (main game):** `C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon\app\`
- **Role builder (separate, user-owned):** `C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon\role-builder\` — directory only; build separately.
- Applied config snapshot: `app\src\lib\decisions.ts`

## Applied (safe to build against now)
- **A1** settled: `SA1|6digits|name|role` plain text; 6-digit code is ID; name/role display-only.
- **A2/C1/C6 (PII)**: Login with `@aurak.ac.ae` university email + user-set **6-digit PIN**. Main game stores **minimal management data only** (email ID as needed for management/conflict resolution) in a **secure database**. **No character/bio data stored on the main game app. All data deleted immediately after the event.**
- **A3**: Intake via Microsoft Forms. `role-builder/` is a **separate directory** for you to work on independently; no bearing on final event.
- **A4 (computed, reduced patron bonus)**: Patrons are randomly selected students, compete on same board.
  - **Patron scan base bonus = +1** (reduced from +2). Cross-faction patron scan base = 3 (initiate) + 2 (cross-faction) + 1 (patron) = **6**.
  - **Patron Touch (B8 adjusted for balance):** first **3** patron scans/week = **+3** bonus each; next **3** = **+1**; after that **+0**. (Keeps patron interaction rewarded but prevents runaway advantage.)
  - Revisit numbers after playtest/roster size if needed (config-driven).
- **A5**: **Start 16 Nov 2026**. **Closing 23 Nov 2026 (Monday), closing session**. **Weekend track start assumption: 21 Nov 2026** (configurable). Lock/ceremony times TBD. `Asia/Dubai`.
- **A6**: Uni Wi-Fi reliable; no aggressive offline UX. Keep server-side idempotency/duplicate protection + basic retries.
- **A7**: Free event; budget for non-website expenses only.
- **A8 (recommended, applied)**: Hidden game-warden/admin portal via **unguessable env secret path/token, not shown on main portal** + **admin login required**. Bootstrap admin (Arsh) can add other users. *Never commit secrets/passwords; rotate before shared/staging/production.*
- **A9**: Badge printing feasible (details/deadline pending).
- **A10**: Cash prizes TBD.
- **B1**: Patron + cross-faction stacks (with reduced patron component). **B2**: day ends **00:00 Asia/Dubai**.
- **D1**: Author/main admin owns accounts. **D6**: Prefer admin controls + presentation controls on separate devices.

## Remaining clarifications
1. **A5 times:** weekend start/lock/closing ceremony exact times (dates set/configurable).
2. **A4/B8 final confirmation:** accept computed patron values above or provide preferred numbers.
3. **A9/C:** badge owner/format/deadline; roster/QR export.
4. **B3–B21 (except B1,B2,B8-adjusted):** defaults still stand unless changed.
5. **Consent/privacy copy:** immediate deletion after event still needs check-in notice text.
