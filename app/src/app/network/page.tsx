import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName, readSessionByToken } from "@/lib/session";
import NetworkClient from "./NetworkClient";
import { getServiceSupabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) redirect("/login");

  const db = getServiceSupabase();
  let connections: Array<{ id: string; display_name: string; role: string; badge_code: string; descriptor?: string }> = [];

  if (db) {
    // Get all scans involving this player
    const { data: scanData } = await db
      .from("scans")
      .select("scanner_id,receiver_id,game_day")
      .or(`scanner_id.eq.${player.id as string},receiver_id.eq.${player.id as string}`);

    const rows = (scanData as Array<Record<string, unknown>> ?? []).filter(s => !s.voided_at);
    const peerIds = [...new Set(rows.map(s =>
      s.scanner_id === player.id ? s.receiver_id as string : s.scanner_id as string
    ))];

    if (peerIds.length > 0) {
      const { data: peers } = await db
        .from("players")
        .select("id,display_name,role,badge_code,descriptor")
        .in("id", peerIds);
      connections = (peers as typeof connections ?? []);
    }
  }

  return <NetworkClient connections={connections} />;
}

