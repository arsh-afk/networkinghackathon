"use client";

import { useState, useEffect } from "react";

type LeaderPlayer = {
  rank: number;
  id: string;
  name: string;
  role: string;
  score: number;
  scans: number;
};

type ArenaData = {
  top10: LeaderPlayer[];
  stats: {
    totalMarks: number;
    uniqueConnections: number;
    activeAgents: number;
  };
  factionTotals: {
    artificer: number;
    broker: number;
    weaver: number;
    patron: number;
  };
  updatedAt: string;
};

export default function ArenaClient() {
  const [data, setData] = useState<ArenaData | null>(null);
  const [time, setTime] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/arena");
      if (res.ok) {
        const json = await res.json();
        if (json.ok) setData(json);
      }
    } catch {
      // Keep existing data on transient network hiccups
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Dubai",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date())
      );
    };
    updateTime();
    const tInterval = setInterval(updateTime, 1000);
    return () => clearInterval(tInterval);
  }, []);

  const totalFactionPts = data
    ? data.factionTotals.artificer +
      data.factionTotals.broker +
      data.factionTotals.weaver +
      data.factionTotals.patron
    : 0;

  const getFactionPct = (pts: number) => {
    if (totalFactionPts === 0) return 25;
    return Math.max(4, Math.round((pts / totalFactionPts) * 100));
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--ink-950)",
        color: "var(--paper)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "32px 48px",
        fontFamily: "var(--font-ui)",
        userSelect: "none",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          paddingBottom: 24,
          borderBottom: "1px solid var(--line-brass)",
        }}
      >
        <div>
          <div
            className="font-display text-label text-brass"
            style={{ fontSize: 13, letterSpacing: "0.2em", marginBottom: 6 }}
          >
            THE ARENA &bull; LIVE REPUTATION STANDINGS
          </div>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(28px, 3.5vw, 44px)",
              letterSpacing: "0.06em",
              lineHeight: 1,
            }}
          >
            THE SYNDICATE ACCORD
          </h1>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="font-num text-brass" style={{ fontSize: 32, lineHeight: 1 }}>
            {time || "20:00:00"}
          </div>
          <div className="text-label text-muted" style={{ marginTop: 4 }}>
            ASIA/DUBAI &bull; LIVE FEED
          </div>
        </div>
      </header>

      {/* Main Leaderboard Table */}
      <div style={{ flex: 1, margin: "24px 0", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className="card" style={{ overflow: "hidden", border: "1px solid var(--line)" }}>
          {(!data || data.top10.length === 0) ? (
            <div style={{ padding: "64px 24px", textAlign: "center" }}>
              <div className="font-display" style={{ fontSize: 24, color: "var(--muted)", marginBottom: 8 }}>
                THE ARENA IS AWAITING FIRST MARKS
              </div>
              <p className="text-faint">
                Scan participant badges in the room to claim rank on the projector display.
              </p>
            </div>
          ) : (
            data.top10.map((player) => {
              const roleKey = player.role.toLowerCase();
              return (
                <div
                  key={player.id}
                  className={`leader-row ${roleKey}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 140px 1fr 140px",
                    alignItems: "center",
                    gap: 20,
                    padding: "12px 24px",
                    minHeight: 52,
                    borderBottom: "1px solid rgba(35,40,51,0.6)",
                  }}
                >
                  {/* Rank */}
                  <span
                    className="font-num"
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: player.rank <= 3 ? "var(--brass)" : "var(--muted)",
                    }}
                  >
                    #{player.rank}
                  </span>

                  {/* Faction Pill */}
                  <span className={`faction-chip ${roleKey}`}>
                    {player.role}
                  </span>

                  {/* Name */}
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 600,
                      color: "var(--paper)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {player.name}
                  </span>

                  {/* Score */}
                  <div style={{ textAlign: "right" }}>
                    <span
                      className="font-num"
                      style={{
                        fontSize: 26,
                        fontWeight: 700,
                        color: "var(--brass)",
                      }}
                    >
                      {player.score.toFixed(0)}
                    </span>
                    <span className="text-faint" style={{ fontSize: 13, marginLeft: 6 }}>
                      pts
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer / Stats Bar */}
      <footer>
        {/* Faction Distribution Bar */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              marginBottom: 8,
              letterSpacing: "0.08em",
            }}
          >
            <span style={{ color: "var(--artificer)" }}>
              ARTIFICER: {data?.factionTotals.artificer ?? 0}
            </span>
            <span style={{ color: "var(--broker)" }}>
              BROKER: {data?.factionTotals.broker ?? 0}
            </span>
            <span style={{ color: "var(--weaver)" }}>
              WEAVER: {data?.factionTotals.weaver ?? 0}
            </span>
            <span style={{ color: "var(--patron)" }}>
              PATRON: {data?.factionTotals.patron ?? 0}
            </span>
          </div>

          <div
            style={{
              height: 10,
              borderRadius: 5,
              background: "var(--ink-800)",
              display: "flex",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${getFactionPct(data?.factionTotals.artificer ?? 0)}%`,
                background: "var(--artificer)",
                transition: "width 500ms ease",
              }}
            />
            <div
              style={{
                width: `${getFactionPct(data?.factionTotals.broker ?? 0)}%`,
                background: "var(--broker)",
                transition: "width 500ms ease",
              }}
            />
            <div
              style={{
                width: `${getFactionPct(data?.factionTotals.weaver ?? 0)}%`,
                background: "var(--weaver)",
                transition: "width 500ms ease",
              }}
            />
            <div
              style={{
                width: `${getFactionPct(data?.factionTotals.patron ?? 0)}%`,
                background: "var(--patron)",
                transition: "width 500ms ease",
              }}
            />
          </div>
        </div>

        {/* Global Live Tally */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 20,
            padding: "16px 24px",
            background: "var(--ink-900)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-card)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div className="text-label text-muted" style={{ marginBottom: 4 }}>
              LIVE MARKS INITIATED
            </div>
            <div className="font-num text-brass" style={{ fontSize: 28, lineHeight: 1 }}>
              {data?.stats.totalMarks ?? 0}
            </div>
          </div>
          <div style={{ textAlign: "center", borderLeft: "var(--stroke)", borderRight: "var(--stroke)" }}>
            <div className="text-label text-muted" style={{ marginBottom: 4 }}>
              CONFIRMED THREADS
            </div>
            <div className="font-num text-brass" style={{ fontSize: 28, lineHeight: 1 }}>
              {data?.stats.uniqueConnections ?? 0}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="text-label text-muted" style={{ marginBottom: 4 }}>
              FACTIONS ACTIVE
            </div>
            <div className="font-num text-brass" style={{ fontSize: 28, lineHeight: 1 }}>
              4 / 4
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

