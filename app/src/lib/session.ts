import { getServiceSupabase } from "./db";
import { randomToken, sha256 } from "./crypto";

export const PLAYER_COOKIE = "sa_player";
export const ADMIN_COOKIE = "sa_admin";
const PLAYER_TTL_DAYS = 14;
const ADMIN_TTL_HOURS = 12;

export type SessionKind = "player" | "admin";
type SessionRow = Record<string, unknown> & { expires_at: string; revoked_at?: string | null };

export function cookieName(kind: SessionKind) {
  return kind === "admin" ? ADMIN_COOKIE : PLAYER_COOKIE;
}

export function cookieOptions(kind: SessionKind) {
  const maxAge = kind === "admin" ? ADMIN_TTL_HOURS * 3600 : PLAYER_TTL_DAYS * 86400;
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

export async function issueSession(kind: SessionKind, subjectId: string, userAgent?: string) {
  const db = getServiceSupabase();
  if (!db) throw new Error("Database not configured");
  const token = randomToken(32);
  const expires = new Date(Date.now() + (kind === "admin" ? ADMIN_TTL_HOURS * 3600_000 : PLAYER_TTL_DAYS * 86400_000));
  const table = kind === "admin" ? "admin_sessions" : "player_sessions";
  const fk = kind === "admin" ? "admin_id" : "player_id";
  const { error } = await db.from(table).insert({
    [fk]: subjectId,
    token_hash: `\\x${sha256(token).toString("hex")}`,
    expires_at: expires.toISOString(),
    user_agent: userAgent?.slice(0, 300) ?? null,
  });
  if (error) throw error;
  return { token, expiresAt: expires.toISOString() };
}

export async function readSessionByToken(kind: SessionKind, token: string | undefined | null) {
  if (!token) return null;
  const db = getServiceSupabase();
  if (!db) return null;
  const table = kind === "admin" ? "admin_sessions" : "player_sessions";
  const view = kind === "admin" ? "admin_users" : "players";
  const fk = kind === "admin" ? "admin_id" : "player_id";
  const { data: sess } = await db.from(table).select(`${fk}, expires_at, revoked_at`).eq("token_hash", `\\x${sha256(token).toString("hex")}`).maybeSingle();
  const s = sess as SessionRow | null;
  if (!s || s.revoked_at || new Date(s.expires_at) < new Date()) return null;
  const id = s[fk];
  if (typeof id !== "string") return null;
  const { data: subject } = await db.from(view).select("*").eq("id", id).maybeSingle();
  if (!subject || ((subject as Record<string, unknown>).is_active === false)) return null;
  return subject as Record<string, unknown>;
}

export async function revokeSessionByToken(kind: SessionKind, token: string | undefined | null) {
  if (!token) return;
  const db = getServiceSupabase();
  if (!db) return;
  const table = kind === "admin" ? "admin_sessions" : "player_sessions";
  await db.from(table).update({ revoked_at: new Date().toISOString() }).eq("token_hash", `\\x${sha256(token).toString("hex")}`);
}
