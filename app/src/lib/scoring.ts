import { devNoDbEnabled, getServiceSupabase } from "./db";

/**
 * Scoring logic — mirrors the SQL fn_ledger / rpc_scan logic.
 * Used in both DEV_NO_DB (JS path) and production (SQL RPC).
 * Values loaded from game_config or env-based defaults.
 */

export type Role = 'artificer' | 'broker' | 'weaver' | 'patron';

export interface ScoringConfig {
  tier1_n: number;       // full points for first N scans (default 8)
  tier2_n: number;       // half points until N (default 15)
  tier1_mult: number;    // 1.00
  tier2_mult: number;    // 0.50
  tier3_mult: number;    // 0.25
  diversity_mult: number;// 1.25 if ≥3 distinct roles in a day
  mono_mult: number;     // 0.75 if only own role all day
  weekly_scan_cap: number; // 220
  receive_cap: number;   // 8 receives counted per day
  patron_full_uses: number;  // A4: 3 (adjusted from 5)
  patron_touch_pts: number;  // A4: each of first 3 = +3
  patron_scan_bonus: number;
  patron_touch_t1_n: number;
  patron_touch_t1_pts: number;
  patron_touch_t2_n: number;
  patron_touch_t2_pts: number;
  day_rollover_h: number;
  tz: string;
}

export const DEFAULT_CONFIG: ScoringConfig = {
  tier1_n: 8,
  tier2_n: 15,
  tier1_mult: 1.00,
  tier2_mult: 0.50,
  tier3_mult: 0.25,
  diversity_mult: 1.25,
  mono_mult: 0.75,
  weekly_scan_cap: 220,
  receive_cap: 8,
  patron_full_uses: 3,   // A4: reduced from 5
  patron_touch_pts: 3,   // A4: +3 each for first 3
  patron_scan_bonus: 1,
  patron_touch_t1_n: 3,
  patron_touch_t1_pts: 3,
  patron_touch_t2_n: 3,
  patron_touch_t2_pts: 1,
  day_rollover_h: 0,
  tz: "Asia/Dubai",
};

export async function loadScoringConfig(): Promise<ScoringConfig> {
  if (devNoDbEnabled()) return DEFAULT_CONFIG;
  const db = getServiceSupabase();
  if (!db) return DEFAULT_CONFIG;
  const { data, error } = await db.from("game_config")
    .select("tier1_n,tier2_n,tier1_mult,tier2_mult,tier3_mult,diversity_mult,mono_mult,weekly_scan_cap,receive_cap,patron_scan_bonus,patron_touch_t1_n,patron_touch_t1_pts,patron_touch_t2_n,patron_touch_t2_pts,day_rollover_h,tz")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    console.error("[scoring] Could not load game configuration:", error?.message ?? "missing config row");
    throw new Error("Game scoring configuration is unavailable.");
  }
  return {
    ...DEFAULT_CONFIG,
    tier1_n: Number(data.tier1_n),
    tier2_n: Number(data.tier2_n),
    tier1_mult: Number(data.tier1_mult),
    tier2_mult: Number(data.tier2_mult),
    tier3_mult: Number(data.tier3_mult),
    diversity_mult: Number(data.diversity_mult),
    mono_mult: Number(data.mono_mult),
    weekly_scan_cap: Number(data.weekly_scan_cap),
    receive_cap: Number(data.receive_cap),
    patron_scan_bonus: Number(data.patron_scan_bonus),
    patron_touch_t1_n: Number(data.patron_touch_t1_n),
    patron_touch_t1_pts: Number(data.patron_touch_t1_pts),
    patron_touch_t2_n: Number(data.patron_touch_t2_n),
    patron_touch_t2_pts: Number(data.patron_touch_t2_pts),
    day_rollover_h: Number(data.day_rollover_h),
    tz: String(data.tz),
  };
}

export type ScorePlayer = { id: string; role: string };
export type ScoreScan = {
  id: string;
  scanner_id: string;
  receiver_id: string;
  base_points: number;
  game_day: string;
  created_at: string;
  voided_at?: string | null;
};
export type PlayerScore = { scanPoints: number; receivePoints: number; taskPoints: number; total: number; scans: number };

