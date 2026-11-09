import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/db";
import { calculateScores, loadScoringConfig, type ScoreScan } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getServiceSupabase();
  if (!db) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }
  const config = await loadScoringConfig();

  // Fetch all active players
  const { data: playersData, error: playersError } = await db
    .from("players")
    .select("id,display_name,role,badge_code,is_active");
  if (playersError) {
    console.error("[arena] Could not load players:", playersError.message);
    return NextResponse.json({ ok: false, error: "Could not load arena players." }, { status: 500 });
  }
  const players = (playersData as Array<Record<string, unknown>> ?? []).filter(p => p.is_active);

  // Fetch all live scans
  const { data: scansData, error: scansError } = await db
    .from("scans")
    .select("id,scanner_id,receiver_id,base_points,game_day,created_at,voided_at");
  if (scansError) {
    console.error("[arena] Could not load scans:", scansError.message);
    return NextResponse.json({ ok: false, error: "Could not load arena scores." }, { status: 500 });
  }
  const allScans = (scansData as Array<Record<string, unknown>> ?? []);
  const liveScans = allScans.filter(s => !s.voided_at);

  const scoreScanRows: ScoreScan[] = liveScans.map((scan) => ({
    id: String(scan.id),
    scanner_id: String(scan.scanner_id),
    receiver_id: String(scan.receiver_id),
    base_points: Number(scan.base_points) || 0,
    game_day: String(scan.game_day ?? "all"),
    created_at: String(scan.created_at ?? ""),
  }));
  const scores = calculateScores(
    players.map((player) => ({ id: String(player.id), role: String(player.role ?? "artificer") })),
    scoreScanRows,
    config,
  );
  const playerScores: Record<string, { id: string; name: string; role: string; score: number; scans: number }> = {};
  for (const p of players) {
    const computed = scores.get(String(p.id));
    playerScores[p.id as string] = {
      id: p.id as string,
      name: (p.display_name as string) || "Agent",
      role: (p.role as string) || "artificer",
      score: computed?.total ?? 0,
      scans: computed?.scans ?? 0,
    };
  }

  // Sort players by score descending
  const sorted = Object.values(playerScores)
    .map(p => ({ ...p, score: Math.round(p.score * 100) / 100 }))
    .sort((a, b) => b.score - a.score);

  const top10 = sorted.slice(0, 10).map((p, idx) => ({
    rank: idx + 1,
    ...p,
  }));

  // Faction breakdown totals
  const factionTotals: Record<string, number> = {
    artificer: 0,
    broker: 0,
    weaver: 0,
    patron: 0,
  };
  for (const p of sorted) {
    const f = p.role.toLowerCase();
    if (factionTotals[f] !== undefined) {
      factionTotals[f] += p.score;
    }
  }

  // Overall event stats
  const totalMarks = liveScans.length;
  // Unique pairs
  const uniquePairs = new Set(
    liveScans.map(s => [s.scanner_id, s.receiver_id].sort().join(":"))
  ).size;

  return NextResponse.json({
    ok: true,
    top10,
    stats: {
      totalMarks,
      uniqueConnections: uniquePairs,
      activeAgents: players.length,
    },
    factionTotals: {
      artificer: Math.round(factionTotals.artificer),
      broker: Math.round(factionTotals.broker),
      weaver: Math.round(factionTotals.weaver),
      patron: Math.round(factionTotals.patron),
    },
    updatedAt: new Date().toISOString(),
  });
}
