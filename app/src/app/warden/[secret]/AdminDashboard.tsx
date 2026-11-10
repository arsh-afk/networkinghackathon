"use client";

import { FormEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type AdminUser = { id: string; username: string; display_name?: string | null };
type Row = Record<string, unknown>;
type DashboardTab = "overview" | "graph" | "settings" | "players" | "reviews" | "admins" | "audit";
type GraphNode = { id: string; name: string; role: string; badgeCode: string; connections: number; scans: number; online: boolean };
type GraphEdge = { id: string; source: string; target: string; scans: number; points: number; lastSeen: string };
type GraphData = {
  from: string; to: string; nodes: GraphNode[]; edges: GraphEdge[];
  stats: { players: number; onlinePlayers: number; connections: number; scans: number; factionCounts: Record<string, number> };
};
type Metrics = {
  registeredPlayers: number; activePlayers: number; onlinePlayers: number; onlineWindowMinutes: number;
  scansLast24Hours: number; factionCounts: Record<string, number>;
  pendingChallenges: number; pendingReports: number; pendingSubmissions: number; pendingConflicts: number;
};
type Snapshot = { id: string; kind: string; created_by: string | null; created_at: string; title?: string };
type ReviewData = { reports: Row[]; submissions: Row[]; conflicts: Row[]; challenges: Row[]; scans: Row[] };
type AdminRecord = { id: string; username: string; display_name: string | null; is_active: boolean; created_at: string; last_login_at: string | null };
type AuditEntry = { id: string; actor_type: string; actor_id: string | null; action: string; target: string | null; before: unknown; after: unknown; at: string };

const TABS: { id: DashboardTab; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "graph", label: "Network" }, { id: "settings", label: "Event & scoring" },
  { id: "players", label: "Players" }, { id: "reviews", label: "Review queue" }, { id: "admins", label: "Admins" }, { id: "audit", label: "Audit log" },
];
const ROLES = ["artificer", "broker", "weaver", "patron"];
const ROLE_COLORS: Record<string, string> = { artificer: "#d8b45a", broker: "#7fb4e8", weaver: "#77c99a", patron: "#c28ce0" };
const REVIEW_LABELS: Record<keyof ReviewData, string> = {
  reports: "Player reports", submissions: "LinkedIn submissions", conflicts: "Registration conflicts",
  challenges: "Mini-game challenges", scans: "Recent scans",
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : `${data.code ?? "Request failed"} (${response.status})`);
  return data as T;
}

function displayDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function inputDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function localDateToIso(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function fieldValue(config: Row, key: string) {
  const value = config[key];
  return ["starts_at", "weekend_at", "locks_at"].includes(key) ? inputDate(value) : String(value ?? "");
}

function safeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "—";
}

