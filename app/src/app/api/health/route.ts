import { NextResponse } from "next/server";
import { dbConfigured, devNoDbEnabled } from "@/lib/db";

/**
 * Keep-warm + uptime endpoint (plan 01 §6, §9.1).
 * Returns DB status once Supabase client is wired.
 */
export async function GET() {
  const devFallback = devNoDbEnabled() && !(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  return NextResponse.json(
    {
      ok: true,
      db: devFallback ? "dev_no_db" : dbConfigured() ? "configured" : "not_configured",
      devNoDb: devFallback,
      phase: "setup",
      service: "syndicate-accord",
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
