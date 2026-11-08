import { parse } from "papaparse";
import fs from "fs";
import path from "path";
import { IntakeRow, buildCharacterFromIntake } from "../lib/generate-bio";
import { sendCharacterMail } from "../lib/mailer";

// CLI Tool to bulk process the intake.csv and email everyone
async function runGenerator() {
  const csvPath = path.join(process.cwd(), "data", "intake.csv");
  if (!fs.existsSync(csvPath)) {
    console.error("No data/intake.csv found. Export from MS Forms and place it there.");
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const parsed = parse<any>(csvContent, { header: true, skipEmptyLines: true });

  console.log(`Processing ${parsed.data.length} characters...`);

  const results = [];
  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];

    // Map CSV to IntakeRow (matching your form headers)
    const intake: IntakeRow = {
      fullName: row.Q1_Q1_Full_name,
      email: row.Q2_AURAK_email_address,
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

    // Skip emailing if not configured for now
    if (process.env.SEND_EMAILS === "true") {
      console.log(`Emailing ${character.email}...`);
      const status = await sendCharacterMail(character, process.env.NEXT_PUBLIC_PORTAL_URL || "http://localhost:3001");
      if (!status.success) {
        console.error(`Failed to email ${character.email}: ${status.error}`);
      }
    }
  }

  // Save the full registry JSON for the main app import later
  fs.writeFileSync(
    path.join(process.cwd(), "data", "registry.json"),
    JSON.stringify(results, null, 2)
  );

  console.log("Done! registry.json created in data/");
}

runGenerator();
