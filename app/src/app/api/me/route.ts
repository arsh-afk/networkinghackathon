import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieName, readSessionByToken } from "@/lib/session";
import { getServiceSupabase } from "@/lib/db";
import { gameDayFor, tierMultiplier, DEFAULT_CONFIG, type Role } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });

  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_ERROR" }, { status: 503 });

  const { pin_hash: _, ...safe } = player as Record<string, unknown> & { pin_hash?: string };
  void _;

  const gameDay = gameDayFor(new Date(), 0, "Asia/Dubai");

  // Today's scans as scanner
  const { data: todayScans } = await db
    .from("scans")
    .select("id,base_points,game_day,receiver_id")
    .eq("scanner_id", player.id as string)
    .eq("game_day", gameDay);

  const activeTodayScans = ((todayScans as Array<Record<string, unknown>>) ?? []).filter(
    (s) => !s.voided_at
  );
  const todayCount = activeTodayScans.length;

  // Today's total points (approximate without diversity mult for quick display)
  let todayRawPts = 0;
  activeTodayScans.forEach((s, i) => {
    const mult = tierMultiplier(i + 1, DEFAULT_CONFIG);
    todayRawPts += (Number(s.base_points) || 3) * mult;
  });

  // Current tier
  const currentTier =
    todayCount < DEFAULT_CONFIG.tier1_n ? 1
    : todayCount < DEFAULT_CONFIG.tier2_n ? 2
    : 3;
  const nextTierRung = currentTier === 1 ? DEFAULT_CONFIG.tier1_n + 1 : currentTier === 2 ? DEFAULT_CONFIG.tier2_n + 1 : null;

  // All-time scan points (rough total without diversity)
  const { data: allScans } = await db
    .from("scans")
    .select("id,base_points,game_day,scanner_id,receiver_id,voided_at")
    .eq("scanner_id", player.id as string);

  const liveScans = ((allScans as Array<Record<string, unknown>>) ?? []).filter(s => !s.voided_at);
  
  // Group by day for total scoring
  const byDay = new Map<string, typeof liveScans>();
  for (const s of liveScans) {
    const day = s.game_day as string;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(s);
  }
  
  let totalScanPts = 0;
  for (const dayScansList of byDay.values()) {
    for (let i = 0; i < dayScansList.length; i++) {
      const mult = tierMultiplier(i + 1, DEFAULT_CONFIG);
      totalScanPts += (Number(dayScansList[i].base_points) || 3) * mult;
    }
  }

  // Received points
  const { data: received } = await db
    .from("scans")
    .select("id,game_day,voided_at")
    .eq("receiver_id", player.id as string);
  
  const liveReceived = ((received as Array<Record<string, unknown>>) ?? []).filter(s => !s.voided_at);
  const receivedByDay = new Map<string, number>();
  for (const s of liveReceived) {
    const day = s.game_day as string;
    receivedByDay.set(day, (receivedByDay.get(day) ?? 0) + 1);
  }
  let receivePts = 0;
  for (const count of receivedByDay.values()) {
    receivePts += Math.min(count, DEFAULT_CONFIG.receive_cap);
  }

  const totalPoints = Math.round((totalScanPts + receivePts) * 100) / 100;
  const totalConnections = liveScans.length + liveReceived.length;

  return NextResponse.json({
    ok: true,
    player: {
      ...safe,
      role: safe.role as Role,
    },
    today: {
      scan_count: todayCount,
      current_tier: currentTier,
      next_tier_at_rung: nextTierRung,
      raw_scan_pts: Math.round(todayRawPts * 100) / 100,
      game_day: gameDay,
    },
    totals: {
      scan_pts: Math.round(totalScanPts * 100) / 100,
      receive_pts: receivePts,
      total: totalPoints,
      connections: totalConnections,
    },
  });
}

