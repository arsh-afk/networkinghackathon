import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/db";
import { hashSecret } from "@/lib/crypto";
import { isAurakEmail, isValidPin, normalizeEmail } from "@/lib/validation";
import { cookieName, cookieOptions, issueSession } from "@/lib/session";
import crypto from "node:crypto";

const ROLES = ["artificer", "broker", "weaver", "patron"] as const;

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_NOT_CONFIGURED" }, { status: 503 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, code: "BAD_JSON" }, { status: 400 }); }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const email = normalizeEmail(String(b.email ?? ""));
  const pin = String(b.pin ?? "");
  const inviteToken = String(b.inviteToken ?? "");
  if (!isAurakEmail(email)) return NextResponse.json({ ok: false, code: "INVALID_EMAIL", message: "Use your @aurak.ac.ae email." }, { status: 400 });
  if (!isValidPin(pin)) return NextResponse.json({ ok: false, code: "INVALID_PIN", message: "PIN must be exactly 6 digits." }, { status: 400 });
  if (!/^[a-f0-9]{64}$/i.test(inviteToken)) {
    return NextResponse.json({ ok: false, code: "CHARACTER_REQUIRED", message: "Open the registration link shared with you by a game warden first." }, { status: 403 });
  }

  const tokenHash = `\\x${crypto.createHash("sha256").update(inviteToken).digest("hex")}`;
  const { data: invitation, error: inviteError } = await db
    .from("character_dossiers")
    .select("email,character_data,registration_expires_at,registered_at")
    .eq("registration_token_hash", tokenHash)
    .maybeSingle();
  if (inviteError) {
    console.error("[auth/register] Could not look up character invite:", inviteError.message);
    return NextResponse.json({ ok: false, code: "DB_ERROR" }, { status: 500 });
  }
  if (!invitation || normalizeEmail(invitation.email) !== email) {
    return NextResponse.json({ ok: false, code: "INVALID_INVITE", message: "This character link does not match that email." }, { status: 403 });
  }
  if (invitation.registered_at) {
    return NextResponse.json({ ok: false, code: "INVITE_USED", message: "This character link has already been used." }, { status: 410 });
  }
  if (!invitation.registration_expires_at || Date.parse(invitation.registration_expires_at) <= Date.now()) {
    return NextResponse.json({ ok: false, code: "INVITE_EXPIRED", message: "This character link has expired. Ask the game wardens for a new one." }, { status: 410 });
  }

  const character = invitation.character_data as {
    fullName?: unknown;
    badgeCode?: unknown;
    role?: unknown;
  } | null;
  const displayName = typeof character?.fullName === "string" ? character.fullName.trim().slice(0, 40) : "";
  const badgeCode = typeof character?.badgeCode === "string" ? character.badgeCode : "";
  const role = typeof character?.role === "string" ? character.role : "";
  if (displayName.length < 2 || !/^\d{6}$/.test(badgeCode) || !ROLES.includes(role as typeof ROLES[number])) {
    console.error("[auth/register] Character dossier is missing required account fields.");
    return NextResponse.json({ ok: false, code: "INVALID_CHARACTER" }, { status: 500 });
  }

  const { data: existing, error: existingError } = await db.from("players").select("id,email").eq("email", email).maybeSingle();
  if (existingError) {
    console.error("[auth/register] Could not check existing account:", existingError.message);
    return NextResponse.json({ ok: false, code: "DB_ERROR" }, { status: 500 });
  }
  if (existing) {
    await db.from("auth_conflicts").insert({ email, detail: "Registration attempted for existing email" });
    return NextResponse.json({ ok: false, code: "EMAIL_EXISTS", message: "This email is already registered. Contact game wardens if you need help." }, { status: 409 });
  }

  const pin_hash = await hashSecret(pin);
  const { data: player, error } = await db.from("players").insert({
    email,
    display_name: displayName,
    role,
    badge_code: badgeCode,
    pin_hash,
  }).select("id,display_name,role,badge_code,email").single();
  if (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
    if (code === "23505") return NextResponse.json({ ok: false, code: "CONFLICT", message: "Registration conflict. Try again." }, { status: 409 });
    return NextResponse.json({ ok: false, code: "DB_ERROR", message: error.message }, { status: 500 });
  }

  const { error: consumeError } = await db
    .from("character_dossiers")
    .update({ registered_at: new Date().toISOString() })
    .eq("email", email)
    .eq("registration_token_hash", tokenHash)
    .is("registered_at", null);
  if (consumeError) {
    console.error("[auth/register] Account created, but the character invite could not be marked used:", consumeError.message);
  }

  const { token } = await issueSession("player", player.id, req.headers.get("user-agent") || undefined);
  const res = NextResponse.json({ ok: true, player });
  res.cookies.set(cookieName("player"), token, cookieOptions("player"));
  return res;
}
