import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { cookieName, readSessionByToken } from "@/lib/session";
import { getServiceSupabase, devNoDbEnabled } from "@/lib/db";
import { gameDayFor } from "@/lib/scoring";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });

  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_ERROR" }, { status: 503 });

  const pId = player.id as string;
  let challenges: Array<Record<string, unknown>> = [];

  if (devNoDbEnabled()) {
    const { data: all } = await db.from("challenges").select("*");
    challenges = ((all as Array<Record<string, unknown>>) ?? []).filter(
      (c) => c.challenger_id === pId || c.opponent_id === pId
    );
  } else {
    const { data } = await db
      .from("challenges")
      .select("*")
      .or(`challenger_id.eq.${pId},opponent_id.eq.${pId}`)
      .order("created_at", { ascending: false });
    challenges = (data as Array<Record<string, unknown>>) ?? [];
  }

  // Fetch names of opponents
  const otherIds = [
    ...new Set(challenges.map((c) => (c.challenger_id === pId ? (c.opponent_id as string) : (c.challenger_id as string)))),
  ];

  let nameMap: Record<string, { name: string; role: string }> = {};
  if (otherIds.length > 0) {
    const { data: players } = await db.from("players").select("id,display_name,role").in("id", otherIds);
    nameMap = Object.fromEntries(
      (players as Array<{ id: string; display_name: string; role: string }> ?? []).map((p) => [
        p.id,
        { name: p.display_name, role: p.role },
      ])
    );
  }

  const enriched = challenges.map((c) => {
    const isChallenger = c.challenger_id === pId;
    const peerId = isChallenger ? (c.opponent_id as string) : (c.challenger_id as string);
    const peer = nameMap[peerId] ?? { name: "Agent", role: "artificer" };
    return {
      ...c,
      isChallenger,
      peerName: peer.name,
      peerRole: peer.role,
    };
  });

  return NextResponse.json({ ok: true, challenges: enriched });
}

export async function POST(req: NextRequest) {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });

  let body: { badgeCode?: string; opponentId?: string; game?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_ERROR" }, { status: 503 });

  let opponentId = body.opponentId;
  if (!opponentId && body.badgeCode) {
    const code = body.badgeCode.replace(/\s/g, "");
    const { data: opp } = await db.from("players").select("id").eq("badge_code", code).maybeSingle();
    if (!opp) {
      return NextResponse.json({ ok: false, message: "No participant found with this badge code." }, { status: 404 });
    }
    opponentId = (opp as { id: string }).id;
  }

  if (!opponentId || opponentId === player.id) {
    return NextResponse.json({ ok: false, message: "You cannot challenge yourself." }, { status: 400 });
  }

  const game = ["ttt", "c4", "rps", "other"].includes(body.game ?? "") ? body.game : "rps";
  const gameDay = gameDayFor(new Date(), 0, "Asia/Dubai");

  const challengeId = crypto.randomUUID();
  const newRow = {
    id: challengeId,
    challenger_id: player.id,
    opponent_id: opponentId,
    game,
    status: "sent",
    game_day: gameDay,
    created_at: new Date().toISOString(),
  };

  const { error } = await db.from("challenges").insert(newRow);
  if (error) {
    return NextResponse.json({ ok: false, message: "Could not create challenge." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, challenge_id: challengeId });
}

