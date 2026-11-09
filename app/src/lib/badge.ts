// Badge payload parser — plan 02 §2.2: SA1|042917|Layla Haddad|W
// Fields 3/4 are display-only; server resolves code for scoring.

const ROLES = { A: "artificer", B: "broker", W: "weaver", P: "patron" } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export function parseBadgeText(raw: string): { code: string; name: string; role?: Role } | null {
  const trimmed = raw.trim();
  // Support direct 6-digit code or SA1 format
  if (/^\d{6}$/.test(trimmed)) {
    return { code: trimmed, name: "" };
  }
  const parts = trimmed.split("|");
  if (parts.length < 2 || parts[0] !== "SA1") return null;
  if (!/^\d{6}$/.test(parts[1])) return null;
  const roleKey = parts.at(-1) as keyof typeof ROLES | undefined;
  const role = roleKey ? ROLES[roleKey] : undefined;
  const name = parts
    .slice(2, parts.length > 2 ? -1 : parts.length)
    .join("|")
    .replace(/[\u0000-\u001f]/g, "")
    .slice(0, 40);
  return { code: parts[1], name, role };
}
