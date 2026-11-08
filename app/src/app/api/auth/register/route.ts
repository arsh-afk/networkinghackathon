import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/db";
import { hashSecret } from "@/lib/crypto";
import { isAurakEmail, isValidPin, normalizeEmail } from "@/lib/validation";
import { cookieName, cookieOptions, issueSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_NOT_CONFIGURED" }, { status: 503 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, code: "BAD_JSON" }, { status: 400 }); }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const email = normalizeEmail(String(b.email ?? ""));
  const pin = String(b.pin ?? "");
  const displayName = String(b.displayName ?? "").trim().slice(0, 40);
  if (!isAurakEmail(email)) return NextResponse.json({ ok: false, code: "INVALID_EMAIL", message: "Use your @aurak.ac.ae email." }, { status: 400 });
  if (!isValidPin(pin)) return NextResponse.json({ ok: false, code: "INVALID_PIN", message: "PIN must be exactly 6 digits." }, { status: 400 });
  if (displayName.length < 2) return NextResponse.json({ ok: false, code: "INVALID_NAME", message: "Display name required." }, { status: 400 });

  const { data: existing } = await db.from("players").select("id,email").eq("email", email).maybeSingle();
  if (existing) {
    await db.from("auth_conflicts").insert({ email, detail: "Registration attempted for existing email" });
    return NextResponse.json({ ok: false, code: "EMAIL_EXISTS", message: "This email is already registered. Contact game wardens if you need help." }, { status: 409 });
  }

  // Bootstrap registration: assign random role and a temporary badge code; admin/ops can replace later.
  const roles = ["artificer", "broker", "weaver", "patron"] as const;
  const role = roles[Math.floor(Math.random() * roles.length)];
  const badgeCode = String(Math.floor(100000 + Math.random() * 900000));
  const pin_hash = await hashSecret(pin);
  const { data: player, error } = await db.from("players").insert({ email, display_name: displayName, role, badge_code: badgeCode, pin_hash }).select("id,display_name,role,badge_code,email").single();
  if (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
    if (code === "23505") return NextResponse.json({ ok: false, code: "CONFLICT", message: "Registration conflict. Try again." }, { status: 409 });
    return NextResponse.json({ ok: false, code: "DB_ERROR", message: error.message }, { status: 500 });
  }
  const { token } = await issueSession("player", player.id, req.headers.get("user-agent") || undefined);
  const res = NextResponse.json({ ok: true, player });
  res.cookies.set(cookieName("player"), token, cookieOptions("player"));
  return res;
}
