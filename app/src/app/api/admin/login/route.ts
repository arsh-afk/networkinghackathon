import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/db";
import { hashSecret, verifySecret } from "@/lib/crypto";
import { cookieName, cookieOptions, issueSession } from "@/lib/session";

function unauthorized() { return NextResponse.json({ ok: false, code: "INVALID_CREDENTIALS" }, { status: 401 }); }

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_NOT_CONFIGURED" }, { status: 503 });
  const portalSecret = process.env.ADMIN_PORTAL_SECRET_PATH || "";
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, code: "BAD_JSON" }, { status: 400 }); }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (!portalSecret || String(b.portalSecret ?? "") !== portalSecret) return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 404 });
  const username = String(b.username ?? "").trim();
  const password = String(b.password ?? "");
  if (!username || !password) return unauthorized();

  const { count } = await db.from("admin_users").select("id", { count: "exact", head: true });
  if ((count ?? 0) === 0) {
    const bu = process.env.ADMIN_BOOTSTRAP_USERNAME || "Arsh";
    const bp = process.env.ADMIN_BOOTSTRAP_PASSWORD || "";
    if (username !== bu || !bp || password !== bp) return unauthorized();
    const password_hash = await hashSecret(password);
    const { data: admin, error } = await db.from("admin_users").insert({ username: bu, password_hash, display_name: "Arsh (bootstrap)" }).select("id,username,display_name").single();
    if (error) return NextResponse.json({ ok: false, code: "DB_ERROR", message: error.message }, { status: 500 });
    await db.from("audit_log").insert({ actor_type: "system", action: "admin.bootstrap", target: admin.id });
    const { token } = await issueSession("admin", admin.id, req.headers.get("user-agent") || undefined);
    const res = NextResponse.json({ ok: true, admin });
    res.cookies.set(cookieName("admin"), token, cookieOptions("admin"));
    return res;
  }

  const { data: admin } = await db.from("admin_users").select("id,username,display_name,password_hash,is_active").eq("username", username).maybeSingle();
  if (!admin || admin.is_active === false) return unauthorized();
  const ok = await verifySecret(password, admin.password_hash);
  if (!ok) return unauthorized();
  await db.from("admin_users").update({ last_login_at: new Date().toISOString() }).eq("id", admin.id);
  const { password_hash: _pw, ...safe } = admin;
  void _pw;
  const { token } = await issueSession("admin", admin.id, req.headers.get("user-agent") || undefined);
  const res = NextResponse.json({ ok: true, admin: safe });
  res.cookies.set(cookieName("admin"), token, cookieOptions("admin"));
  return res;
}
