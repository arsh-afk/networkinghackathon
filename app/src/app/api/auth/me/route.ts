import { NextRequest, NextResponse } from "next/server";
import { cookieName, cookieOptions, readSessionByToken, revokeSessionByToken } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  const { pin_hash: _pinHash, ...safe } = player as Record<string, unknown> & { pin_hash?: string };
  void _pinHash;
  return NextResponse.json({ ok: true, player: safe });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(cookieName("player"))?.value;
  await revokeSessionByToken("player", token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName("player"), "", { ...cookieOptions("player"), maxAge: 0 });
  return res;
}
