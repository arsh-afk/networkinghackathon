import { NextRequest, NextResponse } from "next/server";
import { isAdminError, parseObjectBody, recordAdminAction, requireAdmin } from "@/lib/admin";
import { hashSecret } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;
  const { data, error } = await context.db.from("admin_users").select("id,username,display_name,is_active,created_at,last_login_at,created_by").order("created_at", { ascending: true });
  if (error) {
    console.error("[admin/users] Could not load admin accounts:", error.message);
    return NextResponse.json({ ok: false, code: "ADMINS_QUERY_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, users: data ?? [] });
}

export async function POST(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;
  let b: Record<string, unknown> | null;
  try { b = parseObjectBody(await req.json()); } catch { return NextResponse.json({ ok: false, code: "BAD_JSON" }, { status: 400 }); }
  if (!b) return NextResponse.json({ ok: false, code: "BAD_JSON" }, { status: 400 });
  const username = String(b.username ?? "").trim();
  const password = String(b.password ?? "");
  const display_name = String(b.displayName ?? "").trim() || null;
  if (username.length < 2 || password.length < 8) return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "Username >=2 chars, password >=8 chars." }, { status: 400 });
  const password_hash = await hashSecret(password);
  const { data, error } = await context.db.from("admin_users").insert({ username, password_hash, display_name, created_by: String(context.admin.id) }).select("id,username,display_name,is_active,created_at").single();
  if (error) {
    console.error("[admin/users] Admin account creation failed:", error.message);
    return NextResponse.json({ ok: false, code: "ADMIN_CREATE_FAILED" }, { status: 400 });
  }
  try { await recordAdminAction(context, "admin.create_user", String(data.id), null, { username, display_name }); }
  catch { return NextResponse.json({ ok: false, code: "AUDIT_WRITE_FAILED", message: "The admin account was created but the audit record failed." }, { status: 500 }); }
  return NextResponse.json({ ok: true, user: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;
  let body: Record<string, unknown> | null;
  try { body = parseObjectBody(await req.json()); }
  catch { return NextResponse.json({ ok: false, code: "BAD_JSON" }, { status: 400 }); }
  const id = typeof body?.id === "string" ? body.id : "";
  const active = body?.isActive;
  if (!id || typeof active !== "boolean") return NextResponse.json({ ok: false, code: "INVALID_INPUT" }, { status: 400 });
  if (id === String(context.admin.id) && !active) return NextResponse.json({ ok: false, code: "CANNOT_DISABLE_SELF" }, { status: 400 });

  const { data: before, error: lookupError } = await context.db.from("admin_users").select("id,username,display_name,is_active").eq("id", id).maybeSingle();
  if (lookupError || !before) return NextResponse.json({ ok: false, code: "ADMIN_NOT_FOUND" }, { status: 404 });
  const { data, error } = await context.db.from("admin_users").update({ is_active: active }).eq("id", id).select("id,username,display_name,is_active").single();
  if (error) {
    console.error("[admin/users] Admin account update failed:", error.message);
    return NextResponse.json({ ok: false, code: "ADMIN_UPDATE_FAILED" }, { status: 500 });
  }
  if (!active) {
    const { error: revokeError } = await context.db.from("admin_sessions").update({ revoked_at: new Date().toISOString() }).eq("admin_id", id).is("revoked_at", null);
    if (revokeError) {
      console.error("[admin/users] Could not revoke disabled admin sessions:", revokeError.message);
      return NextResponse.json({ ok: false, code: "SESSION_REVOCATION_FAILED" }, { status: 500 });
    }
  }
  try { await recordAdminAction(context, "admin.user.status", id, before, data); }
  catch { return NextResponse.json({ ok: false, code: "AUDIT_WRITE_FAILED" }, { status: 500 }); }
  return NextResponse.json({ ok: true, user: data });
}
