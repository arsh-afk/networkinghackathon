import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName, readSessionByToken } from "@/lib/session";
import { getServiceSupabase } from "@/lib/db";
import { gameDayFor } from "@/lib/scoring";
import ContractsClient from "./ContractsClient";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) redirect("/login");

  const { pin_hash: _ph, ...safe } = player as Record<string, unknown> & { pin_hash?: string };
  void _ph;

  const db = getServiceSupabase();
  const gameDay = gameDayFor(new Date(), 0, "Asia/Dubai");

  let dailyScanCount = 0;
  let otherRolesToday = 0;
  let patronScansCount = 0;

  if (db) {
    const { data: scans } = await db
      .from("scans")
      .select("base_points,game_day,receiver_id,voided_at")
      .eq("scanner_id", player.id as string);

    const activeScans = (scans as Array<Record<string, unknown>> ?? []).filter(s => !s.voided_at);
    const todayScans = activeScans.filter(s => s.game_day === gameDay);
    dailyScanCount = todayScans.length;

    // Check distinct receiver roles if available
    const receiverIds = todayScans.map(s => s.receiver_id as string);
    if (receiverIds.length > 0) {
      const { data: receivers } = await db
        .from("players")
        .select("id,role")
        .in("id", receiverIds);

      const rRoles = (receivers as Array<{ id: string; role: string }> ?? []).map(r => r.role.toLowerCase());
      otherRolesToday = new Set(rRoles.filter(r => r !== (player.role as string).toLowerCase())).size;
      patronScansCount = activeScans.length > 0 ? (receivers as Array<{ id: string; role: string }> ?? []).filter(r => r.role.toLowerCase() === "patron").length : 0;
    }
  }

  return (
    <ContractsClient
      player={safe}
      dailyScanCount={dailyScanCount}
      otherRolesToday={otherRolesToday}
      patronScansCount={patronScansCount}
    />
  );
}

