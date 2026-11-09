"use client";

import Link from "next/link";
import { useState } from "react";
import { TabBar } from "@/components/TabBar";

type ScanEntry = {
  id: string;
  base_points: number;
  receiver_name: string;
  receiver_role: string;
  via: string;
  created_at: string;
  tier_mult: number;
  weighted_points: number;
};

type Props = {
  player: Record<string, unknown>;
  daysMap: Record<string, ScanEntry[]>;
  totalScanPts: number;
  totalReceivedPts: number;
  taskPts: number;
};

export default function LedgerClient({
  player,
  daysMap,
  totalScanPts,
  totalReceivedPts,
  taskPts,
}: Props) {
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>(() => {
    // Expand all days by default
    const init: Record<string, boolean> = {};
    Object.keys(daysMap).forEach((k) => {
      init[k] = true;
    });
    return init;
  });

  const grandTotal = Math.round((totalScanPts + totalReceivedPts + taskPts) * 100) / 100;
  const days = Object.keys(daysMap).sort().reverse();

  const toggleDay = (d: string) => {
    setExpandedDays((prev) => ({ ...prev, [d]: !prev[d] }));
  };

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
            THE AUDIT LEDGER
          </h1>
        </div>
        <span className="font-num text-sm text-brass">{player.badge_code as string}</span>
      </header>

      <div style={{ padding: "20px 20px" }}>
        {/* Receipt summary card */}
        <section
          className="card"
          style={{
            padding: "20px",
            marginBottom: 24,
            border: "1px solid var(--line-brass)",
            background: "linear-gradient(180deg, #14171F 0%, #0E1015 100%)",
          }}
        >
          <div
            className="text-label text-muted"
            style={{ marginBottom: 16, letterSpacing: "0.12em" }}
          >
            OFFICIAL TALLY &bull; AUDIT RECEIPT
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, borderBottom: "var(--stroke)", paddingBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, color: "var(--paper-dim)" }}>Initiated marks (weighted)</span>
              <span className="font-num" style={{ fontSize: 16, color: "var(--paper)" }}>
                {totalScanPts.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, color: "var(--paper-dim)" }}>Received marks (+1 each, capped)</span>
              <span className="font-num" style={{ fontSize: 16, color: "var(--paper)" }}>
                +{totalReceivedPts.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, color: "var(--paper-dim)" }}>Patron Touch bonuses</span>
              <span className="font-num" style={{ fontSize: 16, color: "var(--paper)" }}>
                +{taskPts.toFixed(2)}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingTop: 16,
            }}
          >
            <span className="font-display" style={{ fontSize: 14, color: "var(--brass)" }}>
              TOTAL REPUTATION
            </span>
            <span className="font-num" style={{ fontSize: 32, color: "var(--brass)" }}>
              {grandTotal.toFixed(2)}
            </span>
          </div>
        </section>

        {/* Days list */}
        <h2 className="text-label text-muted" style={{ marginBottom: 12 }}>
          CHRONOLOGICAL AUDIT TRAIL
        </h2>

        {days.length === 0 ? (
          <div className="card" style={{ padding: "32px 20px", textAlign: "center" }}>
            <p style={{ color: "var(--muted)", fontSize: 15, marginBottom: 4 }}>
              The ledger is blank.
            </p>
            <p style={{ color: "var(--faint)", fontSize: 13 }}>
              Your verified interactions will be listed here with exact arithmetic.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {days.map((day) => {
              const scans = daysMap[day] ?? [];
              const isExpanded = expandedDays[day];
              const daySubtotal = scans.reduce((acc, s) => acc + s.weighted_points, 0);

              return (
                <div key={day} className="card" style={{ overflow: "hidden" }}>
                  <button
                    onClick={() => toggleDay(day)}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      background: "none",
                      border: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      borderBottom: isExpanded ? "var(--stroke)" : "none",
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <span className="font-num text-sm text-paper" style={{ fontWeight: 600 }}>
                        {day}
                      </span>
                      <span className="text-faint text-sm" style={{ marginLeft: 8 }}>
                        ({scans.length} {scans.length === 1 ? "mark" : "marks"})
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span className="font-num" style={{ fontSize: 15, color: "var(--brass)" }}>
                        +{daySubtotal.toFixed(2)}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div>
                      {scans.map((s, idx) => (
                        <div
                          key={s.id}
                          style={{
                            padding: "12px 16px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottom: idx < scans.length - 1 ? "var(--stroke)" : "none",
                            background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="font-num text-faint" style={{ fontSize: 12 }}>
                                #{idx + 1}
                              </span>
                              <span style={{ fontSize: 14, color: "var(--paper)" }}>
                                {s.receiver_name}
                              </span>
                              <span
                                className="text-label"
                                style={{
                                  fontSize: 10,
                                  color: `var(--${s.receiver_role.toLowerCase()}, var(--muted))`,
                                }}
                              >
                                {s.receiver_role}
                              </span>
                            </div>
                            <div className="font-num text-faint" style={{ fontSize: 11, marginTop: 2 }}>
                              Base {s.base_points} &times; tier {s.tier_mult.toFixed(2)}
                            </div>
                          </div>
                          <span className="font-num" style={{ fontSize: 15, color: "var(--brass)" }}>
                            +{s.weighted_points.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TabBar />
    </main>
  );
}
