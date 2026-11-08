"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { TabBar } from "@/components/TabBar";

function getRoleVar(role: string) {
  const r = role?.toLowerCase();
  if (["artificer", "broker", "weaver", "patron"].includes(r)) return `var(--${r})`;
  return "var(--brass)";
}

function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    artificer: "Artificer", broker: "Broker", weaver: "Weaver", patron: "Patron",
  };
  return map[role?.toLowerCase()] ?? role;
}

function QRDisplay({ payload }: { payload: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 240,
      margin: 2,
      color: { dark: "#07080B", light: "#F2EEE6" },
    }).catch(() => {});
  }, [payload]);

  return (
    <div
      style={{
        background: "var(--paper)",
        padding: 16,
        borderRadius: 12,
        display: "inline-flex",
        cursor: "pointer",
      }}
      onClick={() => {
        // Wake lock + full brightness for scanning
        document.documentElement.requestFullscreen?.().catch(() => {});
      }}
      title="Tap for full brightness"
    >
      <canvas ref={canvasRef} width={240} height={240} aria-label="Your badge QR code" />
    </div>
  );
}

export default function MeClient({ player }: { player: Record<string, unknown> }) {
  const router = useRouter();
  const role = (player.role as string | undefined) ?? "artificer";
  const name = (player.display_name as string | undefined) ?? "Agent";
  const badgeCode = (player.badge_code as string | undefined) ?? "000000";
  const roleColor = getRoleVar(role);
  const roleLabel = getRoleLabel(role);

  const badgePayload = `SA1|${badgeCode}|${name}|${role.charAt(0).toUpperCase()}`;
  const displayCode = `${badgeCode.slice(0, 3)} ${badgeCode.slice(3)}`;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

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
          YOUR PROFILE
        </h1>
      </header>

      <div style={{ padding: "24px 20px" }}>
        {/* Identity card */}
        <section className="card" style={{ padding: 24, marginBottom: 24, borderLeft: `3px solid ${roleColor}`, textAlign: "center" }}>
          <div className="text-label" style={{ color: roleColor, marginBottom: 8, letterSpacing: "0.15em" }}>
            {roleLabel.toUpperCase()}
          </div>
          <div style={{ fontSize: 26, color: "var(--paper)", marginBottom: 20 }}>{name}</div>

          {/* QR code */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <QRDisplay payload={badgePayload} />
          </div>

          {/* Badge code display */}
          <div
            className="font-num"
            style={{ fontSize: 28, color: "var(--paper)", letterSpacing: "0.3em", marginBottom: 4 }}
            aria-label={`Badge code: ${displayCode}`}
          >
            {displayCode}
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", letterSpacing: "0.08em" }}>
            {badgePayload}
          </div>
        </section>

        {/* Privacy note */}
        <section className="card" style={{ padding: "14px 16px", marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            Your @aurak.ac.ae email is stored only for event management and will be deleted immediately after the event ends on 2026-11-23.
            No character data or personal history is retained.
          </p>
        </section>

        {/* Sign out */}
        <button className="btn btn-secondary btn-full" onClick={logout}>
          Sign out
        </button>
      </div>

      {/* Tab bar */}
      <TabBar />
    </main>
  );
}

