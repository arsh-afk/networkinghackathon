import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/db";
import { hashSecret } from "@/lib/crypto";
import { cookieName, readSessionByToken } from "@/lib/session";

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(cookieName("admin"))?.value;
  const admin = await readSessionByToken("admin", token);
  return admin;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_NOT_CONFIGURED" }, { status: 503 });
  const { data } = await db.from("admin_users").select("id,username,display_name,is_active,created_at,last_login_at,created_by").order("created_at", { ascending: true });
  return NextResponse.json({ ok: true, users: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_NOT_CONFIGURED" }, { status: 503 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, code: "BAD_JSON" }, { status: 400 }); }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const username = String(b.username ?? "").trim();
  const password = String(b.password ?? "");
  const display_name = String(b.displayName ?? "").trim() || null;
  if (username.length < 2 || password.length < 8) return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "Username >=2 chars, password >=8 chars." }, { status: 400 });
  const password_hash = await hashSecret(password);
  const { data, error } = await db.from("admin_users").insert({ username, password_hash, display_name, created_by: String((admin as Record<string, unknown>).id) }).select("id,username,display_name,is_active,created_at").single();
  if (error) return NextResponse.json({ ok: false, code: "DB_ERROR", message: error.message }, { status: 400 });
  await db.from("audit_log").insert({ actor_type: "admin", actor_id: String((admin as Record<string, unknown>).id), action: "admin.create_user", target: data.id, after: { username } });
  return NextResponse.json({ ok: true, user: data }, { status: 201 });
}
