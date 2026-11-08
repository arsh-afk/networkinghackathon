import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName, readSessionByToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);

  if (player) {
    redirect("/deck");
  } else {
    redirect("/login");
  }
}
