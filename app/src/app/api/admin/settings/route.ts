import { NextRequest, NextResponse } from "next/server";
import { isAdminError, parseObjectBody, requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const INTEGER_RANGES: Record<string, [number, number]> = {
  day_rollover_h: [0, 23],
  tier1_n: [1, 10000],
  tier2_n: [2, 20000],
  patron_scan_bonus: [0, 20],
  patron_touch_t1_n: [0, 1000],
  patron_touch_t1_pts: [0, 1000],
  patron_touch_t2_n: [0, 1000],
  patron_touch_t2_pts: [0, 1000],
  receive_cap: [0, 10000],
};
const NUMBER_RANGES: Record<string, [number, number]> = {
  tier1_mult: [0, 10],
  tier2_mult: [0, 10],
  tier3_mult: [0, 10],
  diversity_mult: [0, 10],
  mono_mult: [0, 10],
  weekly_scan_cap: [0, 100000],
};
const TEXT_FIELDS = new Set(["event_name", "tz"]);
const DATE_FIELDS = new Set(["starts_at", "weekend_at", "locks_at"]);
const ALLOWED_FIELDS = new Set([
  ...TEXT_FIELDS,
  ...DATE_FIELDS,
  ...Object.keys(INTEGER_RANGES),
  ...Object.keys(NUMBER_RANGES),
  "phase",
]);
const PHASES = new Set(["setup", "live", "weekend", "locked", "closed"]);

function invalid(message: string) {
  return NextResponse.json({ ok: false, code: "INVALID_SETTINGS", message }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;
  const { data, error } = await context.db.from("game_config").select("*").eq("id", 1).maybeSingle();
  if (error || !data) {
    console.error("[admin/settings] Could not load game configuration:", error?.message ?? "missing config row");
    return NextResponse.json({ ok: false, code: "CONFIG_UNAVAILABLE" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, config: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest) {
  const context = await requireAdmin(req);
  if (isAdminError(context)) return context;
  let body: Record<string, unknown> | null;
  try {
    body = parseObjectBody(await req.json());
  } catch {
    return invalid("Provide a JSON object of settings to update.");
  }
  const changes = body?.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return invalid("Provide a changes object.");
  const input = changes as Record<string, unknown>;
  const keys = Object.keys(input);
  if (!keys.length || keys.some((key) => !ALLOWED_FIELDS.has(key))) return invalid("One or more settings are unsupported.");

  const normalized: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (TEXT_FIELDS.has(key)) {
      if (typeof value !== "string" || !value.trim() || value.length > (key === "event_name" ? 100 : 80)) {
        return invalid(`${key} must be a non-empty value within its length limit.`);
      }
      if (key === "tz") {
        try { new Intl.DateTimeFormat("en", { timeZone: value }); }
        catch { return invalid("Choose a valid timezone identifier."); }
      }
      normalized[key] = value.trim();
      continue;
    }
    if (DATE_FIELDS.has(key)) {
      if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return invalid(`${key} must be a valid date/time.`);
      normalized[key] = new Date(value).toISOString();
      continue;
    }
    if (key === "phase") {
      if (typeof value !== "string" || !PHASES.has(value)) return invalid("Choose a valid game phase.");
      normalized[key] = value;
      continue;
    }
    const range = INTEGER_RANGES[key] ?? NUMBER_RANGES[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < range[0] || value > range[1]) {
      return invalid(`${key} must be between ${range[0]} and ${range[1]}.`);
    }
    if (INTEGER_RANGES[key] && !Number.isInteger(value)) return invalid(`${key} must be a whole number.`);
    normalized[key] = value;
  }

  const { data: current, error: currentError } = await context.db.from("game_config").select("tier1_n,tier2_n,starts_at,weekend_at,locks_at").eq("id", 1).maybeSingle();
  if (currentError || !current) {
    console.error("[admin/settings] Could not validate current settings:", currentError?.message ?? "missing config row");
    return NextResponse.json({ ok: false, code: "CONFIG_UNAVAILABLE" }, { status: 500 });
  }
  const currentConfig: Record<string, unknown> = current;
  const tier1 = Number(normalized.tier1_n ?? current.tier1_n);
  const tier2 = Number(normalized.tier2_n ?? current.tier2_n);
  if (tier1 >= tier2) return invalid("The second scan threshold must be greater than the first.");
  const dates = ["starts_at", "weekend_at", "locks_at"].map((key) => new Date(String(normalized[key] ?? currentConfig[key])).getTime());
  if (!(dates[0] < dates[1] && dates[1] < dates[2])) return invalid("Event dates must be ordered: start, weekend, then lock.");

  const { data, error } = await context.db.rpc("admin_update_game_config", {
    p_changes: normalized,
    p_actor: String(context.admin.id),
  });
  if (error) {
    console.error("[admin/settings] Atomic settings update failed:", error.message);
    return NextResponse.json({ ok: false, code: "SETTINGS_UPDATE_FAILED", message: "Settings were not changed. Confirm migration 0004 is applied and retry." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, config: data }, { headers: { "Cache-Control": "no-store" } });
}
