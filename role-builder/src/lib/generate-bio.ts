import { RoleType, ROLES } from "./roles";

export interface IntakeRow {
  fullName: string;
  email: string;
  studentId?: string;
  workPreference?: string;
  problemType?: string;
  networkingStyle?: string;
  pressureStyle?: string;
  talkTopic?: string;
  hobbies?: string[];
  otherSkills?: string;
  year?: string;
  fieldOfStudy?: string;
  goal?: string;
  skillToMaster?: string;
  rememberedAs?: string;
  tagline?: string;
}

export interface CharacterBio {
  id: string;
  badgeCode: string; // 6-digit assigned code
  fullName: string;
  email: string;
  role: RoleType;
  roleName: string;
  roleColor: string;
  tagline: string;
  title: string;
  originStory: string;
  speciality: string;
  motto: string;
  syndicateRank: string;
  traits: string[];
  fieldOfStudy: string;
  year: string;
}

// Clean and sanitize string inputs safely
export function sanitizeInput(str: unknown, fallback: string = ""): string {
  if (typeof str !== "string") return fallback;
  return str.trim().replace(/[<>]/g, "").slice(0, 300) || fallback;
}

// Generate a random deterministic-seeded 6-digit badge code
export function generateBadgeCode(index: number): string {
  const codeNum = 100000 + ((index * 397) % 899999);
  return codeNum.toString();
}

// Story variable pools per role
const STORY_TEMPLATES: Record<RoleType, {
  titles: string[];
  origins: string[];
  specialities: string[];
  mottos: string[];
}> = {
  artificer: {
    titles: [
      "The Cog in the Dark",
      "Architect of Hidden Circuits",
      "Master of Mechanical Truths",
      "Weaver of Logic and Steel",
    ],
    origins: [
      "Hailing from {fieldOfStudy}, {name} entered the Syndicate with a singular reputation: the one who looks behind the panel when everyone else is content with the screen. Driven by a passion for {hobby}, they turn raw chaos into elegant systems.",
      "Known across {year} circles as a relentless builder, {name} operates at the intersection of logic and drive. Whether mastering {skillToMaster} or decoding complex networks, their mind seeks the underlying rule of every mechanism.",
    ],
    specialities: [
      "Deconstructing complex problems into precise, solvable components under high pressure.",
      "Building resilient tools that survive live operations when standard methods fail.",
      "Identifying structural weaknesses before they manifest as critical faults.",
    ],
    mottos: [
      "If it breaks, we reconstruct it better.",
      "Precision over noise.",
      "Every mechanism hides a secret blueprint.",
    ],
  },
  broker: {
    titles: [
      "The Unseen Nexus",
      "Architect of Alliances",
      "Naval Director of Information",
      "Master of the Ledger",
    ],
    origins: [
      "Operating from the heart of {fieldOfStudy}, {name} understands what others miss: information is only as valuable as the connection it completes. Armed with an instinct for {hobby}, they navigate the gala room like a grand chessboard.",
      "With a career goal to {goal}, {name} brings strategic clarity to every table. In the Syndicate, they act as the essential bridge between the builders who make and the weavers who tell.",
    ],
    specialities: [
      "Spotting hidden alignment between opposing interests and closing mutual deals.",
      "Mobilising cross-functional teams in seconds during high-stakes sessions.",
      "Converting subtle informal conversations into structured action.",
    ],
    mottos: [
      "An alliance forged in tension is the strongest metal.",
      "Connect the nodes, control the outcome.",
      "Value is created at the intersection.",
    ],
  },
  weaver: {
    titles: [
      "The Symbol Craft",
      "Narrative Director of the Assembly",
      "Shaper of Resonant Visions",
      "Weaver of Faction Lore",
    ],
    origins: [
      "From the creative halls of {fieldOfStudy}, {name} brings a rare gift to the Syndicate: turning abstract concepts into resonant human stories. Their dedication to {hobby} gives their work an undeniable aesthetic edge.",
      "Seeking to be remembered as {rememberedAs}, {name} approaches networking not as an exchange of cards, but as the curation of shared memory. They render complex ideas accessible and magnetic.",
    ],
    specialities: [
      "Transforming raw technical features into compelling, unforgettable narratives.",
      "Designing team experiences that turn strangers into tight-knit collaborators.",
      "Reading room dynamics instantly and adapting tone to inspire trust.",
    ],
    mottos: [
      "A story well told moves mountains.",
      "We shape the symbols; the symbols shape the outcome.",
      "Atmosphere is the invisible foundation.",
    ],
  },
  patron: {
    titles: [
      "The Steady Helm",
      "Guardian of Faction Wisdom",
      "Tipping Point of the Assembly",
      "Senior Influence Holder",
    ],
    origins: [
      "Representing the seasoned core of {fieldOfStudy}, {name} brings calm authority and sharp perspective to the gala floor. Balancing {hobby} with a passion for mentorship, they serve as both anchor and accelerator.",
      "Driven by a vision to {goal}, {name} uses their influence not to command, but to elevate those around them. Their presence alone can turn a struggling initiative into an undisputed success.",
    ],
    specialities: [
      "Providing quiet, decisive guidance when teams hit an impasse.",
      "Allocating key strategic support to high-potential initiatives.",
      "Mentoring emerging leads into confident operators.",
    ],
    mottos: [
      "True influence builds others up.",
      "Wisdom is knowing when to speak and when to empower.",
      "The longest shadow belongs to the tallest torch.",
    ],
  },
};

