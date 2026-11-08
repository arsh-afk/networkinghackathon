"use client";

import Link from "next/link";
import { useState } from "react";
import { TabBar } from "@/components/TabBar";

type Connection = {
  id: string;
  display_name: string;
  role: string;
  badge_code: string;
  descriptor?: string;
};

function getRoleVar(role: string) {
  const r = role?.toLowerCase();
  if (["artificer", "broker", "weaver", "patron"].includes(r)) return `var(--${r})`;
  return "var(--brass)";
}

export default function NetworkClient({ connections }: { connections: Connection[] }) {
  const [filter, setFilter] = useState<string>("all");

  const roles = ["all", "artificer", "broker", "weaver", "patron"];
  const filtered = filter === "all" ? connections : connections.filter(c => c.role.toLowerCase() === filter);

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
      <header style={{ padding: "16px 20px", borderBottom: "var(--stroke)" }}>
        <h1 className="font-display text-label text-brass" style={{ letterSpacing: "0.1em" }}>
          YOUR NETWORK ({connections.length})
        </h1>
      </header>

      {/* Role filter pills */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "12px 20px",
          overflowX: "auto",
          borderBottom: "var(--stroke)",
        }}
        role="tablist"
      >
        {roles.map((r) => {
          const isSelected = filter === r;
          const count = r === "all" ? connections.length : connections.filter(c => c.role.toLowerCase() === r).length;
          return (
            <button
              key={r}
              onClick={() => setFilter(r)}
              role="tab"
              aria-selected={isSelected}
              style={{
                minHeight: 32,
                padding: "0 12px",
                borderRadius: "var(--r-pill)",
                border: "none",
                background: isSelected ? "var(--ink-800)" : "transparent",
                color: isSelected ? "var(--paper)" : "var(--muted)",
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontFamily: "var(--font-ui)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {r !== "all" && (
                <span
                  style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: getRoleVar(r),
                    display: "inline-block",
                  }}
                />
              )}
              {r} {count > 0 && <span className="font-num" style={{ opacity: 0.6 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ padding: "12px 20px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 20px" }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◎</div>
            <p style={{ color: "var(--muted)", fontSize: 15, marginBottom: 8 }}>
              No threads yet.
            </p>
            <p style={{ color: "var(--faint)", fontSize: 13, marginBottom: 24 }}>
              That is what the room is for. Scan a badge to connect.
            </p>
            <Link href="/scan" className="btn btn-primary">
              Scan a badge
            </Link>
          </div>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            {filtered.map((c, i) => {
              const roleColor = getRoleVar(c.role);
              return (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderBottom: i < filtered.length - 1 ? "var(--stroke)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: roleColor,
                        flexShrink: 0,
                      }}
                      aria-label={c.role}
                    />
                    <div>
                      <div style={{ fontSize: 15, color: "var(--paper)" }}>{c.display_name}</div>
                      {c.descriptor && (
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>
                          {c.descriptor}
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    className="font-num"
                    style={{ fontSize: 13, color: "var(--faint)", letterSpacing: "0.1em" }}
                  >
                    {c.badge_code.slice(0, 3)} {c.badge_code.slice(3)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <TabBar />
    </main>
  );
}

