import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName, readSessionByToken } from "@/lib/session";
import WelcomeClient from "./WelcomeClient";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) redirect("/login");

  const { pin_hash: _ph, ...safe } = player as Record<string, unknown> & { pin_hash?: string };
  void _ph;

  return <WelcomeClient player={safe} />;
}

