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

export default function MeClient({
  player,
  character,
  characterError,
}: {
  player: Record<string, unknown>;
  character: Record<string, unknown> | null;
  characterError: boolean;
}) {
  const router = useRouter();
  const role = (player.role as string | undefined) ?? "artificer";
  const name = (player.display_name as string | undefined) ?? "Agent";
  const badgeCode = (player.badge_code as string | undefined) ?? "000000";
  const roleColor = getRoleVar(role);
  const roleLabel = getRoleLabel(role);
  const traits = Array.isArray(character?.traits)
    ? character.traits.filter((trait): trait is string => typeof trait === "string")
    : [];

  const badgePayload = `SA1|${badgeCode}|${name}|${role.charAt(0).toUpperCase()}`;
  const displayCode = `${badgeCode.slice(0, 3)} ${badgeCode.slice(3)}`;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main
      className="app-screen"
    >
      {/* Header */}
      <header style={{ borderBottom: "var(--stroke)" }}>
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

        {character && (
          <section className="card character-dossier" aria-labelledby="character-heading">
            <div className="text-label text-brass" style={{ marginBottom: 8 }}>
              YOUR CHARACTER · #{String(character.badgeCode ?? badgeCode)}
            </div>
            <h2 id="character-heading" className="font-display" style={{ fontSize: 21, marginBottom: 8 }}>
              {String(character.title ?? roleLabel)}
            </h2>
            <p style={{ color: "var(--brass)", fontSize: 13, marginBottom: 14 }}>
              {String(character.roleName ?? roleLabel)} · {String(character.fieldOfStudy ?? "")} · {String(character.year ?? "")}
            </p>
            <p style={{ color: "var(--paper-dim)", fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>
              {String(character.originStory ?? "")}
            </p>
            <div style={{ borderTop: "var(--stroke)", paddingTop: 14 }}>
              <div className="text-label text-muted" style={{ marginBottom: 6 }}>Speciality</div>
              <p style={{ color: "var(--paper-dim)", fontSize: 14, marginBottom: 14 }}>
                {String(character.speciality ?? "")}
              </p>
              {traits.length > 0 && (
                <>
                  <div className="text-label text-muted" style={{ marginBottom: 8 }}>Traits</div>
                  <ul style={{ listStyle: "none", display: "grid", gap: 8, marginBottom: 14 }}>
                    {traits.map((trait) => (
                      <li key={trait} style={{ color: "var(--paper-dim)", fontSize: 14 }}>◆ {trait}</li>
                    ))}
                  </ul>
                </>
              )}
              <div className="text-label text-muted" style={{ marginBottom: 6 }}>Faction motto</div>
              <p style={{ color: "var(--paper-dim)", fontSize: 14, fontStyle: "italic" }}>
                “{String(character.motto ?? "")}”
              </p>
            </div>
          </section>
        )}

        {characterError && (
          <section className="card" role="status" style={{ padding: 14, marginBottom: 20 }}>
            <p style={{ color: "var(--warning)", fontSize: 13 }}>
              Your character dossier could not be loaded. Please try again later or contact a game warden.
            </p>
          </section>
        )}

        {!character && !characterError && (
          <section className="card" style={{ padding: 14, marginBottom: 20 }}>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>
              Your character dossier is not available yet. Contact a game warden if this seems incorrect.
            </p>
          </section>
        )}

        {/* Privacy note */}
        <section className="card" style={{ padding: "14px 16px", marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            Your AURAK email and generated character dossier are stored for account access and event management. Ask a game warden about data deletion after the event.
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