export function calculateScores(players: ScorePlayer[], scans: ScoreScan[], cfg: ScoringConfig = DEFAULT_CONFIG) {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const scoreMap = new Map<string, PlayerScore>(players.map((player) => [player.id, {
    scanPoints: 0, receivePoints: 0, taskPoints: 0, total: 0, scans: 0,
  }]));
  const liveScans = scans.filter((scan) => !scan.voided_at).sort((a, b) =>
    a.game_day.localeCompare(b.game_day) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
  );
  const scanDays = new Map<string, ScoreScan[]>();
  const receivedDays = new Map<string, number>();
  const patronWeeks = new Map<string, number>();

  for (const scan of liveScans) {
    const scanDayKey = `${scan.scanner_id}:${scan.game_day}`;
    const day = scanDays.get(scanDayKey) ?? [];
    day.push(scan);
    scanDays.set(scanDayKey, day);
    const receiveKey = `${scan.receiver_id}:${scan.game_day}`;
    receivedDays.set(receiveKey, (receivedDays.get(receiveKey) ?? 0) + 1);
  }

  for (const dayScans of scanDays.values()) {
    const first = dayScans[0];
    const scanner = playerMap.get(first.scanner_id);
    const score = scoreMap.get(first.scanner_id);
    if (!scanner || !score) continue;
    const receiverRoles = dayScans.map((scan) => playerMap.get(scan.receiver_id)?.role.toLowerCase()).filter((role): role is string => Boolean(role));
    const distinctRoles = new Set(receiverRoles);
    const otherRoles = new Set(receiverRoles.filter((role) => role !== scanner.role.toLowerCase()));
    const diversity = distinctRoles.size >= 3 ? cfg.diversity_mult : otherRoles.size === 0 && distinctRoles.size === 1 ? cfg.mono_mult : 1;
    let rawPoints = 0;
    let taskPoints = 0;
    for (let index = 0; index < dayScans.length; index++) {
      const scan = dayScans[index];
      rawPoints += Number(scan.base_points || 0) * tierMultiplier(index + 1, cfg);
      score.scans++;
      const receiver = playerMap.get(scan.receiver_id);
      if (receiver?.role.toLowerCase() === "patron") {
        const weekDate = new Date(`${scan.game_day}T00:00:00Z`);
        weekDate.setUTCDate(weekDate.getUTCDate() - (weekDate.getUTCDay() + 6) % 7);
        const week = weekDate.toISOString().slice(0, 10);
        const patronKey = `${scan.scanner_id}:${week}`;
        const touchNumber = (patronWeeks.get(patronKey) ?? 0) + 1;
        patronWeeks.set(patronKey, touchNumber);
        if (touchNumber <= cfg.patron_touch_t1_n) taskPoints += cfg.patron_touch_t1_pts;
        else if (touchNumber <= cfg.patron_touch_t1_n + cfg.patron_touch_t2_n) taskPoints += cfg.patron_touch_t2_pts;
      }
    }
    score.scanPoints += rawPoints * diversity;
    score.taskPoints += taskPoints;
  }

  for (const [key, count] of receivedDays) {
    const separator = key.indexOf(":");
    const playerId = key.slice(0, separator);
    const score = scoreMap.get(playerId);
    if (score) score.receivePoints += Math.min(count, cfg.receive_cap);
  }
  for (const score of scoreMap.values()) {
    score.scanPoints = Math.min(score.scanPoints, cfg.weekly_scan_cap);
    score.scanPoints = Math.round(score.scanPoints * 100) / 100;
    score.total = Math.round((score.scanPoints + score.receivePoints + score.taskPoints) * 100) / 100;
  }
  return scoreMap;
}

/** Compute base points for a single scan (before tier/diversity multipliers). */
export function baseScanPoints(scannerRole: Role, receiverRole: Role, cfg: ScoringConfig = DEFAULT_CONFIG): number {
  // A4: cross-faction: +2, patron bonus reduced: +1 (so cross-faction patron base = 3+2+1 = 6)
  return 3
    + (receiverRole !== scannerRole ? 2 : 0)
    + (receiverRole === 'patron' ? cfg.patron_scan_bonus : 0);
}

/** Get multiplier for a scan at position seq (1-indexed) in the day. */
export function tierMultiplier(seq: number, cfg: ScoringConfig = DEFAULT_CONFIG): number {
  if (seq <= cfg.tier1_n) return cfg.tier1_mult;
  if (seq <= cfg.tier2_n) return cfg.tier2_mult;
  return cfg.tier3_mult;
}

/** Diversity multiplier for the day given receiver roles. */
export function diversityMultiplier(
  scannerRole: Role,
  receiverRoles: Role[],
  cfg: ScoringConfig = DEFAULT_CONFIG
): number {
  const distinctRoles = new Set(receiverRoles);
  const distinctCount = distinctRoles.size;
  const onlyOwnRole = distinctCount === 1 && distinctRoles.has(scannerRole);
  if (distinctCount >= 3) return cfg.diversity_mult;
  if (onlyOwnRole) return cfg.mono_mult;
  return 1.0;
}

/** Build a scan result breakdown (matches SQL rpc_scan return shape). */
export function buildScanBreakdown(opts: {
  scannerRole: Role;
  receiver: { display_name: string; role: Role; descriptor?: string | null };
  seq: number; // position in today's scans (1-indexed)
  scanId: string;
  cfg?: ScoringConfig;
}) {
  const { scannerRole, receiver, seq, scanId, cfg = DEFAULT_CONFIG } = opts;
  const receiverRole = receiver.role;
  const crossFaction = receiverRole !== scannerRole ? 2 : 0;
  const patronBonus = receiverRole === 'patron' ? cfg.patron_scan_bonus : 0;
  const base = 3 + crossFaction + patronBonus;
  const mult = tierMultiplier(seq, cfg);
  const tier = seq <= cfg.tier1_n ? 1 : seq <= cfg.tier2_n ? 2 : 3;

  return {
    ok: true,
    scan_id: scanId,
    receiver: {
      name: receiver.display_name,
      role: receiverRole,
      descriptor: receiver.descriptor ?? null,
    },
    breakdown: [
      { label: 'Initiated', points: 3 },
      { label: 'Crossed faction', points: crossFaction },
      { label: 'Patron', points: patronBonus },
    ],
    base,
    tier,
    tier_mult: mult,
    scan_points: Math.round(base * mult * 100) / 100,
    day_seq: seq,
    receiver_points: 1,
  };
}

/** Game day logic: subtract rollover hours then get the date. */
export function gameDayFor(ts: Date, rolloverHour = 0, tz = 'Asia/Dubai'): string {
  // Subtract rollover hours to shift the day boundary
  const adjusted = new Date(ts.getTime() - rolloverHour * 3600_000);
  // Format as YYYY-MM-DD in the given timezone
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(adjusted);
}
