import { NextRequest, NextResponse } from "next/server";
import { isAdminError, parseObjectBody, recordAdminAction, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;
  const [reports, submissions, conflicts, challenges, scans] = await Promise.all([
    context.db.from("reports").select("id,reporter_id,reported_id,note,game_day,status,reviewed_by,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(200),
    context.db.from("linkedin_submissions").select("id,player_id,task,proof_url,description,status,game_day,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(200),
    context.db.from("auth_conflicts").select("id,email,badge_code,detail,status,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(200),
    context.db.from("challenges").select("id,challenger_id,opponent_id,game,status,reported_result,reported_by,reported_at,created_at").in("status", ["sent", "reported", "disputed"]).order("created_at", { ascending: false }).limit(200),
    context.db.from("scans").select("id,scanner_id,receiver_id,base_points,game_day,created_at,via").is("voided_at", null).order("created_at", { ascending: false }).limit(100),
  ]);
  const results = [reports, submissions, conflicts, challenges, scans];
  const failure = results.find((result) => result.error);
  if (failure?.error) {
    console.error("[admin/reviews] Could not load review queues:", failure.error.message);
    return NextResponse.json({ ok: false, code: "REVIEWS_QUERY_FAILED" }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    reports: reports.data ?? [],
    submissions: submissions.data ?? [],
    conflicts: conflicts.data ?? [],
    challenges: challenges.data ?? [],
    scans: scans.data ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;
  let body: Record<string, unknown> | null;
  try { body = parseObjectBody(await req.json()); }
  catch { return NextResponse.json({ ok: false, code: "BAD_JSON" }, { status: 400 }); }
  const type = typeof body?.type === "string" ? body.type : "";
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!id || !reason || reason.length > 280) {
    return NextResponse.json({ ok: false, code: "INVALID_INPUT", message: "An item id and moderation reason (up to 280 characters) are required." }, { status: 400 });
  }

  const now = new Date().toISOString();
  let table: string;
  let patch: Record<string, unknown>;
  let action: string;
  let allowedStatuses: string[];
  if (type === "report" || type === "submission" || type === "conflict") {
    if (!["approved", "rejected"].includes(status)) return NextResponse.json({ ok: false, code: "INVALID_STATUS" }, { status: 400 });
    table = type === "report" ? "reports" : type === "submission" ? "linkedin_submissions" : "auth_conflicts";
    patch = type === "conflict"
      ? { status, resolved_by: String(context.admin.id), resolved_at: now }
      : { status, reviewed_by: String(context.admin.id), reviewed_at: now };
    action = `admin.${type}.${status}`;
    allowedStatuses = ["pending"];
  } else if (type === "challenge") {
    if (status !== "cancelled") return NextResponse.json({ ok: false, code: "INVALID_STATUS", message: "Warden moderation can cancel a challenge; player confirmations must use the peer-confirmation flow." }, { status: 400 });
    table = "challenges";
    patch = { status };
    action = "admin.challenge.cancel";
    allowedStatuses = ["sent", "reported", "disputed"];
  } else if (type === "scan") {
    if (status !== "voided") return NextResponse.json({ ok: false, code: "INVALID_STATUS" }, { status: 400 });
    const { data: before, error: lookupError } = await context.db.from("scans").select("id,scanner_id,receiver_id,base_points,game_day,created_at,via,voided_at").eq("id", id).maybeSingle();
    if (lookupError || !before) return NextResponse.json({ ok: false, code: "SCAN_NOT_FOUND" }, { status: 404 });
    if (before.voided_at) return NextResponse.json({ ok: false, code: "ALREADY_VOIDED" }, { status: 409 });
    const { data, error } = await context.db.from("scans").update({
      voided_at: now,
      voided_by: String(context.admin.id),
      void_reason: reason,
    }).eq("id", id).is("voided_at", null).select("id,voided_at,void_reason").maybeSingle();
    if (error || !data) {
      if (error) console.error("[admin/reviews] Scan void failed:", error.message);
      return NextResponse.json({ ok: false, code: "SCAN_UPDATE_FAILED" }, { status: 409 });
    }
    try { await recordAdminAction(context, "admin.scan.void", id, before, { ...data, reason }); }
    catch { return NextResponse.json({ ok: false, code: "AUDIT_WRITE_FAILED", message: "The scan was voided but its audit record failed. Contact the database administrator." }, { status: 500 }); }
    return NextResponse.json({ ok: true, item: data });
  } else {
    return NextResponse.json({ ok: false, code: "INVALID_TYPE" }, { status: 400 });
  }

  const { data: before, error: lookupError } = await context.db.from(table).select("*").eq("id", id).maybeSingle();
  if (lookupError || !before) return NextResponse.json({ ok: false, code: "ITEM_NOT_FOUND" }, { status: 404 });
  if (!allowedStatuses.includes(String(before.status))) {
    return NextResponse.json({ ok: false, code: "ITEM_ALREADY_RESOLVED" }, { status: 409 });
  }
  const { data, error } = await context.db.from(table).update(patch).eq("id", id).in("status", allowedStatuses).select("*").maybeSingle();
  if (error || !data) {
    if (error) console.error("[admin/reviews] Moderation update failed:", error.message);
    return NextResponse.json({ ok: false, code: "REVIEW_UPDATE_FAILED" }, { status: 500 });
  }
  try {
    await recordAdminAction(context, action, id, before, { ...data, moderation_reason: reason });
  } catch {
    return NextResponse.json({ ok: false, code: "AUDIT_WRITE_FAILED", message: "The item was updated but its audit record failed. Contact the database administrator." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, item: data });
}
