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
    if (!res.ok || !data.ok) setMsg(data.code === "NOT_FOUND" ? "Not found." : "Login failed.");
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
      <main style={{ maxWidth: 420, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
        <h1>Game Warden Portal</h1>
        <p style={{ color: "#555" }}>Admin login required. First successful bootstrap login can create the initial Arsh account when DB has no admin users.</p>
        <form onSubmit={login} style={{ display: "grid", gap: 8 }}>
          <label>Username <input name="username" required /></label>
          <label>Password <input name="password" type="password" required /></label>
          <button type="submit">Sign in</button>
        </form>
        {msg && <p>{msg}</p>}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "1rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Game Warden Portal</h1>
        <div>{admin.username} <button onClick={logout}>Sign out</button></div>
      </div>
      {msg && <p>{msg}</p>}
      <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Add admin/warden user</h2>
        <form onSubmit={addUser} style={{ display: "grid", gap: 8, maxWidth: 420 }}>
          <label>Username <input name="username" required minLength={2} /></label>
          <label>Display name <input name="displayName" /></label>
          <label>Password (min 8 chars) <input name="password" type="password" required minLength={8} /></label>
          <button type="submit">Add user</button>
        </form>
      </section>
      <section style={{ marginTop: 16 }}>
        <h2>Admin users</h2>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f6f6f6", padding: 12 }}>{JSON.stringify(users, null, 2)}</pre>
      </section>
      <section style={{ marginTop: 16 }}>
        <h2>Auth conflicts (from login/register issues)</h2>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f6f6f6", padding: 12 }}>{JSON.stringify(conflicts, null, 2)}</pre>
      </section>
    </main>
  );
}
