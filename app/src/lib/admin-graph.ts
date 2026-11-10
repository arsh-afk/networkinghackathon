import { getServiceSupabase } from "./db";

type AdminDatabase = NonNullable<ReturnType<typeof getServiceSupabase>>;

export type AdminGraphNode = {
  id: string;
  name: string;
  role: string;
  badgeCode: string;
  connections: number;
  scans: number;
  online: boolean;
};

export type AdminGraphEdge = {
  id: string;
  source: string;
  target: string;
  scans: number;
  points: number;
  lastSeen: string;
};

export type AdminGraph = {
  from: string;
  to: string;
  nodes: AdminGraphNode[];
  edges: AdminGraphEdge[];
  stats: {
    players: number;
    onlinePlayers: number;
    connections: number;
    scans: number;
    factionCounts: Record<string, number>;
  };
};

export async function buildAdminGraph(db: AdminDatabase, from: string, to: string): Promise<AdminGraph> {
  const now = new Date();
  const onlineCutoff = new Date(now.getTime() - 5 * 60_000).toISOString();
  const [playersResult, scansResult, sessionsResult] = await Promise.all([
    db.from("players").select("id,display_name,role,badge_code,is_active").eq("is_active", true).order("display_name", { ascending: true }).range(0, 9999),
    db.from("scans").select("id,scanner_id,receiver_id,base_points,game_day,created_at,voided_at").is("voided_at", null).gte("game_day", from).lte("game_day", to).order("created_at", { ascending: true }).range(0, 9999),
    db.from("player_sessions").select("player_id").is("revoked_at", null).gt("expires_at", now.toISOString()).gt("last_seen_at", onlineCutoff).range(0, 9999),
  ]);
  for (const result of [playersResult, scansResult, sessionsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const onlineIds = new Set((sessionsResult.data ?? []).map((session) => String(session.player_id)));
  const playerIds = new Set((playersResult.data ?? []).map((player) => String(player.id)));
  const nodeMap = new Map<string, AdminGraphNode>();
  const factionCounts: Record<string, number> = { artificer: 0, broker: 0, weaver: 0, patron: 0 };
  for (const player of playersResult.data ?? []) {
    const role = String(player.role).toLowerCase();
    if (role in factionCounts) factionCounts[role]++;
    nodeMap.set(String(player.id), {
      id: String(player.id),
      name: String(player.display_name ?? "Agent"),
      role,
      badgeCode: String(player.badge_code ?? ""),
      connections: 0,
      scans: 0,
      online: onlineIds.has(String(player.id)),
    });
  }

  const edgeMap = new Map<string, AdminGraphEdge>();
  for (const scan of scansResult.data ?? []) {
    const source = String(scan.scanner_id);
    const target = String(scan.receiver_id);
    if (!playerIds.has(source) || !playerIds.has(target)) continue;
    const [first, second] = [source, target].sort();
    const edgeId = `${first}:${second}`;
    const edge = edgeMap.get(edgeId) ?? {
      id: edgeId,
      source: first,
      target: second,
      scans: 0,
      points: 0,
      lastSeen: String(scan.created_at),
    };
    edge.scans++;
    edge.points += Number(scan.base_points) || 0;
    edge.lastSeen = String(scan.created_at);
    edgeMap.set(edgeId, edge);
    const scanner = nodeMap.get(source);
    const receiver = nodeMap.get(target);
    if (scanner) scanner.scans++;
    if (receiver) receiver.scans++;
  }

  for (const edge of edgeMap.values()) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (source) source.connections++;
    if (target) target.connections++;
    edge.points = Math.round(edge.points * 100) / 100;
  }
  const nodes = [...nodeMap.values()];
  const edges = [...edgeMap.values()];

  return {
    from,
    to,
    nodes,
    edges,
    stats: {
      players: nodes.length,
      onlinePlayers: nodes.filter((node) => node.online).length,
      connections: edges.length,
      scans: edges.reduce((total, edge) => total + edge.scans, 0),
      factionCounts,
    },
  };
}

export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}
