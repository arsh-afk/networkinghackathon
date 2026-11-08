"use client";

import { useState } from "react";
import Link from "next/link";
import { RoleSigil } from "@/components/RoleSigil";

type Player = {
  display_name?: string;
  role?: string;
  descriptor?: string;
  badge_code?: string;
};

const FLAVOUR: Record<string, { title: string; desc: string }> = {
  artificer: {
    title: "Artificer",
    desc: "Builder of systems, mechanics and structure.",
  },
  broker: {
    title: "Broker",
    desc: "Negotiator of trades, balances and alliances.",
  },
  weaver: {
    title: "Weaver",
    desc: "Crafter of narratives, symbols and feeling.",
  },
  patron: {
    title: "Patron",
    desc: "Provider of resources, vision and guidance.",
  },
};

export default function WelcomeClient({ player }: { player: Player }) {
  const [flipped, setFlipped] = useState(false);
  const role = (player.role?.toLowerCase() ?? "artificer");
  const name = player.display_name ?? "Agent";
  const flavour = FLAVOUR[role] ?? FLAVOUR.artificer;
  const badgeCode = player.badge_code ?? "000000";
  const displayCode = `${badgeCode.slice(0, 3)} ${badgeCode.slice(3)}`;

  const handleFlip = () => {
    if (!flipped) {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([10, 40, 10]);
      }
      setFlipped(true);
    }
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--ink-950)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
        perspective: 1200,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <span className="font-display text-label text-brass" style={{ letterSpacing: "0.2em" }}>
          THE SYNDICATE ACCORD
        </span>
        <h1 className="font-display" style={{ fontSize: 24, marginTop: 4, color: "var(--paper)" }}>
          {flipped ? "YOUR DESIGNATION" : "YOUR SUMMONS"}
        </h1>
      </div>

      {/* 3D Flip Card Container */}
      <div
        onClick={handleFlip}
        style={{
          width: "min(340px, 88vw)",
          aspectRatio: "4 / 5",
          cursor: flipped ? "default" : "pointer",
          position: "relative",
          transformStyle: "preserve-3d",
          transition: "transform 700ms cubic-bezier(.2,.8,.2,1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
        aria-label={flipped ? `Revealed role: ${flavour.title}` : "Tap to reveal role"}
      >
        {/* Front of card */}
        <div
          className="card"
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "36px 24px",
            border: "1px solid var(--brass-deep)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.8), inset 0 0 40px rgba(216,180,90,0.06)",
            textAlign: "center",
          }}
        >
          <div className="font-display text-label text-brass">CONFIDENTIAL</div>

          <div>
            <div
              className="font-display"
              style={{
                fontSize: 28,
                color: "var(--paper)",
                letterSpacing: "0.08em",
                marginBottom: 12,
              }}
            >
              {name.toUpperCase()}
            </div>
            <div className="brass-rule" style={{ width: 140, margin: "16px auto" }} />
            <p className="text-muted text-sm">
              Tap to unveil your allegiance and claim your signature in the ledger.
            </p>
          </div>

          <div
            className="btn btn-secondary"
            style={{ minHeight: 40, fontSize: 13, pointerEvents: "none" }}
          >
            Tap to Reveal
          </div>
        </div>

        {/* Back of card */}
        <div
          className="card"
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "32px 24px",
            border: `1px solid var(--${role})`,
            boxShadow: `0 12px 40px rgba(0,0,0,0.8), inset 0 0 50px var(--${role}-glow, rgba(0,0,0,0.2))`,
            textAlign: "center",
          }}
        >
          <div className="text-label" style={{ color: `var(--${role})`, letterSpacing: "0.15em" }}>
            SIGNATURE VERIFIED
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ marginBottom: 16 }}>
              <RoleSigil role={role} size={64} />
            </div>

            <div
              className="font-display"
              style={{
                fontSize: 26,
                color: `var(--${role})`,
                letterSpacing: "0.1em",
                marginBottom: 8,
              }}
            >
              {flavour.title.toUpperCase()}
            </div>

            <p style={{ fontSize: 14, color: "var(--paper)", marginBottom: 8, lineHeight: 1.4 }}>
              &ldquo;{flavour.desc}&rdquo;
            </p>

            {player.descriptor && (
              <p style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", marginBottom: 12 }}>
                {player.descriptor}
              </p>
            )}

            <div
              className="font-num"
              style={{
                fontSize: 16,
                color: "var(--paper-dim)",
                letterSpacing: "0.2em",
                marginTop: 8,
              }}
            >
              MARK: {displayCode}
            </div>
          </div>

          <p style={{ fontSize: 11, color: "var(--faint)", lineHeight: 1.4 }}>
            Wear the badge. It is your signature for the week.
          </p>
        </div>
      </div>

      {/* Action buttons below card */}
      <div
        style={{
          marginTop: 28,
          width: "min(340px, 88vw)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          opacity: flipped ? 1 : 0,
          pointerEvents: flipped ? "auto" : "none",
          transition: "opacity 300ms ease",
        }}
      >
        <Link href="/deck" className="btn btn-primary btn-full">
          Enter the Ledger
        </Link>
      </div>
    </main>
  );
}