export default function AdminDashboard({ admin, onLogout }: { admin: AdminUser; onLogout: () => void }) {
  const [tab, setTab] = useState<DashboardTab>("overview");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [config, setConfig] = useState<Row>({});
  const [players, setPlayers] = useState<Row[]>([]);
  const [playerQuery, setPlayerQuery] = useState("");
  const [reviewData, setReviewData] = useState<ReviewData>({ reports: [], submissions: [], conflicts: [], challenges: [], scans: [] });
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditQuery, setAuditQuery] = useState("");
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotId, setSnapshotId] = useState("");
  const [graphFrom, setGraphFrom] = useState("");
  const [graphTo, setGraphTo] = useState(new Date().toISOString().slice(0, 10));
  const [graphRole, setGraphRole] = useState("all");
  const [graphQuery, setGraphQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminDisplayName, setAdminDisplayName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const graphSvg = useRef<SVGSVGElement | null>(null);

  const showError = useCallback((reason: unknown) => {
    setError(reason instanceof Error ? reason.message : String(reason));
    setMessage("");
  }, []);
  const showMessage = useCallback((text: string) => {
    setMessage(text);
    setError("");
  }, []);

  const loadOverview = useCallback(async () => {
    const data = await requestJson<{ metrics: Metrics; config: Row }>("/api/admin/overview");
    setMetrics(data.metrics);
    setConfig(data.config ?? {});
  }, []);

  const loadGraph = useCallback(async (id = "") => {
    const params = new URLSearchParams();
    if (id) params.set("snapshot", id);
    else {
      if (graphFrom) params.set("from", graphFrom);
      if (graphTo) params.set("to", graphTo);
    }
    const data = await requestJson<{ graph: GraphData }>(`/api/admin/graph?${params.toString()}`);
    setGraph(data.graph);
    setSelectedNode("");
  }, [graphFrom, graphTo]);

  const loadSnapshots = useCallback(async () => {
    const data = await requestJson<{ snapshots: Snapshot[] }>("/api/admin/snapshots");
    setSnapshots(data.snapshots);
  }, []);

  const loadPlayers = useCallback(async (query: string) => {
    const data = await requestJson<{ players: Row[] }>(`/api/admin/players?q=${encodeURIComponent(query)}`);
    setPlayers(data.players);
  }, []);

  const loadReviews = useCallback(async () => {
    const data = await requestJson<ReviewData>("/api/admin/reviews");
    setReviewData(data);
  }, []);

  const loadAdmins = useCallback(async () => {
    const data = await requestJson<{ users: AdminRecord[] }>("/api/admin/users");
    setAdmins(data.users);
  }, []);

  const loadAudit = useCallback(async (query: string) => {
    const data = await requestJson<{ events: AuditEntry[] }>(`/api/admin/audit?limit=200&action=${encodeURIComponent(query)}`);
    setAudit(data.events);
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      if (tab === "overview") await loadOverview();
      if (tab === "graph") { await Promise.all([loadGraph(snapshotId), loadSnapshots()]); }
      if (tab === "settings") await loadOverview();
      if (tab === "players") await loadPlayers(playerQuery);
      if (tab === "reviews") await loadReviews();
      if (tab === "admins") await loadAdmins();
      if (tab === "audit") await loadAudit(auditQuery);
      showMessage("Updated just now.");
    } catch (reason) { showError(reason); }
    finally { setBusy(false); }
  }, [tab, loadOverview, loadGraph, loadSnapshots, snapshotId, loadPlayers, playerQuery, loadReviews, loadAdmins, loadAudit, auditQuery, showError, showMessage]);

  useEffect(() => {
    let active = true;
    requestJson<{ metrics: Metrics; config: Row }>("/api/admin/overview")
      .then((data) => { if (active) { setMetrics(data.metrics); setConfig(data.config ?? {}); } })
      .catch((reason) => { if (active) showError(reason); });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        requestJson<{ metrics: Metrics; config: Row }>("/api/admin/overview")
          .then((data) => { if (active) { setMetrics(data.metrics); setConfig(data.config ?? {}); } })
          .catch((reason) => { if (active) showError(reason); });
      }
    }, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [showError]);

  useEffect(() => {
    if (tab === "overview") return;
    let active = true;
    const run = async () => {
      try {
        if (tab === "graph") {
          const [graphResponse, snapshotResponse] = await Promise.all([
            requestJson<{ graph: GraphData }>(`/api/admin/graph?${snapshotId ? `snapshot=${encodeURIComponent(snapshotId)}` : new URLSearchParams({ ...(graphFrom ? { from: graphFrom } : {}), ...(graphTo ? { to: graphTo } : {}) }).toString()}`),
            requestJson<{ snapshots: Snapshot[] }>("/api/admin/snapshots"),
          ]);
          if (active) { setGraph(graphResponse.graph); setSnapshots(snapshotResponse.snapshots); }
        } else if (tab === "settings") {
          const data = await requestJson<{ config: Row }>("/api/admin/settings");
          if (active) setConfig(data.config);
        } else if (tab === "players") {
          const data = await requestJson<{ players: Row[] }>(`/api/admin/players?q=${encodeURIComponent(playerQuery)}`);
          if (active) setPlayers(data.players);
        } else if (tab === "reviews") {
          const data = await requestJson<ReviewData>("/api/admin/reviews");
          if (active) setReviewData(data);
        } else if (tab === "admins") {
          const data = await requestJson<{ users: AdminRecord[] }>("/api/admin/users");
          if (active) setAdmins(data.users);
        } else if (tab === "audit") {
          const data = await requestJson<{ events: AuditEntry[] }>(`/api/admin/audit?limit=200&action=${encodeURIComponent(auditQuery)}`);
          if (active) setAudit(data.events);
        }
      } catch (reason) { if (active) showError(reason); }
    };
    const timer = window.setTimeout(() => { void run(); }, tab === "players" || tab === "audit" ? 250 : 0);
    const poll = tab === "graph" ? window.setInterval(() => {
      if (document.visibilityState === "visible") void run();
    }, 30_000) : null;
    return () => { active = false; window.clearTimeout(timer); if (poll) window.clearInterval(poll); };
  }, [tab, snapshotId, graphFrom, graphTo, playerQuery, auditQuery, showError]);

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const changes: Record<string, string | number> = {};
    for (const [key, value] of formData.entries()) {
      if (["starts_at", "weekend_at", "locks_at"].includes(key)) changes[key] = localDateToIso(String(value));
      else if (typeof config[key] === "number") changes[key] = Number(value);
      else changes[key] = String(value);
    }
    if (!window.confirm("Apply these event and scoring changes now? Any scoring changes take effect immediately and this action is audited.")) return;
    setBusy(true);
    try {
      const data = await requestJson<{ config: Row }>("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ changes }) });
      setConfig(data.config);
      showMessage("Event settings saved. The change is recorded in the audit log.");
    } catch (reason) { showError(reason); }
    finally { setBusy(false); }
  }

  async function updatePlayer(player: Row, changes: Row, reason: string) {
    try {
      await requestJson("/api/admin/players", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: player.id, changes, reason }) });
      await loadPlayers(playerQuery);
      showMessage(`Updated ${String(player.display_name ?? "player")}.`);
    } catch (reason) { showError(reason); }
  }

  async function moderate(type: string, id: string, status: string) {
    const prompt = type === "scan" ? "Why should this scan be voided?" : type === "challenge" ? "Why should this challenge be cancelled?" : "Add a moderation reason:";
    const reason = window.prompt(prompt);
    if (!reason?.trim()) return;
    if (type === "scan" && !window.confirm("Void this scan? It will be removed from scoring and network results.")) return;
    try {
      await requestJson("/api/admin/reviews", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, id, status, reason: reason.trim() }) });
      await loadReviews();
      showMessage("Moderation action completed and recorded.");
    } catch (reason) { showError(reason); }
  }

  async function createSnapshot(final: boolean) {
    const defaultTitle = final ? "Final game network" : `Network snapshot ${new Date().toLocaleString()}`;
    const title = window.prompt(final ? "Name the final network snapshot:" : "Name this graph snapshot:", defaultTitle);
    if (!title?.trim()) return;
    if (final && !window.confirm("Finalize this network? This creates an immutable final snapshot and is recorded in the audit log.")) return;
    setBusy(true);
    try {
      await requestJson("/api/admin/graph", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), final, from: graph?.from, to: graph?.to }),
      });
      await loadSnapshots();
      showMessage(final ? "Final graph saved." : "Graph snapshot saved.");
    } catch (reason) { showError(reason); }
    finally { setBusy(false); }
  }

  async function exportGraphImage() {
    const svg = graphSvg.current;
    if (!svg || !graph) return;
    try {
      await requestJson("/api/admin/graph", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "export_image", snapshot: snapshotId || undefined, from: graph.from, to: graph.to }),
      });
      const copy = svg.cloneNode(true) as SVGSVGElement;
      copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      copy.setAttribute("width", "2000");
      copy.setAttribute("height", "1320");
      copy.querySelectorAll(".warden-graph-edge").forEach((edge) => {
        edge.setAttribute("stroke", "rgba(216,180,90,.5)");
      });
      copy.querySelectorAll(".warden-graph-node circle").forEach((circle) => {
        circle.setAttribute("stroke", "#f0e9d8");
        circle.setAttribute("stroke-width", "3");
      });
      copy.querySelectorAll(".warden-graph-node text").forEach((label) => {
        label.setAttribute("fill", "#e7dfce");
        label.setAttribute("font-family", "Arial, sans-serif");
        label.setAttribute("font-size", "12");
        label.setAttribute("stroke", "#101216");
        label.setAttribute("stroke-width", "4");
        label.setAttribute("paint-order", "stroke");
      });
      const backdrop = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      backdrop.setAttribute("width", "1000");
      backdrop.setAttribute("height", "660");
      backdrop.setAttribute("fill", "#101216");
      copy.insertBefore(backdrop, copy.firstChild);
      const svgBlob = new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml;charset=utf-8" });
      const imageUrl = URL.createObjectURL(svgBlob);
      try {
        const image = new Image();
        image.src = imageUrl;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 2000;
        canvas.height = 1320;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image export is not supported by this browser.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode the network image.")), "image/png"));
        const downloadUrl = URL.createObjectURL(png);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `syndicate-network-${graph.from}-${graph.to}.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        showMessage("PNG export downloaded; the private export is recorded in the audit log.");
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    } catch (reason) { showError(reason); }
  }

  async function addAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await requestJson("/api/admin/users", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: adminUsername, displayName: adminDisplayName, password: adminPassword }),
      });
      setAdminUsername(""); setAdminDisplayName(""); setAdminPassword("");
      await loadAdmins();
      showMessage("Administrator account created.");
    } catch (reason) { showError(reason); }
  }

  async function setAdminActive(user: AdminRecord) {
    const isActive = !user.is_active;
    if (!window.confirm(`${isActive ? "Enable" : "Disable"} ${user.username}?${isActive ? "" : " Active admin sessions will be revoked."}`)) return;
    try {
      await requestJson("/api/admin/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: user.id, isActive }) });
      await loadAdmins();
      showMessage(`${user.username} ${isActive ? "enabled" : "disabled"}.`);
    } catch (reason) { showError(reason); }
  }

  const filteredNodes = useMemo(() => (graph?.nodes ?? []).filter((node) =>
    (graphRole === "all" || node.role === graphRole) &&
    (!graphQuery || `${node.name} ${node.badgeCode} ${node.role}`.toLowerCase().includes(graphQuery.toLowerCase()))
  ), [graph, graphRole, graphQuery]);
  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    filteredNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index / Math.max(filteredNodes.length, 1)) - Math.PI / 2;
      const radiusX = filteredNodes.length === 1 ? 0 : 330;
      const radiusY = filteredNodes.length === 1 ? 0 : 245;
      positions.set(node.id, { x: 500 + Math.cos(angle) * radiusX, y: 330 + Math.sin(angle) * radiusY });
    });
    return positions;
  }, [filteredNodes]);
  const selected = filteredNodes.find((node) => node.id === selectedNode);
  const graphPlayerNames = useMemo(() => new Map((graph?.nodes ?? []).map((node) => [node.id, node.name])), [graph]);

  function graphPointerDown(event: PointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest(".warden-graph-node")) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function graphPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const horizontalScale = 1000 / bounds.width;
    const verticalScale = 660 / bounds.height;
    const deltaX = (event.clientX - drag.current.x) * horizontalScale;
    const deltaY = (event.clientY - drag.current.y) * verticalScale;
    setOffset((point) => ({ x: point.x + deltaX, y: point.y + deltaY }));
    drag.current = { ...drag.current, x: event.clientX, y: event.clientY };
  }

  return (
    <main className="app-shell">
      <section className="warden-panel">
        <header className="warden-dashboard-header">
          <div><p className="eyebrow">Game warden · operations</p><h1 className="page-title">Command center</h1></div>
          <div className="warden-account">
            <span className="warden-account-name">{admin.display_name || admin.username}</span>
            <button type="button" className="warden-mini-action" onClick={onLogout}>Sign out</button>
          </div>
        </header>
        <nav className="warden-nav" aria-label="Warden console sections">
          {TABS.map((item) => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} onClick={() => { setTab(item.id); setError(""); setMessage(""); }}>{item.label}</button>)}
        </nav>
        <div className="warden-view-heading">
          <div><h2>{TABS.find((item) => item.id === tab)?.label}</h2><p>{tab === "overview" ? "Live status and event health." : tab === "graph" ? "Explore connections, historical snapshots, and the final network." : "Private administrative controls; changes are recorded."}</p></div>
          <button type="button" className="warden-mini-action" onClick={() => void refresh()} disabled={busy}>{busy ? "Working…" : "↻ Refresh"}</button>
        </div>
        {(error || message) && <p className={`warden-message ${error ? "error-text" : "success-text"}`} role={error ? "alert" : "status"}>{error || message}</p>}

        {tab === "overview" && <section className="warden-view" aria-label="Live overview">
          {metrics ? <>
            <div className="warden-metrics">
              <Metric label="Online now" value={metrics.onlinePlayers} note={`Heartbeat within ${metrics.onlineWindowMinutes} minutes`} />
              <Metric label="Active players" value={metrics.activePlayers} note={`${metrics.registeredPlayers} registered`} />
              <Metric label="Scans · 24h" value={metrics.scansLast24Hours} note="Non-voided scans" />
              <Metric label="Open reviews" value={metrics.pendingReports + metrics.pendingSubmissions + metrics.pendingConflicts + metrics.pendingChallenges} note="Across all queues" />
            </div>
            <div className="warden-grid" style={{ marginTop: 14 }}>
              <article className="card warden-card"><h3>Faction roster</h3><div className="warden-review-list">{ROLES.map((role) => <div className="warden-review-item" key={role}><strong style={{ color: ROLE_COLORS[role] }}>{role}</strong><span className="warden-data">{metrics.factionCounts?.[role] ?? 0} players</span></div>)}</div></article>
              <article className="card warden-card"><h3>Needs attention</h3><div className="warden-review-list">
                <QueueCount label="Reports" value={metrics.pendingReports} onClick={() => setTab("reviews")} />
                <QueueCount label="Registration conflicts" value={metrics.pendingConflicts} onClick={() => setTab("reviews")} />
                <QueueCount label="LinkedIn submissions" value={metrics.pendingSubmissions} onClick={() => setTab("reviews")} />
                <QueueCount label="Challenges" value={metrics.pendingChallenges} onClick={() => setTab("reviews")} />
              </div></article>
              <article className="card warden-card"><h3>Event status</h3><dl className="warden-data">
                <Detail label="Event" value={safeText(config.event_name)} /><Detail label="Phase" value={safeText(config.phase)} />
                <Detail label="Starts" value={displayDate(config.starts_at)} /><Detail label="Locks" value={displayDate(config.locks_at)} />
              </dl><button className="warden-action" type="button" onClick={() => setTab("settings")}>Manage event settings</button></article>
              <article className="card warden-card"><h3>Operator notes</h3><p className="warden-review-meta">Presence is based on a valid player session with a heartbeat during the last five minutes. Sensitive player and graph data is only available in this authenticated console.</p><p className="warden-review-meta">Settings, moderation, player edits, exports, and graph snapshots are recorded in the audit log.</p></article>
            </div>
          </> : <div className="card warden-empty">Loading live event metrics…</div>}
        </section>}

        {tab === "graph" && <section className="warden-view">
          <div className="warden-toolbar" style={{ marginBottom: 12 }}>
            <label className="warden-status">From <input aria-label="Graph start date" type="date" value={graphFrom || graph?.from || ""} onChange={(event) => { setSnapshotId(""); setGraphFrom(event.target.value); }} /></label>
            <label className="warden-status">To <input aria-label="Graph end date" type="date" value={graphTo} onChange={(event) => { setSnapshotId(""); setGraphTo(event.target.value); }} /></label>
            <select className="warden-select" aria-label="Choose graph snapshot" value={snapshotId} onChange={(event) => { setSnapshotId(event.target.value); setOffset({ x: 0, y: 0 }); setZoom(1); }}>
              <option value="">Live graph</option>
              {snapshots.map((snapshot) => <option value={snapshot.id} key={snapshot.id}>{snapshot.kind === "final_graph" ? "FINAL · " : ""}{snapshot.title || displayDate(snapshot.created_at)}</option>)}
            </select>
            <select className="warden-select" aria-label="Filter by faction" value={graphRole} onChange={(event) => setGraphRole(event.target.value)}>
              <option value="all">All factions</option>{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <input aria-label="Search network players" placeholder="Find a player or badge" value={graphQuery} onChange={(event) => setGraphQuery(event.target.value)} />
          </div>
          <div className="warden-toolbar" style={{ marginBottom: 12 }}>
            <button className="warden-mini-action" type="button" onClick={() => setZoom((value) => Math.min(2.5, value + .15))}>Zoom in</button>
            <button className="warden-mini-action" type="button" onClick={() => setZoom((value) => Math.max(.45, value - .15))}>Zoom out</button>
            <button className="warden-mini-action" type="button" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>Reset view</button>
            {!snapshotId && <a className="warden-mini-action" href={`/api/admin/graph?from=${encodeURIComponent(graph?.from ?? graphFrom)}&to=${encodeURIComponent(graph?.to ?? graphTo)}&export=csv`}>Export private CSV</a>}
            <button className="warden-mini-action" type="button" onClick={() => void exportGraphImage()}>Export PNG</button>
            <button className="warden-mini-action" type="button" onClick={() => void createSnapshot(false)} disabled={busy}>Save snapshot</button>
            <button className="warden-mini-action warden-mini-danger" type="button" onClick={() => void createSnapshot(true)} disabled={busy}>Finalize network</button>
          </div>
          <div className="warden-graph-layout">
            <article className="card warden-graph-card">
              {graph ? <>
                <div className="warden-metrics" style={{ padding: 12, gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>
                  <Metric label="Players" value={graph.stats.players} note="Active roster" />
                  <Metric label="Online" value={graph.stats.onlinePlayers} note="Recent heartbeat" />
                  <Metric label="Connections" value={graph.stats.connections} note="Unique pairs" />
                  <Metric label="Scans" value={graph.stats.scans} note={`${graph.from} – ${graph.to}`} />
                </div>
                <div className="warden-graph-stage">
                  <svg ref={graphSvg} className="warden-graph-svg" viewBox="0 0 1000 660" role="application" aria-label="Interactive player network graph. Drag empty space to pan; use zoom controls." onPointerDown={graphPointerDown} onPointerMove={graphPointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
                    <g transform={`translate(${offset.x} ${offset.y}) translate(500 330) scale(${zoom}) translate(-500 -330)`}>
                      {graph.edges.map((edge) => {
                        const a = nodePositions.get(edge.source); const b = nodePositions.get(edge.target);
                        return a && b ? <line key={edge.id} className="warden-graph-edge" x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={Math.min(5, 1 + Math.log2(edge.scans + 1))} opacity={Math.min(.8, .2 + edge.scans * .08)} /> : null;
                      })}
                      {filteredNodes.map((node) => {
                        const point = nodePositions.get(node.id);
                        if (!point) return null;
                        const label = filteredNodes.length <= 45 || node.id === selectedNode || node.name.toLowerCase().includes(graphQuery.toLowerCase());
                        return <g key={node.id} className="warden-graph-node" role="button" tabIndex={0} aria-label={`${node.name}, ${node.role}, ${node.connections} connections${node.online ? ", online" : ""}`} aria-pressed={node.id === selectedNode} onClick={() => setSelectedNode(node.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedNode(node.id); } }}>
                          <circle cx={point.x} cy={point.y} r={node.id === selectedNode ? 11 : node.online ? 8 : 6} fill={ROLE_COLORS[node.role] ?? "#b9b2a1"} />
                          {label && <text x={point.x + 10} y={point.y + 4}>{node.name.slice(0, 22)}</text>}
                        </g>;
                      })}
                    </g>
                  </svg>
                </div>
                <div className="warden-graph-legend">{ROLES.map((role) => <span key={role}><i style={{ background: ROLE_COLORS[role] }} />{role}</span>)}<span><i style={{ background: "#d8b45a" }} />Edge weight = scan count</span></div>
              </> : <div className="warden-empty">Building network graph…</div>}
            </article>
            <aside className="card warden-card">
              <h3>{selected ? selected.name : "Network details"}</h3>
              {selected ? <dl className="warden-data">
                <Detail label="Faction" value={selected.role} /><Detail label="Badge" value={selected.badgeCode} />
                <Detail label="Presence" value={selected.online ? "Online" : "Offline"} /><Detail label="Connections" value={selected.connections} />
                <Detail label="Scans" value={selected.scans} />
                <div className="warden-review-meta">Names and badge identifiers are shown only inside this authenticated console.</div>
              </dl> : <p className="warden-review-meta">Select a player node to inspect their faction, presence, and connection counts. Drag the graph background to pan.</p>}
              <h3 style={{ marginTop: 22 }}>Faction counts</h3>
              <div className="warden-review-list">{ROLES.map((role) => <div className="warden-review-item" key={role}><span style={{ color: ROLE_COLORS[role] }}>{role}</span><strong>{graph?.stats.factionCounts?.[role] ?? 0}</strong></div>)}</div>
              <p className="warden-review-meta">Snapshot history: {snapshots.length} saved graph{snapshots.length === 1 ? "" : "s"}.</p>
            </aside>
          </div>
        </section>}

        {tab === "settings" && <section className="warden-view">
          <form className="card warden-card" onSubmit={submitSettings}>
            <p className="warden-review-meta">Event and scoring edits take effect immediately after confirmation. Every saved change is audited. Datetimes are entered in your local timezone and stored as UTC.</p>
            <div className="warden-field-grid">
              <SectionLabel>Event controls</SectionLabel>
              <ConfigInput label="Event name" name="event_name" value={fieldValue(config, "event_name")} />
              <label className="warden-form"><span className="warden-label">Phase</span><select name="phase" className="warden-input" value={String(config.phase ?? "setup")} onChange={(event) => setConfig((current) => ({ ...current, phase: event.target.value }))}>{["setup", "live", "weekend", "locked", "closed"].map((phase) => <option key={phase}>{phase}</option>)}</select></label>
              <ConfigInput label="Timezone" name="tz" value={fieldValue(config, "tz")} />
              <ConfigInput label="Starts at" name="starts_at" value={fieldValue(config, "starts_at")} type="datetime-local" />
              <ConfigInput label="Weekend starts" name="weekend_at" value={fieldValue(config, "weekend_at")} type="datetime-local" />
              <ConfigInput label="Locks at" name="locks_at" value={fieldValue(config, "locks_at")} type="datetime-local" />
              <ConfigInput label="Day rollover hour" name="day_rollover_h" value={fieldValue(config, "day_rollover_h")} type="number" />
              <SectionLabel>Scoring thresholds & multipliers</SectionLabel>
              <ConfigInput label="Tier 1 scans threshold" name="tier1_n" value={fieldValue(config, "tier1_n")} type="number" />
              <ConfigInput label="Tier 2 scans threshold" name="tier2_n" value={fieldValue(config, "tier2_n")} type="number" />
              <ConfigInput label="Tier 1 multiplier" name="tier1_mult" value={fieldValue(config, "tier1_mult")} type="number" step="0.1" />
              <ConfigInput label="Tier 2 multiplier" name="tier2_mult" value={fieldValue(config, "tier2_mult")} type="number" step="0.1" />
              <ConfigInput label="Tier 3 multiplier" name="tier3_mult" value={fieldValue(config, "tier3_mult")} type="number" step="0.1" />
              <ConfigInput label="Diversity multiplier" name="diversity_mult" value={fieldValue(config, "diversity_mult")} type="number" step="0.1" />
              <ConfigInput label="Monochrome multiplier" name="mono_mult" value={fieldValue(config, "mono_mult")} type="number" step="0.1" />
              <ConfigInput label="Weekly scan cap" name="weekly_scan_cap" value={fieldValue(config, "weekly_scan_cap")} type="number" />
              <ConfigInput label="Receive cap" name="receive_cap" value={fieldValue(config, "receive_cap")} type="number" />
              <SectionLabel>Patron role rules</SectionLabel>
              <ConfigInput label="Patron scan bonus" name="patron_scan_bonus" value={fieldValue(config, "patron_scan_bonus")} type="number" />
              <ConfigInput label="Patron tier 1 threshold" name="patron_touch_t1_n" value={fieldValue(config, "patron_touch_t1_n")} type="number" />
              <ConfigInput label="Patron tier 1 points" name="patron_touch_t1_pts" value={fieldValue(config, "patron_touch_t1_pts")} type="number" />
              <ConfigInput label="Patron tier 2 threshold" name="patron_touch_t2_n" value={fieldValue(config, "patron_touch_t2_n")} type="number" />
              <ConfigInput label="Patron tier 2 points" name="patron_touch_t2_pts" value={fieldValue(config, "patron_touch_t2_pts")} type="number" />
            </div>
            <div className="warden-config-actions"><button className="warden-action warden-action-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Review and apply settings"}</button></div>
          </form>
        </section>}

        {tab === "players" && <section className="warden-view">
          <div className="warden-toolbar" style={{ marginBottom: 12 }}><input aria-label="Search players" placeholder="Search name, email, or badge" value={playerQuery} onChange={(event) => setPlayerQuery(event.target.value)} /></div>
          <div className="warden-table-wrap"><table className="warden-table"><thead><tr><th>Player</th><th>Email</th><th>Faction / badge</th><th>Status</th><th>Operations</th></tr></thead><tbody>
            {players.map((player) => <tr key={String(player.id)}>
              <td><strong>{String(player.display_name ?? "—")}</strong><div className="warden-review-meta">{String(player.descriptor ?? "")}</div></td>
              <td>{String(player.email ?? "—")}</td><td>{String(player.role)} · {String(player.badge_code)}</td>
              <td><span className={`warden-status ${player.is_active ? "online" : ""}`}>{player.is_active ? "Active" : "Disabled"}</span></td>
              <td><div className="warden-inline-actions">
                <select className="warden-select" aria-label={`Set faction for ${String(player.display_name)}`} defaultValue={String(player.role)} onChange={(event) => { const reason = window.prompt("Reason for role change:"); if (reason?.trim()) void updatePlayer(player, { role: event.target.value }, reason.trim()); }}>
                  {ROLES.map((role) => <option key={role}>{role}</option>)}
                </select>
                <button className="warden-mini-action" type="button" onClick={() => { const pin = window.prompt("Enter the new player PIN (6 digits):"); if (pin && /^\d{6}$/.test(pin)) void updatePlayer(player, { pin }, "Warden PIN reset"); else if (pin) showError(new Error("PIN must contain exactly six digits.")); }}>Reset PIN</button>
                <button className={`warden-mini-action ${player.is_active ? "warden-mini-danger" : ""}`} type="button" onClick={() => { const reason = window.prompt(`${player.is_active ? "Disable" : "Enable"} player. Enter a reason:`); if (reason?.trim()) void updatePlayer(player, { is_active: !player.is_active }, reason.trim()); }}>{player.is_active ? "Disable" : "Enable"}</button>
                <button className="warden-mini-action" type="button" onClick={() => { const badge = window.prompt("New 6-digit badge code:", String(player.badge_code)); if (badge && /^\d{6}$/.test(badge)) void updatePlayer(player, { badge_code: badge }, "Warden badge update"); }}>Badge</button>
                <button className="warden-mini-action" type="button" onClick={() => { const descriptor = window.prompt("Player descriptor (60 characters maximum):", String(player.descriptor ?? "")); if (descriptor !== null && descriptor.length <= 60) void updatePlayer(player, { descriptor }, "Warden descriptor update"); }}>Descriptor</button>
              </div></td>
            </tr>)}
            {!players.length && <tr><td colSpan={5} className="warden-empty">No players found.</td></tr>}
          </tbody></table></div>
          <p className="warden-review-meta">PIN resets and deactivation revoke active player sessions. Search is limited to the newest 500 accounts.</p>
        </section>}

        {tab === "reviews" && <section className="warden-view">
          <div className="warden-grid">
            {(Object.keys(REVIEW_LABELS) as (keyof ReviewData)[]).map((key) => <article className="card warden-card" key={key}>
              <h3>{REVIEW_LABELS[key]} <span className="warden-count">{reviewData[key].length}</span></h3>
              <div className="warden-review-list">{reviewData[key].map((item) => <ReviewCard key={String(item.id)} type={key} item={item} names={graphPlayerNames} onModerate={moderate} />)}
                {!reviewData[key].length && <div className="warden-empty">No open items in this queue.</div>}
              </div>
            </article>)}
          </div>
        </section>}

        {tab === "admins" && <section className="warden-view">
          <form className="card warden-card" onSubmit={addAdmin}><h3>Add administrator</h3>
            <div className="warden-field-grid">
              <ConfigInput label="Username" value={adminUsername} onChange={setAdminUsername} />
              <ConfigInput label="Display name" value={adminDisplayName} onChange={setAdminDisplayName} />
              <ConfigInput label="Password · 8+ characters" type="password" value={adminPassword} onChange={setAdminPassword} />
            </div>
            <div className="warden-config-actions"><button className="warden-action warden-action-primary" type="submit">Create admin account</button></div>
          </form>
          <div className="warden-table-wrap" style={{ marginTop: 14 }}><table className="warden-table"><thead><tr><th>Account</th><th>Status</th><th>Created</th><th>Last login</th><th>Control</th></tr></thead><tbody>
            {admins.map((user) => <tr key={user.id}><td><strong>{user.display_name || user.username}</strong><div className="warden-review-meta">{user.username}{user.id === admin.id ? " · you" : ""}</div></td><td>{user.is_active ? "Enabled" : "Disabled"}</td><td>{displayDate(user.created_at)}</td><td>{displayDate(user.last_login_at)}</td><td><button className={`warden-mini-action ${user.is_active ? "warden-mini-danger" : ""}`} type="button" disabled={user.id === admin.id} onClick={() => void setAdminActive(user)}>{user.is_active ? "Disable" : "Enable"}</button></td></tr>)}
          </tbody></table></div>
          <p className="warden-review-meta">Disabling an admin revokes their active sessions. You cannot disable your own account.</p>
        </section>}

        {tab === "audit" && <section className="warden-view">
          <div className="warden-toolbar" style={{ marginBottom: 12 }}><input aria-label="Filter audit actions" placeholder="Filter action name" value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} /><span className="warden-review-meta">{audit.length} newest events (maximum 200)</span></div>
          <div className="warden-table-wrap"><table className="warden-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>
            {audit.map((entry) => <tr key={entry.id}><td>{displayDate(entry.at)}</td><td>{entry.actor_type}<div className="warden-review-meta">{entry.actor_id ?? ""}</div></td><td>{entry.action}</td><td>{entry.target ?? "—"}</td><td><details><summary>Inspect</summary><pre className="warden-audit-json">{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre></details></td></tr>)}
            {!audit.length && <tr><td colSpan={5} className="warden-empty">No audit events match.</td></tr>}
          </tbody></table></div>
        </section>}
        <footer className="warden-footer">Private warden console · operator actions are audited · automatic overview refresh every 30 seconds</footer>
      </section>
    </main>
  );
}

function Metric({ label, value, note }: { label: string; value: number | string; note: string }) {
  return <article className="card warden-metric"><div className="warden-metric-label">{label}</div><div className="warden-metric-value">{value}</div><div className="warden-metric-note">{note}</div></article>;
}

function QueueCount({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return <button type="button" className="warden-review-item warden-queue-button" onClick={onClick}><strong>{label}</strong><span className="warden-count">{value}</span></button>;
}

function Detail({ label, value }: { label: string; value: unknown }) {
  return <div className="warden-detail"><dt>{label}</dt><dd className="warden-detail-value">{String(value ?? "—")}</dd></div>;
}

function SectionLabel({ children }: { children: string }) {
  return <h3 className="warden-section-label">{children}</h3>;
}

function ConfigInput({ label, name, value, type = "text", step, onChange }: { label: string; name?: string; value: string; type?: string; step?: string; onChange?: (value: string) => void }) {
  return <label className="warden-form"><span className="warden-label">{label}</span><input className="warden-input" name={name} type={type} step={step} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} required /></label>;
}

function ReviewCard({ type, item, names, onModerate }: { type: keyof ReviewData; item: Row; names: Map<string, string>; onModerate: (type: string, id: string, status: string) => Promise<void> }) {
  const id = String(item.id ?? "");
  const playerName = (key: string) => names.get(String(item[key] ?? "")) ?? String(item[key] ?? "Unknown player");
  const summary = type === "reports" ? `${playerName("reporter_id")} reported ${playerName("reported_id")}: ${String(item.note ?? "")}`
    : type === "submissions" ? `${playerName("player_id")} · ${String(item.task ?? "")}: ${String(item.description ?? item.proof_url ?? "")}`
    : type === "conflicts" ? `${String(item.email ?? "Unknown email")} · badge ${String(item.badge_code ?? "")}: ${String(item.detail ?? "")}`
    : type === "challenges" ? `${playerName("challenger_id")} vs ${playerName("opponent_id")} · ${String(item.game ?? "")} · ${String(item.reported_result ?? item.status ?? "")}`
    : `${playerName("scanner_id")} → ${playerName("receiver_id")} · ${String(item.base_points ?? 0)} points`;
  const createdAt = displayDate(item.created_at);
  const actions = type === "reports" || type === "submissions" || type === "conflicts"
    ? [["Approve", "approved"], ["Reject", "rejected"]] as const
    : type === "challenges" ? [["Cancel challenge", "cancelled"]] as const
    : [["Void scan", "voided"]] as const;
  return <article className="warden-review-item"><div><strong>{summary}</strong><div className="warden-review-meta">{createdAt}{item.game_day ? ` · day ${String(item.game_day)}` : ""}{item.proof_url ? <a href={String(item.proof_url)} target="_blank" rel="noreferrer"> · open proof</a> : ""}</div></div>
    <div className="warden-inline-actions">{actions.map(([label, status]) => <button key={status} className={`warden-mini-action ${status === "rejected" || status === "voided" || status === "cancelled" ? "warden-mini-danger" : ""}`} type="button" onClick={() => void onModerate(type.slice(0, -1), id, status)}>{label}</button>)}</div>
  </article>;
}
