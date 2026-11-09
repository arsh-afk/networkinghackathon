import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName, readSessionByToken } from "@/lib/session";
import { getServiceSupabase } from "@/lib/db";
import { calculateScores, gameDayFor, loadScoringConfig, type ScoreScan } from "@/lib/scoring";
import DeckClient from "./DeckClient";

export const dynamic = "force-dynamic";

export default async function DeckPage() {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) redirect("/login");

  const { pin_hash: _ph, ...safe } = player as Record<string, unknown> & { pin_hash?: string };
  void _ph;

  const db = getServiceSupabase();
  const config = await loadScoringConfig();
  const gameDay = gameDayFor(new Date(), config.day_rollover_h, config.tz);

  let todayCount = 0;
  let totalPoints = 0;
  let totalConnections = 0;

  if (db) {
    const { data: todayScans, error: scansError } = await db
      .from("scans")
      .select("id,scanner_id,receiver_id,base_points,game_day,created_at,voided_at")
      .eq("scanner_id", player.id as string)
      .eq("game_day", gameDay)
      .order("created_at", { ascending: true });
    if (scansError) throw new Error(`Could not load today's scores: ${scansError.message}`);
    const liveToday = ((todayScans as Array<Record<string, unknown>>) ?? []).filter(s => !s.voided_at);
    todayCount = liveToday.length;
    const receiverIds = [...new Set(liveToday.map((scan) => String(scan.receiver_id)))];
    const { data: receiverRows, error: rolesError } = receiverIds.length
      ? await db.from("players").select("id,role").in("id", receiverIds)
      : { data: [], error: null };
    if (rolesError) throw new Error(`Could not load scoring roles: ${rolesError.message}`);
    const scorePlayers = [
      { id: String(player.id), role: String(player.role ?? "artificer") },
      ...(receiverRows ?? []).map((row) => ({ id: String(row.id), role: String(row.role) })),
    ];
    const scoreScans: ScoreScan[] = liveToday.map((scan) => ({
      id: String(scan.id),
      scanner_id: String(scan.scanner_id),
      receiver_id: String(scan.receiver_id),
      base_points: Number(scan.base_points) || 0,
      game_day: String(scan.game_day ?? gameDay),
      created_at: String(scan.created_at ?? ""),
    }));
    totalPoints = Math.round((calculateScores(scorePlayers, scoreScans, config).get(String(player.id))?.total ?? 0) * 100) / 100;
    totalConnections = todayCount;
  }

  return (
    <DeckClient
      player={safe}
      todayCount={todayCount}
      totalPoints={totalPoints}
      totalConnections={totalConnections}
      gameDay={gameDay}
    />
  );
}
