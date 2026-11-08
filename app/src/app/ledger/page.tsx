import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName, readSessionByToken } from "@/lib/session";
import { getServiceSupabase } from "@/lib/db";
import { tierMultiplier, DEFAULT_CONFIG } from "@/lib/scoring";
import LedgerClient from "./LedgerClient";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) redirect("/login");

  const { pin_hash: _ph, ...safe } = player as Record<string, unknown> & { pin_hash?: string };
  void _ph;

  const db = getServiceSupabase();
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

  if (db) {
    const { data: myScans } = await db
      .from("scans")
      .select("id,base_points,game_day,created_at,via,receiver_id,voided_at")
      .eq("scanner_id", player.id as string)
      .order("created_at", { ascending: true });

    const active = (myScans as Array<Record<string, unknown>> ?? []).filter(s => !s.voided_at);
    const receiverIds = [...new Set(active.map(s => s.receiver_id as string))];

    let receiverNameMap: Record<string, { name: string; role: string }> = {};
    if (receiverIds.length > 0) {
      const { data: rPlayers } = await db.from("players").select("id,display_name,role").in("id", receiverIds);
      receiverNameMap = Object.fromEntries(
        (rPlayers as Array<{ id: string; display_name: string; role: string }> ?? []).map(r => [
          r.id,
          { name: r.display_name, role: r.role },
        ])
      );
    }

    // Group scans by game_day
    for (const scan of active) {
      const day = (scan.game_day as string) || "Today";
      if (!daysMap[day]) daysMap[day] = [];
      const seq = daysMap[day].length + 1;
      const mult = tierMultiplier(seq, DEFAULT_CONFIG);
      const base = Number(scan.base_points) || 3;
      const weighted = Math.round(base * mult * 100) / 100;
      totalScanPts += weighted;

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
    const { data: received } = await db
      .from("scans")
      .select("id,game_day,voided_at")
      .eq("receiver_id", player.id as string);
    const activeReceived = (received as Array<Record<string, unknown>> ?? []).filter(s => !s.voided_at);
    totalReceivedPts = Math.min(activeReceived.length, 56); // approx weekly cap
  }

  return (
    <LedgerClient
      player={safe}
      daysMap={daysMap}
      totalScanPts={Math.round(totalScanPts * 100) / 100}
      totalReceivedPts={totalReceivedPts}
    />
  );
}

