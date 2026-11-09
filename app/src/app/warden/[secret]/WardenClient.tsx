"use client";

import { useEffect, useState } from "react";

type Admin = { id: string; username: string; display_name?: string | null };
type Row = Record<string, unknown>;

export default function WardenClient({ portalSecret }: { portalSecret: string }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [msg, setMsg] = useState("");
  const [users, setUsers] = useState<Row[]>([]);
  const [conflicts, setConflicts] = useState<Row[]>([]);

  async function refresh() {
    const me = await fetch("/api/admin/me").then((r) => r.json()).catch(() => null);
    if (me?.ok) setAdmin(me.admin);
    else setAdmin(null);
    if (me?.ok) {
      const [u, c] = await Promise.all([fetch("/api/admin/users").then((r) => r.json()), fetch("/api/admin/conflicts").then((r) => r.json())]);
      if (u?.ok) setUsers(u.users || []);
      if (c?.ok) setConflicts(c.conflicts || []);
    }
  }
  useEffect(() => { refresh(); }, []);

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ portalSecret, username: fd.get("username"), password: fd.get("password") }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const messages: Record<string, string> = {
        NOT_FOUND: "The admin portal path is incorrect. Use the path configured in ADMIN_PORTAL_SECRET_PATH.",
        DB_NOT_CONFIGURED: "Supabase is not configured for this deployment. Add its URL and service-role key to the app's server environment.",
        ADMIN_DB_NOT_READY: "The admin database tables are missing or unavailable. Apply migrations 0001 and 0002 in the Supabase SQL Editor.",
        DB_ERROR: "Supabase could not create the first admin account. Confirm migrations 0001 and 0002 have both completed successfully.",
        INVALID_CREDENTIALS: "Username or password is incorrect. The bootstrap password only creates the first admin account.",
      };
      setMsg(messages[data.code] || "Admin sign-in failed. Check the server configuration and logs.");
    }
    else { setMsg("Signed in."); await refresh(); }
  }
  async function logout() { await fetch("/api/admin/me", { method: "POST" }); setAdmin(null); setUsers([]); setConflicts([]); }
  async function addUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: fd.get("username"), password: fd.get("password"), displayName: fd.get("displayName") }) });
    const data = await res.json().catch(() => ({}));
    setMsg(data.ok ? "User added." : (data.message || "Failed to add user."));
    if (data.ok) { (e.target as HTMLFormElement).reset(); refresh(); }
  }

  if (!admin) {
    return (
      <main className="warden-screen">
        <section className="warden-panel card warden-card">
          <p className="text-label text-brass" style={{ marginBottom: 10 }}>THE SYNDICATE ACCORD</p>
          <h1 className="warden-heading">Game Warden Portal</h1>
          <p className="warden-copy">On first setup, your bootstrap credentials create the first admin account. If sign-in fails, check the message below and confirm Supabase migrations 0001–0002 are applied.</p>
          <form onSubmit={login} className="warden-form">
            <label>Username<input name="username" autoComplete="username" required /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
            <button type="submit" className="warden-action warden-action-primary">Sign in</button>
          </form>
          <p className="warden-message" role={msg ? "alert" : undefined}>{msg}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="warden-screen">
      <div className="warden-panel">
        <header className="warden-header-row">
          <div>
            <p className="text-label text-brass" style={{ marginBottom: 8 }}>THE SYNDICATE ACCORD</p>
            <h1 className="warden-heading">Game Warden Portal</h1>
          </div>
          <div className="warden-account">
            {admin.username}
            <button type="button" onClick={logout} className="warden-action">Sign out</button>
          </div>
        </header>
        {msg && <p className="warden-message" role="status">{msg}</p>}
        <section className="card warden-card">
          <h2 className="warden-title">Add admin / warden</h2>
          <form onSubmit={addUser} className="warden-form">
            <label>Username<input name="username" autoComplete="off" required minLength={2} /></label>
            <label>Display name<input name="displayName" autoComplete="name" /></label>
            <label>Password (minimum 8 characters)<input name="password" type="password" autoComplete="new-password" required minLength={8} /></label>
            <button type="submit" className="warden-action warden-action-primary">Add user</button>
          </form>
        </section>
        <section className="card warden-card">
          <h2 className="warden-title">Admin users</h2>
          <pre className="warden-data">{JSON.stringify(users, null, 2)}</pre>
        </section>
        <section className="card warden-card">
          <h2 className="warden-title">Authentication conflicts</h2>
          <pre className="warden-data">{JSON.stringify(conflicts, null, 2)}</pre>
        </section>
      </div>
    </main>
  );
}
