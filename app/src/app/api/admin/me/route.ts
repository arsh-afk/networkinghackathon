import { NextRequest, NextResponse } from "next/server";
import { cookieName, cookieOptions, readSessionByToken } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(cookieName("admin"))?.value;
  const admin = await readSessionByToken("admin", token);
  if (!admin) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  const { password_hash: _pw, ...safe } = admin as Record<string, unknown> & { password_hash?: string };
  void _pw;
  return NextResponse.json({ ok: true, admin: safe });
}

export async function POST(req: NextRequest) {
  // logout
  const { revokeSessionByToken } = await import("@/lib/session");
  const token = req.cookies.get(cookieName("admin"))?.value;
  await revokeSessionByToken("admin", token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName("admin"), "", { ...cookieOptions("admin"), maxAge: 0 });
  return res;
}
