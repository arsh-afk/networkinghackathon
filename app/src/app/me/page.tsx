import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName, readSessionByToken } from "@/lib/session";
import { getServiceSupabase } from "@/lib/db";
import MeClient from "./MeClient";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) redirect("/login");
  const { pin_hash: _ph, ...safe } = player as Record<string, unknown> & { pin_hash?: string };
  void _ph;

  let character: Record<string, unknown> | null = null;
  let characterError = false;
  const db = getServiceSupabase();
  if (db && typeof safe.email === "string") {
    const { data, error } = await db
      .from("character_dossiers")
      .select("character_data")
      .eq("email", safe.email)
      .maybeSingle();
    if (error) {
      console.error("[me] Could not load character dossier:", error.message);
      characterError = true;
    } else {
      character = (data?.character_data as Record<string, unknown> | undefined) ?? null;
    }
  }

  return <MeClient player={safe} character={character} characterError={characterError} />;
}
