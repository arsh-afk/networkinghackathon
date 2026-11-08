"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TabBar } from "@/components/TabBar";

type Props = {
  player: Record<string, unknown>;
  todayCount: number;
  totalPoints: number;
  totalConnections: number;
  gameDay: string;
};

function getRoleClass(role: string | undefined) {
  const r = (role ?? "").toLowerCase();
  if (["artificer","broker","weaver","patron"].includes(r)) return r;
  return "artificer";
}

function LadderMeter({ count }: { count: number }) {
  const filled = Math.min(count, 15);
  const tier = count < 8 ? "full" : count < 15 ? "half" : "quarter";
  const nextBoundary = count < 8 ? `· ${8 - count} until half value` : count < 15 ? `· ${15 - count} until quarter value` : "";
  return (
    <div>
      <div
        style={{ display: "flex", gap: 3 }}
        role="progressbar"
        aria-valuenow={count}
        aria-valuemax={15}
        aria-label={`${count} marks today`}
      >
        {Array.from({ length: 15 }, (_, i) => {
          const rungNum = i + 1;
          const isFilled = rungNum <= filled;
          const isCurrent = rungNum === filled && filled > 0;
          let bg = "var(--ink-800)";
          let opacity = 1;
          let outline = "none";
          if (isFilled) {
            bg = "var(--brass)";
            if (rungNum > 8) opacity = 0.55;
            if (isCurrent) outline = "2px solid var(--brass)";
          }
          return (
            <span
              key={i}
              style={{
                flex: 1, height: 6, borderRadius: 2,
                background: bg, opacity,
                outline, outlineOffset: 1,
              }}
            />
          );
        })}
      </div>
      <p style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
        {filled} marks today · {tier} value{nextBoundary}
      </p>
    </div>
  );
}

function FactionChip({ role }: { role: string }) {
  const r = getRoleClass(role);
  const labels: Record<string, string> = { artificer: "Artificer", broker: "Broker", weaver: "Weaver", patron: "Patron" };
  return (
    <span
      className={`faction-chip ${r}`}
      aria-label={`Role: ${labels[r] ?? role}`}
    >
      {labels[r] ?? role}
    </span>
  );
}

const TASKS = [
  { id: "daily-cross", label: "Daily Cross", desc: "2+ cross-faction scans of different roles", points: "+6", done: false },
  { id: "echo-note", label: "Echo Note", desc: "Both parties leave a note", points: "+3 each", done: false },
  { id: "patron-touch", label: "Patron Touch", desc: "Scan a Patron", points: "+3", done: false },
];

export default function DeckClient({ player, todayCount, totalPoints, totalConnections, gameDay }: Props) {
  const router = useRouter();
  const role = (player.role as string | undefined) ?? "artificer";
  const name = (player.display_name as string | undefined) ?? "Agent";
  const roleClass = getRoleClass(role);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const dayNum = (() => {
    try {
      const eventStart = new Date("2026-11-16");
      const today = new Date(gameDay);
      const diff = Math.floor((today.getTime() - eventStart.getTime()) / 86400_000);
      return diff >= 0 ? `D${diff + 1}` : "Pre-event";
    } catch { return ""; }
  })();

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--ink-950)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "var(--stroke)",
        }}
      >
        <span
          className="font-display text-label text-brass"
          style={{ letterSpacing: "0.1em" }}
        >
          THE SYNDICATE ACCORD
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="font-num text-sm text-brass">{dayNum}</span>
          <button
            onClick={logout}
            className="btn btn-ghost text-sm"
            style={{ minHeight: 36, padding: "0 12px" }}
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <div style={{ padding: "20px 20px 0" }}>

        {/* Score card */}
        <section
          className="card"
          style={{
            padding: "20px",
            marginBottom: 20,
            borderLeft: `3px solid var(--${roleClass})`,
          }}
          aria-label="Your score"
        >
          <div style={{ marginBottom: 12 }}>
            <FactionChip role={role} />
          </div>

          {/* Points hero */}
          <Link href="/ledger" style={{ display: "block", textDecoration: "none" }} title="View audit ledger">
            <div
              className="font-num text-hero"
              style={{ lineHeight: 1, marginBottom: 4 }}
              aria-label={`${totalPoints} points`}
            >
              {totalPoints}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span className="text-label text-muted">POINTS</span>
              <span className="text-sm text-brass" style={{ fontSize: 12 }}>Audit Ledger &rarr;</span>
            </div>
          </Link>

          {/* Rank placeholder */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, fontSize: 14, color: "var(--paper-dim)" }}>
            <span>{name}</span>
            <span className="text-muted">·</span>
            <span>{totalConnections} connections</span>
          </div>

          {/* Ladder meter */}
          <LadderMeter count={todayCount} />
        </section>

        {/* Today's tasks */}
        <section aria-label="Today's tasks" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingLeft: 4 }}>
            <h2 className="text-label text-muted">TODAY</h2>
            <Link href="/contracts" className="text-sm text-brass" style={{ fontSize: 12 }}>
              All contracts &rarr;
            </Link>
          </div>
          <Link href="/contracts" style={{ display: "block", textDecoration: "none" }}>
            <div className="card" style={{ overflow: "hidden" }}>
            {TASKS.map((task, idx) => (
              <div
                key={task.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  borderBottom: idx < TASKS.length - 1 ? "var(--stroke)" : "none",
                }}
              >
                <span
                  style={{
                    width: 20, height: 20, borderRadius: "50%",
                    border: `2px solid ${task.done ? "var(--broker)" : "var(--muted)"}`,
                    background: task.done ? "var(--broker)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, color: "var(--ink-900)",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  {task.done ? "✓" : ""}
                </span>
                <div>
                  <div style={{ fontSize: 15, color: "var(--paper)" }}>{task.label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{task.desc}</div>
                </div>
                <span className="font-num" style={{ fontSize: 15, color: "var(--brass)" }}>
                  {task.points}
                </span>
              </div>
            ))}
            </div>
          </Link>
        </section>

        {/* Brass divider */}
        <div className="brass-rule" aria-hidden="true" />

        {/* Quick links */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
          <Link
            href="/network"
            className="card"
            style={{ padding: "16px", textAlign: "center", display: "block" }}
          >
            <div className="font-num" style={{ fontSize: 24, color: "var(--brass)", lineHeight: 1 }}>
              {totalConnections}
            </div>
            <div className="text-label text-muted" style={{ marginTop: 4 }}>CONNECTIONS</div>
          </Link>
          <Link
            href="/contracts"
            className="card"
            style={{ padding: "16px", textAlign: "center", display: "block" }}
          >
            <div className="font-num" style={{ fontSize: 24, color: "var(--brass)", lineHeight: 1 }}>
              0
            </div>
            <div className="text-label text-muted" style={{ marginTop: 4 }}>TASKS DONE</div>
          </Link>
        </section>
      </div>

      {/* Sticky scan button */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(56px + env(safe-area-inset-bottom, 0px) + 12px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: "calc(100% - 40px)",
          maxWidth: 480,
          zIndex: 50,
        }}
      >
        <Link href="/scan" className="btn btn-primary btn-full" style={{ fontSize: 18, minHeight: 56 }}>
          ⌗ &nbsp; SCAN A BADGE
        </Link>
      </div>

      {/* Tab bar */}
      <TabBar />
    </main>
  );
}
