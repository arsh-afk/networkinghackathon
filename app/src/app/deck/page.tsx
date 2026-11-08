import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName, readSessionByToken } from "@/lib/session";
import { getServiceSupabase } from "@/lib/db";
import { gameDayFor, tierMultiplier, DEFAULT_CONFIG } from "@/lib/scoring";
import DeckClient from "./DeckClient";

export const dynamic = "force-dynamic";

export default async function DeckPage() {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) redirect("/login");

  const { pin_hash: _ph, ...safe } = player as Record<string, unknown> & { pin_hash?: string };
  void _ph;

  const db = getServiceSupabase();
  const gameDay = gameDayFor(new Date(), 0, "Asia/Dubai");

  let todayCount = 0;
  let totalPoints = 0;
  let totalConnections = 0;

  if (db) {
    const { data: todayScans } = await db
      .from("scans")
      .select("id,base_points,voided_at")
      .eq("scanner_id", player.id as string)
      .eq("game_day", gameDay);
    const liveToday = ((todayScans as Array<Record<string, unknown>>) ?? []).filter(s => !s.voided_at);
    todayCount = liveToday.length;
    let dayPts = 0;
    liveToday.forEach((s, i) => {
      dayPts += (Number(s.base_points) || 3) * tierMultiplier(i + 1, DEFAULT_CONFIG);
    });
    totalPoints = Math.round(dayPts);
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
