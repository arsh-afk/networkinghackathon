import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/db";
import { cookieName, readSessionByToken } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(cookieName("admin"))?.value;
  const admin = await readSessionByToken("admin", token);
  if (!admin) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_NOT_CONFIGURED" }, { status: 503 });
  const { data } = await db.from("auth_conflicts").select("*").order("created_at", { ascending: false }).limit(200);
  return NextResponse.json({ ok: true, conflicts: data ?? [] });
}