// Main processing function for 50–100 rows with 0 failure tolerance
export function buildCharacterFromIntake(row: IntakeRow, index: number, assignedRole?: RoleType): CharacterBio {
  const name = sanitizeInput(row.fullName, `Agent ${index + 1}`);
  const email = sanitizeInput(row.email, `player${index + 1}@aurak.ac.ae`).toLowerCase();
  const fieldOfStudy = sanitizeInput(row.fieldOfStudy, "General Studies");
  const year = sanitizeInput(row.year, "Member");
  const goal = sanitizeInput(row.goal, "make a lasting impact");
  const skillToMaster = sanitizeInput(row.skillToMaster, "strategic thinking");
  const rememberedAs = sanitizeInput(row.rememberedAs, "a visionary builder");
  const tagline = sanitizeInput(row.tagline, "Building the future, one connection at a time.");
  const hobby = (row.hobbies && row.hobbies.length > 0) ? row.hobbies[0] : "strategic analysis";

  // Pick or assign role evenly (round-robin + offset to keep random distribution)
  const role: RoleType = assignedRole || (["artificer", "broker", "weaver", "patron"][index % 4] as RoleType);
  const roleMeta = ROLES[role];
  const templates = STORY_TEMPLATES[role];

  // Pick deterministic variations based on index
  const title = templates.titles[index % templates.titles.length];
  const originRaw = templates.origins[index % templates.origins.length];
  const speciality = templates.specialities[index % templates.specialities.length];
  const motto = templates.mottos[index % templates.mottos.length];

  // Replace placeholders safely
  const originStory = originRaw
    .replace(/\{name\}/g, name)
    .replace(/\{fieldOfStudy\}/g, fieldOfStudy)
    .replace(/\{year\}/g, year)
    .replace(/\{hobby\}/g, hobby)
    .replace(/\{goal\}/g, goal)
    .replace(/\{skillToMaster\}/g, skillToMaster)
    .replace(/\{rememberedAs\}/g, rememberedAs);

  // Generate 3 personalized traits
  const traits = [
    roleMeta.traits[index % roleMeta.traits.length],
    `Specialist: ${hobby}`,
    `Focus: ${fieldOfStudy}`,
  ];

  const badgeCode = generateBadgeCode(index);

  return {
    id: `char_${index + 1}_${badgeCode}`,
    badgeCode,
    fullName: name,
    email,
    role,
    roleName: roleMeta.name,
    roleColor: roleMeta.color,
    tagline,
    title,
    originStory,
    speciality,
    motto,
    syndicateRank: `Initiate (${year})`,
    traits,
    fieldOfStudy,
    year,
  };
}
