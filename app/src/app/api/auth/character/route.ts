import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/db";
import { normalizeEmail } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "BAD_JSON" }, { status: 400 });
  }
  const token = body && typeof body === "object" && "invite" in body && typeof body.invite === "string"
    ? body.invite
    : "";
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.json({ ok: false, code: "INVALID_INVITE" }, { status: 400 });
  }

  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_NOT_CONFIGURED" }, { status: 503 });

  const tokenHash = `\\x${crypto.createHash("sha256").update(token).digest("hex")}`;
  const { data: invitation, error } = await db
    .from("character_dossiers")
    .select("email,character_data,registration_expires_at,registered_at")
    .eq("registration_token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("[auth/character] Could not look up registration invite:", error.message);
    return NextResponse.json({ ok: false, code: "DB_ERROR" }, { status: 500 });
  }
  if (!invitation) return NextResponse.json({ ok: false, code: "INVALID_INVITE" }, { status: 404 });
  if (invitation.registered_at) {
    return NextResponse.json({ ok: false, code: "INVITE_USED" }, { status: 410 });
  }
  if (!invitation.registration_expires_at || Date.parse(invitation.registration_expires_at) <= Date.now()) {
    return NextResponse.json({ ok: false, code: "INVITE_EXPIRED" }, { status: 410 });
  }

  return NextResponse.json({
    ok: true,
    email: normalizeEmail(invitation.email),
    character: invitation.character_data,
  }, { headers: { "Cache-Control": "no-store" } });
}
