import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/db";
import { hashSecret, verifySecret } from "@/lib/crypto";
import { cookieName, cookieOptions, issueSession, revokeSessionByToken } from "@/lib/session";

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

  const { count, error: countError } = await db.from("admin_users").select("id", { count: "exact", head: true });
  if (countError) {
    console.error("[admin/login] Could not query admin users:", countError.message);
    return NextResponse.json({ ok: false, code: "ADMIN_DB_NOT_READY" }, { status: 503 });
  }
  if ((count ?? 0) === 0) {
    const bu = process.env.ADMIN_BOOTSTRAP_USERNAME || "Arsh";
    const bp = process.env.ADMIN_BOOTSTRAP_PASSWORD || "";
    if (username !== bu || !bp || password !== bp) return unauthorized();
    const password_hash = await hashSecret(password);
    const { data: admin, error } = await db.from("admin_users").insert({ username: bu, password_hash, display_name: "Arsh (bootstrap)" }).select("id,username,display_name").single();
    if (error) return NextResponse.json({ ok: false, code: "DB_ERROR", message: error.message }, { status: 500 });
    const { error: auditError } = await db.from("audit_log").insert({ actor_type: "system", action: "admin.bootstrap", target: admin.id });
    if (auditError) {
      console.error("[admin/login] Bootstrap account was created but its audit record failed:", auditError.message);
      return NextResponse.json({ ok: false, code: "AUDIT_WRITE_FAILED", message: "The administrator was created but could not be signed in because its audit record failed." }, { status: 503 });
    }
    const { token } = await issueSession("admin", admin.id, req.headers.get("user-agent") || undefined);
    const res = NextResponse.json({ ok: true, admin });
    res.cookies.set(cookieName("admin"), token, cookieOptions("admin"));
    return res;
  }

  const { data: admin, error: adminError } = await db.from("admin_users").select("id,username,display_name,password_hash,is_active").eq("username", username).maybeSingle();
  if (adminError) {
    console.error("[admin/login] Could not query administrator credentials:", adminError.message);
    return NextResponse.json({ ok: false, code: "ADMIN_DB_QUERY_FAILED", message: "Administrator sign-in is temporarily unavailable." }, { status: 503 });
  }
  if (!admin || admin.is_active === false) return unauthorized();
  const ok = await verifySecret(password, admin.password_hash);
  if (!ok) return unauthorized();
  const { error: lastLoginError } = await db.from("admin_users").update({ last_login_at: new Date().toISOString() }).eq("id", admin.id);
  if (lastLoginError) {
    console.error("[admin/login] Could not update last login:", lastLoginError.message);
    return NextResponse.json({ ok: false, code: "ADMIN_DB_UPDATE_FAILED", message: "Administrator sign-in is temporarily unavailable." }, { status: 503 });
  }
  const { error: auditError } = await db.from("audit_log").insert({
    actor_type: "admin",
    actor_id: admin.id,
    action: "admin.login",
    target: admin.id,
  });
  if (auditError) {
    console.error("[admin/login] Could not record administrator sign-in:", auditError.message);
    return NextResponse.json({ ok: false, code: "AUDIT_WRITE_FAILED", message: "Sign-in was blocked because its audit record could not be written." }, { status: 503 });
  }
  const { password_hash: _pw, ...safe } = admin;
  void _pw;
  const { token } = await issueSession("admin", admin.id, req.headers.get("user-agent") || undefined);
  const res = NextResponse.json({ ok: true, admin: safe });
  res.cookies.set(cookieName("admin"), token, cookieOptions("admin"));
  return res;
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(cookieName("admin"))?.value;
  await revokeSessionByToken("admin", token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName("admin"), "", { ...cookieOptions("admin"), maxAge: 0 });
  return response;
}
