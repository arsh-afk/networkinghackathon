import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieName, readSessionByToken } from "@/lib/session";
import { getServiceSupabase } from "@/lib/db";
import { calculateScores, gameDayFor, loadScoringConfig, type ScoreScan } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });

  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_ERROR" }, { status: 503 });
  const config = await loadScoringConfig();
  const gameDay = gameDayFor(new Date(), config.day_rollover_h, config.tz);
  const playerId = String(player.id);

  const { data: rawScans, error: scansError } = await db.from("scans")
    .select("id,scanner_id,receiver_id,base_points,game_day,created_at,voided_at")
    .or(`scanner_id.eq.${playerId},receiver_id.eq.${playerId}`)
    .order("created_at", { ascending: true })
    .range(0, 9999);
  if (scansError) {
    console.error("[me] Could not load player score history:", scansError.message);
    return NextResponse.json({ ok: false, code: "SCORE_QUERY_FAILED" }, { status: 500 });
  }
  const rows = rawScans as Array<Record<string, unknown>> ?? [];
  const relatedIds = [...new Set(rows.flatMap((scan) => [String(scan.scanner_id), String(scan.receiver_id)]))];
  const { data: relatedPlayers, error: playersError } = relatedIds.length
    ? await db.from("players").select("id,role").in("id", relatedIds)
    : { data: [], error: null };
  if (playersError) {
    console.error("[me] Could not load score role data:", playersError.message);
    return NextResponse.json({ ok: false, code: "SCORE_QUERY_FAILED" }, { status: 500 });
  }
  const scorePlayers = (relatedPlayers ?? []).map((row) => ({ id: String(row.id), role: String(row.role) }));
  const scoreScans: ScoreScan[] = rows.map((scan) => ({
    id: String(scan.id),
    scanner_id: String(scan.scanner_id),
    receiver_id: String(scan.receiver_id),
    base_points: Number(scan.base_points) || 0,
    game_day: String(scan.game_day ?? "all"),
    created_at: String(scan.created_at ?? ""),
    voided_at: typeof scan.voided_at === "string" ? scan.voided_at : null,
  }));
  const scores = calculateScores(scorePlayers, scoreScans, config);
  const score = scores.get(playerId) ?? { scanPoints: 0, receivePoints: 0, taskPoints: 0, total: 0, scans: 0 };
  const todayScans = scoreScans.filter((scan) => scan.scanner_id === playerId && scan.game_day === gameDay && !scan.voided_at);
  const todayScores = calculateScores(scorePlayers, todayScans, config).get(playerId);
  const currentTier = todayScans.length < config.tier1_n ? 1 : todayScans.length < config.tier2_n ? 2 : 3;
  const nextTierRung = currentTier === 1 ? config.tier1_n + 1 : currentTier === 2 ? config.tier2_n + 1 : null;

  const { pin_hash: _pinHash, ...safePlayer } = player as Record<string, unknown> & { pin_hash?: string };
  void _pinHash;
  return NextResponse.json({
    ok: true,
    player: safePlayer,
    today: {
      scan_count: todayScans.length,
      current_tier: currentTier,
      next_tier_at_rung: nextTierRung,
      raw_scan_pts: todayScores?.scanPoints ?? 0,
      game_day: gameDay,
    },
    totals: {
      scan_pts: score.scanPoints,
      receive_pts: score.receivePoints,
      task_pts: score.taskPoints,
      total: score.total,
      connections: scoreScans.filter((scan) => !scan.voided_at && (scan.scanner_id === playerId || scan.receiver_id === playerId)).length,
    },
  });
}
