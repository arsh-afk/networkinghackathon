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
};

/** Compute base points for a single scan (before tier/diversity multipliers). */
export function baseScanPoints(scannerRole: Role, receiverRole: Role): number {
  // A4: cross-faction: +2, patron bonus reduced: +1 (so cross-faction patron base = 3+2+1 = 6)
  return 3
    + (receiverRole !== scannerRole ? 2 : 0)
    + (receiverRole === 'patron' ? 1 : 0);
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
  const patronBonus = receiverRole === 'patron' ? 1 : 0; // A4 reduced
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

