import { parse, unparse } from "papaparse";
import fs from "fs";
import path from "path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { CharacterBio, IntakeRow, buildCharacterFromIntake } from "../lib/generate-bio";

// Formats a character dossier cleanly into text format
function formatCharacterAsText(char: CharacterBio): string {
  return `===================================================================
THE SYNDICATE ACCORD — CHARACTER DOSSIER
===================================================================

AGENT NAME:       ${char.fullName}
BADGE CODE:       #${char.badgeCode}
ROLE / FACTION:   ${char.roleName.toUpperCase()}
AURAK EMAIL:      ${char.email}
STUDY / YEAR:     ${char.fieldOfStudy} (${char.year})
TAGLINE:          "${char.tagline}"

-------------------------------------------------------------------
CODENAME / TITLE:
-------------------------------------------------------------------
${char.title}

-------------------------------------------------------------------
OPERATIONAL ORIGIN & STORY:
-------------------------------------------------------------------
${char.originStory}

-------------------------------------------------------------------
FACTION SPECIALITY:
-------------------------------------------------------------------
${char.speciality}

-------------------------------------------------------------------
IDENTIFIED OPERATIONAL TRAITS:
-------------------------------------------------------------------
${char.traits.map((t) => `• ${t}`).join("\n")}

-------------------------------------------------------------------
FACTION MOTTO:
-------------------------------------------------------------------
"${char.motto}"

===================================================================
Issued by order of The Syndicate Accord Game Wardens
===================================================================
`;
}

// CLI Tool to bulk process intake.csv
async function runGenerator() {
  const csvPath = path.join(process.cwd(), "data", "intake.csv");
  if (!fs.existsSync(csvPath)) {
    console.error("No data/intake.csv found. Export from MS Forms and place it there.");
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const parsed = parse<any>(csvContent, { header: true, skipEmptyLines: true });

  console.log(`Processing ${parsed.data.length} characters...`);

  // Ensure characters directory exists
  const charactersDir = path.join(process.cwd(), "data", "characters");
  if (!fs.existsSync(charactersDir)) {
    fs.mkdirSync(charactersDir, { recursive: true });
  }

  const results = [];
  const invitations: Array<{ email: string; fullName: string; expiresAt: string; registrationUrl: string }> = [];
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  const gameAppUrl = (process.env.GAME_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  let failures = 0;

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const email = String(row.Q2_AURAK_email_address ?? "").trim().toLowerCase();
    if (!/^[^@\s/\\]+@aurak\.ac\.ae$/i.test(email)) {
      console.error(`Skipping row ${i + 1}: invalid AURAK email address.`);
      failures++;
      continue;
    }

    // Map CSV to IntakeRow
    const intake: IntakeRow = {
      fullName: row.Q1_Q1_Full_name,
      email,
      studentId: row.Q3_Student_ID_number,
      workPreference: row.Q4_How_do_you_prefer_to_work,
      problemType: row.Q5_What_kind_of_problems_excite_you,
      networkingStyle: row.Q6_At_a_networking_event,
      pressureStyle: row.Q7_Pick_your_approach_under_pressure,
      talkTopic: row.Q8_What_topic_could_you_talk_about,
      hobbies: row.Q9_Checkboxes_hobbies ? row.Q9_Checkboxes_hobbies.split(";") : [],
      otherSkills: row.Q10_Other_skills_languages,
      year: row.Q11_What_year_are_you,
      fieldOfStudy: row.Q12_Field_of_study,
      goal: row.Q13_Biggest_professional_goal,
      skillToMaster: row.Q14_One_skill_to_master,
      rememberedAs: row.Q15_Remembered_as,
      tagline: row.Q16_Tagline_motto,
    };

    const character = buildCharacterFromIntake(intake, i);
    results.push(character);

    const safeFilename = `${character.email.replace(/@/g, "_")}.txt`;
    const filePath = path.join(charactersDir, safeFilename);
    const textContent = formatCharacterAsText(character);
    fs.writeFileSync(filePath, textContent, "utf-8");
    console.log(`[Text Export] Saved: data/characters/${safeFilename}`);

    let registrationToken: string | null = null;
    let registrationExpiresAt: string | null = null;
    let registeredAt: string | null = null;
    if (supabase) {
      const { data: existing, error: lookupError } = await supabase
        .from("character_dossiers")
        .select("registered_at")
        .eq("email", character.email)
        .maybeSingle();
      if (lookupError) {
        console.error(`Could not check existing character for ${character.email}: ${lookupError.message}`);
        failures++;
        continue;
      }

      registeredAt = existing?.registered_at ?? null;
      if (!registeredAt) {
        registrationToken = crypto.randomBytes(32).toString("hex");
        registrationExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      }

      const registrationTokenHash = registrationToken
        ? `\\x${crypto.createHash("sha256").update(registrationToken).digest("hex")}`
        : null;
      const { error: syncError } = await supabase.from("character_dossiers").upsert({
        email: character.email,
        character_data: character,
        dossier_text: textContent,
        registration_token_hash: registrationTokenHash,
        registration_expires_at: registrationExpiresAt,
        registered_at: registeredAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "email" });
      if (syncError) {
        console.error(`Could not sync character for ${character.email}: ${syncError.message}`);
        failures++;
        continue;
      }
      if (registrationToken && registrationExpiresAt) {
        invitations.push({
          email: character.email,
          fullName: character.fullName,
          expiresAt: registrationExpiresAt,
          registrationUrl: `${gameAppUrl}/login?mode=register#invite=${registrationToken}`,
        });
      }
    }
  }

  if (supabase) {
    const invitationsPath = path.join(process.cwd(), "data", "registration-invitations.csv");
    fs.writeFileSync(invitationsPath, unparse(invitations), "utf-8");
    console.log(`Registration links saved to data/registration-invitations.csv; share each link with its matching player and keep this file private.`);
    if (invitations.length > 0) {
      console.warn("Running the generator again replaces outstanding links for characters who have not registered.");
    }
  }

  // Save full registry JSON for main app import
  fs.writeFileSync(
    path.join(process.cwd(), "data", "registry.json"),
    JSON.stringify(results, null, 2)
  );

  console.log("\n-------------------------------------------------------------------");
  console.log(`Processed ${results.length} characters; ${failures} row(s) failed.`);
  if (!supabase) console.warn("Characters were not synced and registration links were not created. Configure Supabase before player registration.");
  console.log("Registry JSON created at data/registry.json");
  console.log("-------------------------------------------------------------------\n");
  if (failures > 0) process.exitCode = 1;
}

runGenerator();
