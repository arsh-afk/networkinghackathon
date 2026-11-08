import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/db";
import { tierMultiplier, DEFAULT_CONFIG } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getServiceSupabase();
  if (!db) {
    return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 503 });
  }

  // Fetch all active players
  const { data: playersData } = await db
    .from("players")
    .select("id,display_name,role,badge_code,is_active");
  const players = (playersData as Array<Record<string, unknown>> ?? []).filter(p => p.is_active);

  // Fetch all live scans
  const { data: scansData } = await db
    .from("scans")
    .select("id,scanner_id,receiver_id,base_points,game_day,voided_at");
  const liveScans = (scansData as Array<Record<string, unknown>> ?? []).filter(s => !s.voided_at);

  // Compute scores per player
  const playerScores: Record<string, { id: string; name: string; role: string; score: number; scans: number }> = {};
  for (const p of players) {
    playerScores[p.id as string] = {
      id: p.id as string,
      name: (p.display_name as string) || "Agent",
      role: (p.role as string) || "artificer",
      score: 0,
      scans: 0,
    };
  }

  // Group scans by scanner & day for diminishing returns
  const scannerDays: Record<string, Record<string, number>> = {};
  for (const s of liveScans) {
    const sId = s.scanner_id as string;
    const day = (s.game_day as string) || "all";
    if (!scannerDays[sId]) scannerDays[sId] = {};
    const seq = (scannerDays[sId][day] ?? 0) + 1;
    scannerDays[sId][day] = seq;

    const mult = tierMultiplier(seq, DEFAULT_CONFIG);
    const pts = (Number(s.base_points) || 3) * mult;

    if (playerScores[sId]) {
      playerScores[sId].score += pts;
      playerScores[sId].scans += 1;
    }

    // Receiver gets +1 (subject to 8/day cap)
    const rId = s.receiver_id as string;
    if (playerScores[rId]) {
      playerScores[rId].score += 1;
    }
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

