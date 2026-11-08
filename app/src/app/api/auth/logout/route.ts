import { NextRequest, NextResponse } from "next/server";
import { cookieName, cookieOptions, revokeSessionByToken } from "@/lib/session";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(cookieName("player"))?.value;
  await revokeSessionByToken("player", token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName("player"), "", { ...cookieOptions("player"), maxAge: 0 });
  return res;
}
