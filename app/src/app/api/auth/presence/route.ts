import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookieName } from "@/lib/session";
import { getServiceSupabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(cookieName("player"))?.value;
  if (!token) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });

  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_NOT_CONFIGURED" }, { status: 503 });

  const tokenHash = `\\x${crypto.createHash("sha256").update(token).digest("hex")}`;
  const now = new Date();
  const throttleBefore = new Date(now.getTime() - 60_000).toISOString();
  const { error } = await db
    .from("player_sessions")
    .update({ last_seen_at: now.toISOString() })
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", now.toISOString())
    .lt("last_seen_at", throttleBefore);

  if (error) {
    console.error("[auth/presence] Could not update player heartbeat:", error.message);
    return NextResponse.json({ ok: false, code: "DB_ERROR" }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
