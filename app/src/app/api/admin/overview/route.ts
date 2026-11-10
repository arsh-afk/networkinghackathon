import { NextRequest, NextResponse } from "next/server";
import { isAdminError, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;

  const now = new Date();
  const activeCutoff = new Date(now.getTime() - 5 * 60_000).toISOString();
  const dayCutoff = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const [config, players, activePlayers, sessions, scans, roles, challenges, reports, submissions, conflicts, audit] = await Promise.all([
    context.db.from("game_config").select("*").eq("id", 1).maybeSingle(),
    context.db.from("players").select("id", { count: "exact", head: true }),
    context.db.from("players").select("id", { count: "exact", head: true }).eq("is_active", true),
    context.db.from("player_sessions").select("player_id").is("revoked_at", null).gt("expires_at", now.toISOString()).gt("last_seen_at", activeCutoff),
    context.db.from("scans").select("id", { count: "exact", head: true }).is("voided_at", null).gte("created_at", dayCutoff),
    context.db.from("players").select("role").eq("is_active", true),
    context.db.from("challenges").select("id", { count: "exact", head: true }).in("status", ["sent", "reported", "disputed"]),
    context.db.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    context.db.from("linkedin_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    context.db.from("auth_conflicts").select("id", { count: "exact", head: true }).eq("status", "pending"),
    context.db.from("audit_log").select("id,actor_type,actor_id,action,target,at").order("at", { ascending: false }).limit(10),
  ]);
  const results = [config, players, activePlayers, sessions, scans, roles, challenges, reports, submissions, conflicts, audit];
  const failure = results.find((result) => result.error);
  if (failure?.error) {
    console.error("[admin/overview] Dashboard query failed:", failure.error.message);
    return NextResponse.json({ ok: false, code: "DASHBOARD_QUERY_FAILED" }, { status: 500 });
  }

  const roleCounts = { artificer: 0, broker: 0, weaver: 0, patron: 0 };
  for (const row of roles.data ?? []) {
    const role = String(row.role).toLowerCase() as keyof typeof roleCounts;
    if (role in roleCounts) roleCounts[role]++;
  }
  const onlinePlayerIds = new Set((sessions.data ?? []).map((row) => row.player_id));

  return NextResponse.json({
    ok: true,
    admin: {
      id: String(context.admin.id),
      username: String(context.admin.username ?? ""),
      display_name: context.admin.display_name ?? null,
    },
    updatedAt: now.toISOString(),
    config: config.data,
    metrics: {
      registeredPlayers: players.count ?? 0,
      activePlayers: activePlayers.count ?? 0,
      onlinePlayers: onlinePlayerIds.size,
      onlineWindowMinutes: 5,
      scansLast24Hours: scans.count ?? 0,
      factionCounts: roleCounts,
      pendingChallenges: challenges.count ?? 0,
      pendingReports: reports.count ?? 0,
      pendingSubmissions: submissions.count ?? 0,
      pendingConflicts: conflicts.count ?? 0,
    },
    recentAudit: audit.data ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}
