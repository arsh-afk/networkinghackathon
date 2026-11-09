"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";
type CharacterInvitation = {
  fullName: string;
  roleName: string;
  title: string;
  tagline: string;
  originStory: string;
  speciality: string;
  motto: string;
  traits: string[];
  fieldOfStudy: string;
  year: string;
  badgeCode: string;
};

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [email, setEmail] = useState("");
  const [character, setCharacter] = useState<CharacterInvitation | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("invite");
    if (!token) return;

    setMode("register");
    setInviteToken(token);
    setInviteLoading(true);
    window.history.replaceState(window.history.state, "", "/login?mode=register");

    fetch("/api/auth/character", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite: token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.code || "This character link is invalid.");
        setEmail(data.email);
        setCharacter(data.character as CharacterInvitation);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not verify the character link.");
      })
      .finally(() => setInviteLoading(false));
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (mode === "register" && (!inviteToken || !character)) {
      setError("Open the registration link shared with you by a game warden first.");
      return;
    }
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    if (mode === "register") payload.inviteToken = inviteToken;

    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message || data.code || "Authentication failed.");
        return;
      }
      if (mode === "register") {
        router.push("/welcome");
      } else {
        router.push("/deck");
      }
    } catch {
      setError("Could not reach the ledger. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      {/* Logo area */}
      <div className="login-brand">
        <div
          className="font-display"
          style={{
            fontSize: 11,
            letterSpacing: "0.3em",
            color: "var(--muted)",
            marginBottom: 12,
          }}
        >
          AURAK · NOV 2026
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(28px, 8vw, 48px)",
            color: "var(--paper)",
            lineHeight: 1.1,
            marginBottom: 8,
          }}
        >
          THE SYNDICATE<br />ACCORD
        </h1>
        <div className="brass-rule" style={{ width: 180, margin: "16px auto" }} aria-hidden="true" />
        <p style={{ fontSize: 14, color: "var(--muted)", maxWidth: 320 }}>
          {mode === "login"
            ? "The ledger knows you. Take your mark."
            : "Register your name in the ledger."}
        </p>
      </div>

      {/* Card */}
      <div
        className="card login-card"
      >
        {inviteLoading && (
          <div role="status" style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16 }}>
            Verifying your character invitation…
          </div>
        )}

        {character && mode === "register" && (
          <section className="card character-invitation" aria-label="Your character dossier">
            <div className="text-label text-brass" style={{ marginBottom: 8 }}>
              YOUR CHARACTER · #{character.badgeCode}
            </div>
            <h2 className="font-display" style={{ fontSize: 20, marginBottom: 4 }}>
              {character.fullName}
            </h2>
            <p style={{ color: "var(--brass)", fontSize: 13, marginBottom: 10 }}>
              {character.roleName} · {character.title}
            </p>
            <p style={{ color: "var(--paper-dim)", fontSize: 13, lineHeight: 1.5 }}>
              {character.originStory}
            </p>
          </section>
        )}

        {/* Mode toggle */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginBottom: 24,
            background: "var(--ink-800)",
            borderRadius: "var(--r-in)",
            padding: 3,
          }}
        >
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1,
                minHeight: 44,
                border: "none",
                borderRadius: "calc(var(--r-in) - 2px)",
                background: mode === m ? "var(--ink-850)" : "transparent",
                color: mode === m ? "var(--paper)" : "var(--muted)",
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                fontWeight: mode === m ? 500 : 400,
                cursor: "pointer",
                transition: "all var(--dur-1) var(--ease)",
              }}
            >
              {m === "login" ? "Sign in" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {mode === "register" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="text-label text-muted">Character name</span>
              <input
                name="displayName"
                className="input"
                required
                minLength={2}
                maxLength={40}
                placeholder="Your character name"
                autoComplete="name"
                value={character?.fullName ?? ""}
                readOnly
              />
            </label>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="text-label text-muted">AURAK email</span>
            <input
              name="email"
              type="email"
              className="input"
              required
              placeholder="you@aurak.ac.ae"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={mode === "register" && Boolean(character)}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="text-label text-muted">6-digit PIN</span>
            <input
              ref={pinRef}
              name="pin"
              className="input input-code"
              required
              inputMode="numeric"
              pattern="\d{6}"
              minLength={6}
              maxLength={6}
              placeholder="· · · · · ·"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </label>

          {error && (
            <div
              role="alert"
              style={{
                padding: "12px 16px",
                background: "rgba(229,72,77,0.1)",
                border: "1px solid rgba(229,72,77,0.3)",
                borderRadius: "var(--r-in)",
                color: "var(--error)",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          {mode === "register" && !inviteToken && (
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
              A game warden will share your character registration link with you. Open that link before creating your account.
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading || inviteLoading || (mode === "register" && !character)}
            style={{ marginTop: 4 }}
          >
            {loading ? "…" : mode === "login" ? "Enter the ledger" : "Register"}
          </button>
        </form>

        <p
          style={{
            marginTop: 20,
            fontSize: 12,
            color: "var(--faint)",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Your @aurak.ac.ae email is stored only for event management and deleted immediately after the event.
          Trouble? Find a game warden.
        </p>
      </div>
    </main>
  );
}
