import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName, readSessionByToken } from "@/lib/session";
import { getServiceSupabase } from "@/lib/db";
import { calculateScores, tierMultiplier, loadScoringConfig, type ScoreScan } from "@/lib/scoring";
import LedgerClient from "./LedgerClient";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) redirect("/login");

  const { pin_hash: _ph, ...safe } = player as Record<string, unknown> & { pin_hash?: string };
  void _ph;

  const db = getServiceSupabase();
  const config = await loadScoringConfig();
  const daysMap: Record<string, Array<{
    id: string;
    base_points: number;
    receiver_name: string;
    receiver_role: string;
    via: string;
    created_at: string;
    tier_mult: number;
    weighted_points: number;
  }>> = {};

  let totalScanPts = 0;
  let totalReceivedPts = 0;
  let taskPts = 0;

  if (db) {
    const { data: myScans, error: myScansError } = await db
      .from("scans")
      .select("id,scanner_id,receiver_id,base_points,game_day,created_at,via,voided_at")
      .eq("scanner_id", player.id as string)
      .order("created_at", { ascending: true });
    if (myScansError) {
      console.error("[ledger] Could not load initiated scans:", myScansError.message);
      throw new Error("Could not load the scoring ledger.");
    }

    const active = (myScans as Array<Record<string, unknown>> ?? []).filter(s => !s.voided_at);
    const receiverIds = [...new Set(active.map(s => s.receiver_id as string))];

    const { data: scoringPlayers, error: rolesError } = receiverIds.length
      ? await db.from("players").select("id,display_name,role").in("id", receiverIds)
      : { data: [], error: null };
    if (rolesError) {
      console.error("[ledger] Could not load receiver details:", rolesError.message);
      throw new Error("Could not load receiver details for the scoring ledger.");
    }
    const receiverNameMap = Object.fromEntries((scoringPlayers ?? []).map((r) => [
      String(r.id),
      { name: String(r.display_name ?? "Agent"), role: String(r.role ?? "unknown") },
    ]));
    const scorePlayerRows = [
      { id: String(player.id), role: String(player.role ?? "artificer") },
      ...(scoringPlayers ?? []).map((row) => ({ id: String(row.id), role: String(row.role) })),
    ];
    const scoreScanRows: ScoreScan[] = active.map((scan) => ({
      id: String(scan.id),
      scanner_id: String(scan.scanner_id),
      receiver_id: String(scan.receiver_id),
      base_points: Number(scan.base_points) || 0,
      game_day: String(scan.game_day ?? "all"),
      created_at: String(scan.created_at ?? ""),
    }));
    const score = calculateScores(scorePlayerRows, scoreScanRows, config).get(String(player.id));
    totalScanPts = score?.scanPoints ?? 0;
    taskPts = score?.taskPoints ?? 0;

    // Group scans by game_day
    for (const scan of active) {
      const day = (scan.game_day as string) || "Today";
      if (!daysMap[day]) daysMap[day] = [];
      const seq = daysMap[day].length + 1;
      const mult = tierMultiplier(seq, config);
      const base = Number(scan.base_points) || 3;
      const weighted = Math.round(base * mult * 100) / 100;
      const rec = receiverNameMap[scan.receiver_id as string] ?? { name: "Agent", role: "unknown" };
      daysMap[day].push({
        id: scan.id as string,
        base_points: base,
        receiver_name: rec.name,
        receiver_role: rec.role,
        via: (scan.via as string) || "qr",
        created_at: scan.created_at as string,
        tier_mult: mult,
        weighted_points: weighted,
      });
    }

    // Received scans
    const { data: received, error: receivedError } = await db
      .from("scans")
      .select("id,game_day,voided_at")
      .eq("receiver_id", player.id as string);
    if (receivedError) {
      console.error("[ledger] Could not load received scans:", receivedError.message);
      throw new Error("Could not load received score history.");
    }
    const activeReceived = (received as Array<Record<string, unknown>> ?? []).filter(s => !s.voided_at);
    const receivesByDay = new Map<string, number>();
    for (const scan of activeReceived) {
      const day = String(scan.game_day ?? "");
      receivesByDay.set(day, (receivesByDay.get(day) ?? 0) + 1);
    }
    totalReceivedPts = [...receivesByDay.values()].reduce((total, count) => total + Math.min(count, config.receive_cap), 0);
  }

  return (
    <LedgerClient
      player={safe}
      daysMap={daysMap}
      totalScanPts={Math.round(totalScanPts * 100) / 100}
      totalReceivedPts={totalReceivedPts}
      taskPts={taskPts}
    />
  );
}
