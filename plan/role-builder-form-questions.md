# Syndicate Accord — Character Intake Form Questions

Copy these into Microsoft Forms (or Tally / Google Forms). Export answers as CSV and drop it in `role-builder/data/intake.csv`.

---

## Section 1 — Identity (required)

| # | Question type | Question text | Validation |
|---|---|---|---|
| Q1 | Text | **Full name** (as you want it printed on your badge) | Required · 2–40 chars |
| Q2 | Text | **AURAK email address** | Required · must end with `@aurak.ac.ae` |
| Q3 | Text | **Student ID number** (optional — helps resolve conflicts) | Optional · max 20 chars |

---

## Section 2 — Personality & Interests (required for story generation)

| # | Question type | Question text | Answer options |
|---|---|---|---|
| Q4 | Multiple choice | **How do you prefer to work?** | Solo deep-dive · Small team collaboration · Large group coordination · Leading a team |
| Q5 | Multiple choice | **What kind of problems excite you most?** | Puzzle / logic challenges · Designing something beautiful · Figuring out people / motivations · Building practical tools |
| Q6 | Multiple choice | **At a networking event, you are most likely to…** | Look for one deep conversation · Work the room meeting many people · Listen and observe before engaging · Be introduced by someone else |
| Q7 | Multiple choice | **Pick your approach under pressure:** | Stay calm and analyse · Delegate and organise · Improvise and adapt · Rally people around a vision |
| Q8 | Multiple choice | **What topic could you talk about for 30 minutes unprepared?** | Technology / gadgets / how things work · Business / markets / strategy · Art / culture / storytelling · Leadership / mentoring / community |

---

## Section 3 — Hobbies & Background (fill as many as apply — used for trait selection)

| # | Question type | Question text |
|---|---|---|
| Q9 | Checkboxes (multiple select) | **Which hobbies or activities do you enjoy?** (select all that apply) |
|   | Options: | Coding / programming · Game development · Hackathons / CTFs · Robotics / hardware · Reading (specify genre below) · Writing / blogging · Graphic design · Video editing / film · Music / DJing / production · Photography · Debate / public speaking · Model UN / politics · Sports / fitness · Team sports captain · Volunteering / NGO work · Entrepreneurship / side hustle · Travel / cultural exchange · Cooking / food · Board games / RPGs · Language learning · Mentoring / tutoring · Chess / strategy games · Community building · Event organising |
| Q10 | Text (multiple entries) | **Any other skills, languages, or notable experiences?** (one per line, max 5 lines) |
| Q11 | Multiple choice | **What year are you at AURAK?** | First year · Second year · Third year · Fourth year · Graduate student · Faculty / staff |
| Q12 | Dropdown | **What is your field of study?** | Computer Science · Information Systems · Business Administration · Finance · Marketing · Accounting · Psychology · Communications · Liberal Arts · Engineering · Other |

---

## Section 4 — Aspirations (drives narrative voice)

| # | Question type | Question text |
|---|---|---|
| Q13 | Multiple choice | **What's your biggest professional goal right now?** | Land a tech internship · Start a business · Get into grad school · Build a portfolio project · Find a co-founder · Learn a new skill · Make an impact in the community · Other |
| Q14 | Text | **If you could master one skill overnight, what would it be?** | Max 60 chars |
| Q15 | Multiple choice | **What kind of person do you want to be remembered as?** | A builder who made things · A connector who brought people together · A storyteller who moved people · A leader who lifted others up |

---

## Section 5 — Optional descriptor (max 60 chars, shown on badge)

| # | Question type | Question text |
|---|---|---|
| Q16 | Text | **One-line tagline or personal motto** (optional — appears under your role on the badge) | Max 60 chars |

---

## Section 6 — Consent & contact

| # | Question type | Question text |
|---|---|---|
| Q17 | Multiple choice | **How would you like to receive your character card?** | Email as PDF only · Both email PDF and web portal · Web portal only (I'll screenshot it) |
| Q18 | Checkbox | **I consent to my name, role, and descriptor being displayed on the event leaderboard.** | ☐ Yes · ☐ No (name hidden, role shown only) |
| Q19 | Text | **Emergency contact name + phone** (optional — for lost-badge situations) | Max 30 chars each field |

---

## Export instructions

In Microsoft Forms → "Open in Excel" → download the .xlsx → save as UTF-8 CSV matching these column headers:

```
Q1_Q1_Full_name,Q2_AURAK_email_address,Q3_Student_ID_number,Q4_How_do_you_prefer_to_work,Q5_What_kind_of_problems_excite_you,Q6_At_a_networking_event,Q7_Pick_your_approach_under_pressure,Q8_What_topic_could_you_talk_about,Q9_Checkboxes_hobbies,Q10_Other_skills_languages,Q11_What_year_are_you,Q12_Field_of_study,Q13_Biggest_professional_goal,Q14_One_skill_to_master,Q15_Remembered_as,Q16_Tagline_motto,Q17_How_would_you_like_to_receive,Q18_Consent_leaderboard,Q19_Emergency_contact
```

Then place the file at: `role-builder/data/intake.csv`

---

## Quota planning notes

| Roster size | Est. response time | CSV rows | Notes |
|---|---|---|---|
| 50 players | ~12 min | 50 | Safe minimum |
| 75 players | ~18 min | 75 | Comfortable |
| 100 players | ~25 min | 100 | Ensure Q9 checkbox parsing is clean |

The role assignment is **fully random** — the form does NOT let users pick their faction. The engine uses answers to generate personality and traits *after* assignment.
