import { NextRequest, NextResponse } from "next/server";
import { isAdminError, recordAdminAction, requireAdmin } from "@/lib/admin";
import { buildAdminGraph, csvCell } from "@/lib/admin-graph";

export const dynamic = "force-dynamic";

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

export async function GET(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;

  const snapshotId = req.nextUrl.searchParams.get("snapshot");
  if (snapshotId) {
    if (!/^[0-9a-f-]{36}$/i.test(snapshotId)) return NextResponse.json({ ok: false, code: "INVALID_SNAPSHOT" }, { status: 400 });
    const { data, error } = await context.db.from("snapshots").select("id,kind,payload,created_at,created_by").eq("id", snapshotId).maybeSingle();
    if (error || !data || !["graph", "final_graph"].includes(String(data.kind))) {
      if (error) console.error("[admin/graph] Snapshot lookup failed:", error.message);
      return NextResponse.json({ ok: false, code: "SNAPSHOT_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, snapshot: data, graph: (data.payload as Record<string, unknown>).graph }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data: config, error: configError } = await context.db.from("game_config").select("starts_at").eq("id", 1).maybeSingle();
  if (configError || !config) {
    console.error("[admin/graph] Could not load event start:", configError?.message ?? "missing config row");
    return NextResponse.json({ ok: false, code: "CONFIG_UNAVAILABLE" }, { status: 500 });
  }
  const from = req.nextUrl.searchParams.get("from") ?? String(config.starts_at).slice(0, 10);
  const to = req.nextUrl.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  if (!isDate(from) || !isDate(to) || from > to) {
    return NextResponse.json({ ok: false, code: "INVALID_DATE_RANGE", message: "Choose an ordered start and end date." }, { status: 400 });
  }

  try {
    const graph = await buildAdminGraph(context.db, from, to);
    if (req.nextUrl.searchParams.get("export") === "csv") {
      await recordAdminAction(context, "admin.graph.export", `${from}:${to}`, null, {
        players: graph.stats.players,
        connections: graph.stats.connections,
        includesNames: true,
        format: "csv",
      });
      const rows = [
        ["type", "id", "name", "role", "badge_code", "source", "target", "scans", "points", "last_seen"],
        ...graph.nodes.map((node) => ["player", node.id, node.name, node.role, node.badgeCode, "", "", "", "", ""]),
        ...graph.edges.map((edge) => ["connection", edge.id, "", "", "", edge.source, edge.target, edge.scans, edge.points, edge.lastSeen]),
      ];
      const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="syndicate-network-${from}-${to}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return NextResponse.json({ ok: true, graph, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin/graph] Could not build graph:", error);
    return NextResponse.json({ ok: false, code: "GRAPH_QUERY_FAILED" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, code: "BAD_JSON" }, { status: 400 }); }
  const data = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  if (data.action === "export_image") {
    const snapshotId = typeof data.snapshot === "string" ? data.snapshot : "";
    const from = typeof data.from === "string" ? data.from : "";
    const to = typeof data.to === "string" ? data.to : "";
    if ((snapshotId && !/^[0-9a-f-]{36}$/i.test(snapshotId)) || (!snapshotId && (!isDate(from) || !isDate(to) || from > to))) {
      return NextResponse.json({ ok: false, code: "INVALID_EXPORT_RANGE" }, { status: 400 });
    }
    try {
      await recordAdminAction(context, "admin.graph.export", snapshotId || `${from}:${to}`, null, {
        includesNames: true,
        format: "png",
      });
    } catch {
      return NextResponse.json({ ok: false, code: "AUDIT_WRITE_FAILED", message: "Image export was not started because its audit record could not be written." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const final = data.final === true;
  if (!title || title.length > 80) {
    return NextResponse.json({ ok: false, code: "INVALID_TITLE", message: "Snapshot title must contain 1–80 characters." }, { status: 400 });
  }

  const { data: config, error: configError } = await context.db.from("game_config").select("starts_at").eq("id", 1).maybeSingle();
  if (configError || !config) return NextResponse.json({ ok: false, code: "CONFIG_UNAVAILABLE" }, { status: 500 });
  try {
    const now = new Date();
    const from = typeof data.from === "string" && isDate(data.from) ? data.from : String(config.starts_at).slice(0, 10);
    const to = typeof data.to === "string" && isDate(data.to) ? data.to : now.toISOString().slice(0, 10);
    if (from > to) return NextResponse.json({ ok: false, code: "INVALID_DATE_RANGE" }, { status: 400 });
    const graph = await buildAdminGraph(context.db, from, to);
    const kind = final ? "final_graph" : "graph";
    const payload = { version: 1, title, captured_at: now.toISOString(), range: { from, to }, graph };
    const { data: snapshot, error } = await context.db.from("snapshots").insert({
      kind,
      payload,
      created_by: String(context.admin.id),
    }).select("id,kind,created_at").single();
    if (error) {
      console.error("[admin/graph] Could not save snapshot:", error.message);
      return NextResponse.json({ ok: false, code: "SNAPSHOT_SAVE_FAILED" }, { status: 500 });
    }
    try {
      await recordAdminAction(context, final ? "admin.graph.finalize" : "admin.graph.snapshot", snapshot.id, null, {
        title,
        range: { from, to },
        players: graph.stats.players,
        connections: graph.stats.connections,
      });
    } catch {
      return NextResponse.json({ ok: false, code: "AUDIT_WRITE_FAILED", message: "The snapshot was saved, but its audit record failed. Do not retry; contact the database administrator." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, snapshot }, { status: 201 });
  } catch (error) {
    console.error("[admin/graph] Snapshot creation failed:", error);
    return NextResponse.json({ ok: false, code: "SNAPSHOT_SAVE_FAILED" }, { status: 500 });
  }
}
