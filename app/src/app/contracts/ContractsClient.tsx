"use client";

import Link from "next/link";
import { ProgressRing } from "@/components/ProgressRing";
import { TabBar } from "@/components/TabBar";

type Props = {
  player: Record<string, unknown>;
  dailyScanCount: number;
  otherRolesToday: number;
  patronScansCount: number;
};

export default function ContractsClient({
  player,
  dailyScanCount,
  otherRolesToday,
  patronScansCount,
}: Props) {
  const role = (player.role as string)?.toLowerCase() ?? "artificer";

  // Daily Tasks
  const dailyTasks = [
    {
      id: "daily-cross",
      title: "Daily Cross",
      desc: "Connect with ≥2 different non-own roles today.",
      points: "+6",
      current: Math.min(otherRolesToday, 2),
      max: 2,
      done: otherRolesToday >= 2,
    },
    {
      id: "patron-touch",
      title: "Patron Touch",
      desc: "Scan a Patron (first 3 patron scans of the week).",
      points: "+3 each",
      current: Math.min(patronScansCount, 3),
      max: 3,
      done: patronScansCount >= 3,
    },
    {
      id: "echo-note",
      title: "Echo Note",
      desc: "Exchange mutual notes with a connected partner.",
      points: "+3 p.p.",
      current: 0,
      max: 5,
      done: false,
    },
  ];

  // Weekly Tasks
  const weeklyTasks = [
    {
      id: "role-call",
      title: "Role Call",
      desc: "Connect with all 3 other factions at least once.",
      points: "+10",
      current: Math.min(otherRolesToday, 3),
      max: 3,
      done: otherRolesToday >= 3,
    },
    {
      id: "triple-thread",
      title: "Triple Thread",
      desc: "Form a closed triangle where all 3 members are connected.",
      points: "+4 each",
      current: 0,
      max: 3,
      done: false,
    },
    {
      id: "game-challenger",
      title: "Game Commander",
      desc: "Play 3 confirmed mini-games against distinct opponents in one day.",
      points: "+10",
      current: 0,
      max: 3,
      done: false,
    },
  ];

  const weekendTasks = [
    { title: "Account Activation", pts: "+15" },
    { title: "Syndicate Signal", pts: "+12" },
    { title: "Targeted Connect", pts: "+10" },
    { title: "Value Post", pts: "+14" },
    { title: "Cross-Circle Comment", pts: "+9" },
    { title: "Patron Reach", pts: "+8" },
  ];

  return (
    <main
      className="app-screen"
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "var(--stroke)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/deck" className="btn btn-ghost" style={{ minHeight: 36, padding: "0 8px" }}>
            ←
          </Link>
          <h1 className="font-display text-label text-brass" style={{ letterSpacing: "0.1em" }}>
            CONTRACTS &amp; TASKS
          </h1>
        </div>
        <span className="font-num text-sm text-brass">{dailyScanCount} marks today</span>
      </header>

      <div style={{ padding: "20px 20px" }}>
        {/* Daily Section */}
        <section style={{ marginBottom: 24 }}>
          <h2 className="text-label text-muted" style={{ marginBottom: 12 }}>
            DAILY DIRECTIVES
          </h2>
          <div className="card" style={{ overflow: "hidden" }}>
            {dailyTasks.map((t, idx) => (
              <div
                key={t.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px",
                  borderBottom: idx < dailyTasks.length - 1 ? "var(--stroke)" : "none",
                }}
              >
                <ProgressRing
                  value={t.current}
                  max={t.max}
                  faction={role}
                  size={44}
                />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, color: "var(--paper)", fontWeight: 500 }}>
                      {t.title}
                    </span>
                    {t.done && (
                      <span className="text-label" style={{ color: "var(--broker)" }}>
                        ✓ DONE
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2, lineHeight: 1.3 }}>
                    {t.desc}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="font-num" style={{ fontSize: 16, color: "var(--brass)" }}>
                    {t.points}
                  </div>
                  <div className="font-num text-faint" style={{ fontSize: 12, marginTop: 2 }}>
                    {t.current}/{t.max}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Weekly Section */}
        <section style={{ marginBottom: 24 }}>
          <h2 className="text-label text-muted" style={{ marginBottom: 12 }}>
            WEEKLY COVENANTS
          </h2>
          <div className="card" style={{ overflow: "hidden" }}>
            {weeklyTasks.map((t, idx) => (
              <div
                key={t.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px",
                  borderBottom: idx < weeklyTasks.length - 1 ? "var(--stroke)" : "none",
                }}
              >
                <ProgressRing
                  value={t.current}
                  max={t.max}
                  faction={role}
                  size={44}
                />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, color: "var(--paper)", fontWeight: 500 }}>
                      {t.title}
                    </span>
                    {t.done && (
                      <span className="text-label" style={{ color: "var(--broker)" }}>
                        ✓ DONE
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2, lineHeight: 1.3 }}>
                    {t.desc}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="font-num" style={{ fontSize: 16, color: "var(--brass)" }}>
                    {t.points}
                  </div>
                  <div className="font-num text-faint" style={{ fontSize: 12, marginTop: 2 }}>
                    {t.current}/{t.max}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Weekend Track - Locked */}
        <section style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <h2 className="text-label text-muted">WEEKEND SYNDICATE TRACK</h2>
            <span
              className="text-label"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "var(--patron)",
                background: "rgba(240,199,102,0.1)",
                padding: "2px 8px",
                borderRadius: "var(--r-chip)",
              }}
            >
              🔒 OPENS NOV 21 (SAT 00:00)
            </span>
          </div>

          <div
            className="card"
            style={{
              padding: "20px",
              border: "1px dashed rgba(216,180,90,0.3)",
              background: "rgba(20,23,31,0.6)",
            }}
          >
            <p style={{ fontSize: 14, color: "var(--paper-dim)", marginBottom: 16, lineHeight: 1.4 }}>
              The weekend track opens for external networking proof, LinkedIn connection signals, and community verification. Maximum yield: <strong>+68 points</strong>.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {weekendTasks.map((wt) => (
                <div
                  key={wt.title}
                  style={{
                    padding: "10px 12px",
                    background: "var(--ink-850)",
                    borderRadius: "var(--r-chip)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: 0.7,
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--paper)" }}>{wt.title}</span>
                  <span className="font-num" style={{ fontSize: 13, color: "var(--brass)" }}>
                    {wt.pts}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <TabBar />
    </main>
  );
}
