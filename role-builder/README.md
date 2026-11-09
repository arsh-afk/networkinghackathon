# The Syndicate Accord — Role Builder & Character Generator

The **Role Builder** is an independent pre-event tool for **The Syndicate Accord**. It takes player intake responses from Microsoft Forms (or Google/Tally Forms), generates unique fantasy persona dossiers for 50–100+ participants with zero failures, produces print-ready dark-themed **PDF character sheets**, and generates a `registry.json` for importing players directly into the main game app.

---

## 📁 Directory Structure & Quick Map

All files for this app live inside the `role-builder/` directory:

```text
role-builder/
├── data/                        👈 PUT YOUR CSV HERE!
│   ├── intake.csv               (Input: Exported MS Forms CSV)
│   ├── registry.json            (Output: Generated character database)
│   └── characters/              (Output: Character dossiers as text files)
│       ├── l.haddad22_aurak_ac_ae.txt
│       └── m.abdullah_aurak_ac_ae.txt
│           (and more...)
├── public/                      (Static assets & fonts)
├── src/
│   ├── app/                     (Next.js App Router for web portal)
│   │   ├── layout.tsx
│   │   ├── page.tsx             (Portal homepage)
│   │   └── portal/[code]/       (Individual web character dossier view)
│   ├── lib/
│   │   ├── roles.ts             (Artificer, Broker, Weaver, Patron meta & tokens)
│   │   ├── generate-bio.ts      (Story generator & input sanitizer)
│   │   ├── pdf-generator.ts     (jsPDF vector card renderer)
│   ├── scripts/
│   │   └── generate.ts          (CLI script to build characters and registration links)
│   └── styles/
│       └── globals.css          ("Inked Ledger" brass/dark CSS tokens)
├── package.json
├── tsconfig.json
└── README.md                    (This file)
```

---

## 🚀 Step-by-Step Instructions

### Step 1: Create the Microsoft Form & Collect Responses

1. Open Microsoft Forms (or Tally/Google Forms).
2. Copy the questions exactly as outlined in:
   `plan/role-builder-form-questions.md`
3. Share the link with your 50–100 participants.

---

### Step 2: Export the CSV & Save to Directory

1. Once form responses are in, go to Microsoft Forms → **Responses** → **Open in Excel**.
2. Save/Export the file as a **CSV (UTF-8)** named `intake.csv`.
3. Copy `intake.csv` directly into the `role-builder/data/` folder:
   ```text
   C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon\role-builder\data\intake.csv
   ```

*Note: The generator handles missing fields, extra spaces, special characters, or variable row counts safely.*

---

### Step 3: Run the Character Generator

Open PowerShell, navigate to the `role-builder` directory, install dependencies, and run the generator script:

```powershell
# 1. Navigate to the role-builder folder
Set-Location "C:\Users\arsh2\OneDrive - American University of Ras Al Khaimah\.Clubs\networking hackathon\role-builder"

# 2. Install dependencies (only required once)
& "C:\Program Files\nodejs\npm.cmd" install

# 3. Generate the character dossiers & registry
& "C:\Program Files\nodejs\npm.cmd" run generate
```

---

### Step 4 (Optional): Sync Characters and Create Registration Links

To make characters available to registration and `/me`, apply all three main-app Supabase migrations in order, then set the same `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` used by the game app. Set `GAME_APP_URL` to the deployed game app address (or `http://localhost:3000` for local testing):

```powershell
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
$env:GAME_APP_URL="https://your-game-app.example"

& "C:\Program Files\nodejs\npm.cmd" run generate
```

The generator always saves each character as a formatted **text dossier** in `role-builder/data/characters/`, named using the email with `@` replaced by `_`. It also writes `registry.json`; both outputs contain personal information and are excluded from Git.

When Supabase is configured, the generator syncs each dossier and writes `data/registration-invitations.csv`. Share each player's `registrationUrl` with that player yourself. Links expire after 14 days; running the generator again replaces outstanding links for people who have not registered. Treat the CSV as a password: anyone with a link can claim that character.

---

### Step 5: Launch the Character Portal Preview

To view the generated web dossiers locally or host the character portal for players:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Open your browser to:
`http://localhost:3001/portal/<6-digit-badge-code>` (e.g. `http://localhost:3001/portal/100397`)

---

## 📄 Output Files Location

Once `npm run generate` finishes, check `role-builder/data/`:

1. **`role-builder/data/registry.json`**:
   The full JSON dump of all generated characters (Badge Code, Name, Role, Email, Story, Traits). You can upload this directly into the main game app database or admin portal.

2. **Text Character Dossiers** (`data/characters/`):
   Each generated character is saved as a formatted text file named after their email with `@` replaced by `_`.

3. **Registration links (Optional)**:
   `data/registration-invitations.csv` contains private one-time registration links. Share each link directly with its matching player; the app validates it against the synced Supabase character record.

---

## 🎨 Visual Design ("The Inked Ledger")

Generated PDFs and web portals automatically adopt the official gala visual tokens:
* **Background:** `--ink-950` (`#07080B`)
* **Surfaces:** `--ink-900` / `--ink-850`
* **Accents:** Brass (`#D8B45A`)
* **Faction Colors:**
  * 🔵 **Artificer:** `#6AA8FF`
  * 🟢 **Broker:** `#5FD08A`
  * 🟠 **Weaver:** `#FF9A57`
  * 🟡 **Patron:** `#F0C766`
