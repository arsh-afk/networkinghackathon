import { NextRequest, NextResponse } from "next/server";
import { isAdminError, parseObjectBody, recordAdminAction, requireAdmin } from "@/lib/admin";
import { hashSecret } from "@/lib/crypto";
import { isValidPin } from "@/lib/validation";

export const dynamic = "force-dynamic";
const ROLES = new Set(["artificer", "broker", "weaver", "patron"]);
const PLAYER_FIELDS = "id,email,display_name,role,badge_code,descriptor,is_active,created_at";

export async function GET(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;

  const search = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const { data, error } = await context.db.from("players").select(PLAYER_FIELDS).order("created_at", { ascending: false }).limit(500);
  if (error) {
    console.error("[admin/players] Roster lookup failed:", error.message);
    return NextResponse.json({ ok: false, code: "PLAYERS_QUERY_FAILED" }, { status: 500 });
  }
  const normalizedSearch = search.toLowerCase();
  const players = (data ?? []).filter((player) => !normalizedSearch || [
    player.display_name, player.badge_code, player.email,
  ].some((value) => String(value ?? "").toLowerCase().includes(normalizedSearch)));
  return NextResponse.json({ ok: true, players }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;
  let body: Record<string, unknown> | null;
  try { body = parseObjectBody(await req.json()); }
  catch { return NextResponse.json({ ok: false, code: "BAD_JSON" }, { status: 400 }); }
  const id = typeof body?.id === "string" ? body.id : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const changes = parseObjectBody(body?.changes);
  if (!id || !changes || !reason || reason.length > 200) {
    return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "Provide a player, change, and reason (up to 200 characters)." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  const displayFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (key === "is_active") {
      if (typeof value !== "boolean") return NextResponse.json({ ok: false, code: "INVALID_INPUT" }, { status: 400 });
      patch.is_active = value;
      displayFields.is_active = value;
    } else if (key === "role") {
      if (typeof value !== "string" || !ROLES.has(value)) return NextResponse.json({ ok: false, code: "INVALID_ROLE" }, { status: 400 });
      patch.role = value;
      displayFields.role = value;
    } else if (key === "badge_code") {
      const badge = typeof value === "string" ? value.replace(/\s/g, "") : "";
      if (!/^\d{6}$/.test(badge)) return NextResponse.json({ ok: false, code: "INVALID_BADGE" }, { status: 400 });
      patch.badge_code = badge;
      displayFields.badge_code = badge;
    } else if (key === "descriptor") {
      if (value !== null && (typeof value !== "string" || value.trim().length > 60)) return NextResponse.json({ ok: false, code: "INVALID_DESCRIPTOR" }, { status: 400 });
      patch.descriptor = typeof value === "string" ? value.trim() || null : null;
      displayFields.descriptor = patch.descriptor;
    } else if (key === "pin") {
      if (typeof value !== "string" || !isValidPin(value)) return NextResponse.json({ ok: false, code: "INVALID_PIN" }, { status: 400 });
      patch.pin_hash = await hashSecret(value);
      displayFields.pinReset = true;
    } else {
      return NextResponse.json({ ok: false, code: "UNSUPPORTED_CHANGE" }, { status: 400 });
    }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, code: "EMPTY_CHANGE" }, { status: 400 });

  const { data: before, error: lookupError } = await context.db.from("players").select(PLAYER_FIELDS).eq("id", id).maybeSingle();
  if (lookupError || !before) {
    if (lookupError) console.error("[admin/players] Could not load player before update:", lookupError.message);
    return NextResponse.json({ ok: false, code: "PLAYER_NOT_FOUND" }, { status: 404 });
  }
  const { data: after, error } = await context.db.from("players").update(patch).eq("id", id).select(PLAYER_FIELDS).single();
  if (error) {
    console.error("[admin/players] Player update failed:", error.message);
    return NextResponse.json({ ok: false, code: "PLAYER_UPDATE_FAILED", message: "The player was not changed. Check for a duplicate badge code." }, { status: 409 });
  }

  const sensitiveChange = "pin_hash" in patch || patch.is_active === false;
  if (sensitiveChange) {
    const { error: revokeError } = await context.db.from("player_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("player_id", id)
      .is("revoked_at", null);
    if (revokeError) {
      console.error("[admin/players] Could not revoke player sessions after account change:", revokeError.message);
      return NextResponse.json({ ok: false, code: "SESSION_REVOCATION_FAILED", message: "Player details changed, but sessions could not be revoked. Review the audit log and retry." }, { status: 500 });
    }
  }

  try {
    await recordAdminAction(context, "admin.player.update", id, before, { ...after, ...displayFields, reason });
  } catch {
    return NextResponse.json({ ok: false, code: "AUDIT_WRITE_FAILED", message: "The player was changed, but the audit record failed. Stop further edits and contact the database administrator." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, player: after });
}
