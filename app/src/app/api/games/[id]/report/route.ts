import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { cookieName, readSessionByToken } from "@/lib/session";
import { getServiceSupabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });

  let body: { result?: "win" | "loss" | "draw" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
  }

  if (!body.result || !["win", "loss", "draw"].includes(body.result)) {
    return NextResponse.json({ ok: false, message: "Result must be win, loss, or draw" }, { status: 400 });
  }

  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_ERROR" }, { status: 503 });

  const { data: challenge } = await db.from("challenges").select("*").eq("id", params.id).maybeSingle();
  if (!challenge) {
    return NextResponse.json({ ok: false, message: "Challenge not found" }, { status: 404 });
  }

  const c = challenge as { challenger_id: string; opponent_id: string; status: string };
  if (c.challenger_id !== player.id && c.opponent_id !== player.id) {
    return NextResponse.json({ ok: false, message: "Not permitted" }, { status: 403 });
  }

  const update = {
    status: "reported",
    reported_by: player.id,
    reported_result: body.result,
    reported_at: new Date().toISOString(),
  };

  await db.from("challenges").update(update).eq("id", params.id);
  return NextResponse.json({ ok: true, message: "Result reported. Awaiting peer confirmation." });
}

