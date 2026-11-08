import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/db";
import { verifySecret } from "@/lib/crypto";
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
  if (!isAurakEmail(email) || !isValidPin(pin)) return NextResponse.json({ ok: false, code: "INVALID_CREDENTIALS", message: "Check your AURAK email and 6-digit PIN." }, { status: 400 });

  const { data: player } = await db.from("players").select("id,pin_hash,display_name,role,badge_code,email,is_active").eq("email", email).maybeSingle();
  if (!player || player.is_active === false) {
    await db.from("auth_conflicts").insert({ email, detail: "Login failed: account not found or inactive" });
    return NextResponse.json({ ok: false, code: "INVALID_CREDENTIALS", message: "Could not sign in. Contact game wardens if needed." }, { status: 401 });
  }
  const ok = await verifySecret(pin, player.pin_hash);
  if (!ok) return NextResponse.json({ ok: false, code: "INVALID_CREDENTIALS", message: "Could not sign in. Contact game wardens if needed." }, { status: 401 });

  // Single active session behavior simplified for scaffold: issue new session (old sessions naturally expire/revocable in admin tools later).
  const { token } = await issueSession("player", player.id, req.headers.get("user-agent") || undefined);
  const { pin_hash: _pinHash, ...safe } = player;
  void _pinHash;
  const res = NextResponse.json({ ok: true, player: safe });
  res.cookies.set(cookieName("player"), token, cookieOptions("player"));
  return res;
}
