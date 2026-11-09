"use client";

import { FormEvent, useEffect, useState } from "react";
import AdminDashboard from "./AdminDashboard";

type AdminUser = { id: string; username: string; display_name?: string | null };

export default function WardenClient({ portalSecret }: { portalSecret: string }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok && active && data.admin) setAdmin(data.admin);
      })
      .catch(() => {
        if (active) setError("Could not verify the administrator session. Refresh to try again.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ portalSecret, username: email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Sign-in failed.");
      setAdmin(data.admin);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/admin/login", { method: "DELETE" });
      setAdmin(null);
    } catch {
      setError("Could not end the administrator session. Please try again.");
    }
  }

  if (checking) {
    return <main className="app-shell"><section className="warden-panel"><div className="card warden-empty">Checking secure session…</div></section></main>;
  }
  if (admin) return <AdminDashboard admin={admin} onLogout={logout} />;

  return (
    <main className="app-shell">
      <section className="warden-panel">
        <header className="warden-header-row">
          <div><p className="eyebrow">Game warden access</p><h1 className="page-title">Operations console</h1></div>
          <span className="warden-status">Private admin portal</span>
        </header>
        <form className="card warden-login-card" onSubmit={login}>
          <label className="warden-label" htmlFor="warden-email">Administrator username</label>
          <input id="warden-email" className="warden-input" type="text" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label className="warden-label" htmlFor="warden-password">Password</label>
          <input id="warden-password" className="warden-input" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p className="warden-message error-text" role="alert">{error}</p>}
          <button className="warden-action warden-action-primary" type="submit" disabled={busy}>{busy ? "Verifying…" : "Enter operations console"}</button>
        </form>
        <footer className="warden-footer">Access is monitored and administrative actions are recorded.</footer>
      </section>
    </main>
  );
}
