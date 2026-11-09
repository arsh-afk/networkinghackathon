import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { cookieName, readSessionByToken } from "@/lib/session";
import { getServiceSupabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });

  let body: { action?: "confirm" | "dispute" };
  try {
    body = await req.json();
  } catch {
    body = { action: "confirm" };
  }

  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_ERROR" }, { status: 503 });

  const { data: challenge } = await db.from("challenges").select("*").eq("id", params.id).maybeSingle();
  if (!challenge) {
    return NextResponse.json({ ok: false, message: "Challenge not found" }, { status: 404 });
  }

  const c = challenge as { challenger_id: string; opponent_id: string; reported_by: string; status: string };
  if (c.challenger_id !== player.id && c.opponent_id !== player.id) {
    return NextResponse.json({ ok: false, message: "Not permitted" }, { status: 403 });
  }

  // Only the peer who did NOT report can confirm or dispute
  if (c.reported_by === player.id) {
    return NextResponse.json({ ok: false, message: "You cannot confirm your own reported result." }, { status: 400 });
  }

  const newStatus = body.action === "dispute" ? "disputed" : "confirmed";
  await db.from("challenges").update({
    status: newStatus,
    confirmed_at: newStatus === "confirmed" ? new Date().toISOString() : null,
  }).eq("id", params.id);

  return NextResponse.json({
    ok: true,
    status: newStatus,
    message: newStatus === "confirmed" ? "Game result confirmed and added to daily standing." : "Challenge marked as disputed. A warden will review.",
  });
}

