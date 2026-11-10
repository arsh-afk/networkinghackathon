import { NextRequest, NextResponse } from "next/server";
import { isAdminError, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;
  const requestedLimit = Number(req.nextUrl.searchParams.get("limit") ?? 100);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100;
  const action = req.nextUrl.searchParams.get("action")?.trim().slice(0, 100);
  let query = context.db.from("audit_log")
    .select("id,actor_type,actor_id,action,target,before,after,at")
    .order("at", { ascending: false })
    .limit(limit);
  if (action) query = query.ilike("action", `%${action}%`);
  const { data, error } = await query;
  if (error) {
    console.error("[admin/audit] Audit history query failed:", error.message);
    return NextResponse.json({ ok: false, code: "AUDIT_QUERY_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, events: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
