import { NextRequest, NextResponse } from "next/server";
import { isAdminError, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;
  const { data, error } = await context.db
    .from("snapshots")
    .select("id,kind,created_by,created_at,title:payload->>title")
    .in("kind", ["graph", "final_graph"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[admin/snapshots] Could not list graph history:", error.message);
    return NextResponse.json({ ok: false, code: "SNAPSHOTS_QUERY_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, snapshots: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
