import { createClient } from "@supabase/supabase-js";

export function devNoDbEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_NO_DB === "true";
}

/** Server-only data client. Prefers Supabase; can use DEV_NO_DB in-memory fallback (never production). */
export function getServiceSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  if (devNoDbEnabled()) {
    // lazy require-ish to avoid bundling surprises; dev-only
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDevSupabase } = require("./dev-store") as typeof import("./dev-store");
    return getDevSupabase() as unknown as ReturnType<typeof createClient>;
  }
  return null;
}

export function dbConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) || devNoDbEnabled();
}

