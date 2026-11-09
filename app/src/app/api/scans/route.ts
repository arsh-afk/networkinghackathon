import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { cookieName, readSessionByToken } from "@/lib/session";
import { getServiceSupabase, devNoDbEnabled } from "@/lib/db";
import { parseBadgeText } from "@/lib/badge";
import { buildScanBreakdown, gameDayFor, DEFAULT_CONFIG, type Role } from "@/lib/scoring";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(req: NextRequest) {
  // --- Auth ---
  const token = cookies().get(cookieName("player"))?.value;
  const player = await readSessionByToken("player", token);
  if (!player) return err("UNAUTHORIZED", "Sign in first.", 401);

  // --- Body ---
  let body: { text?: string; code?: string; clientUuid?: string; via?: string };
  try { body = await req.json(); }
  catch { return err("BAD_REQUEST", "Invalid JSON."); }

  const rawCode = body.code?.trim() ?? (body.text ? parseBadgeText(body.text)?.code : undefined);
  if (!rawCode || !/^\d{6}$/.test(rawCode)) {
    return err("BAD_BADGE", "No such mark in the ledger. Check the digits.");
  }

  const clientUuid = typeof body.clientUuid === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.clientUuid)
    ? body.clientUuid
    : crypto.randomUUID();
  const via = ["qr", "code", "admin"].includes(body.via ?? "") ? body.via : "qr";

  const db = getServiceSupabase();
  if (!db) return err("DB_ERROR", "Database not configured.", 503);

  if (devNoDbEnabled()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handleDevScan({ db: db as any, player, rawCode, clientUuid, via: via as string });
  }

  // Production: call rpc_scan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("rpc_scan", {
    p_scanner: player.id,
    p_code: rawCode,
    p_client: clientUuid,
    p_via: via,
  });

  if (error) {
    console.error("[scans] rpc_scan failed:", error.message, error.code);
    return err("DB_ERROR", "The ledger did not answer. Nothing was lost.", 500);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpcData = data as any;
  if (!rpcData?.ok) return NextResponse.json(rpcData, { status: rpcData?.code === "LOCKED" ? 423 : 409 });
  return NextResponse.json(rpcData);
}

// --------------- DEV_NO_DB path ---------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleDevScan({ db, player, rawCode, clientUuid, via }: { db: any; player: Record<string, unknown>; rawCode: string; clientUuid: string; via: string }) {
  const me = player as { id: string; role: Role; display_name: string };

  // Phase check (simple: always 'live' in dev)
  // Self check
  const { data: them } = await db.from("players").select("*").eq("badge_code", rawCode).eq("is_active", true).maybeSingle();
  if (!them) {
    // Check retired
    const { data: retired } = await db.from("retired_badges").select("code").eq("code", rawCode).maybeSingle();
    if (retired) return NextResponse.json({ ok: false, code: "RETIRED_BADGE", message: "That badge has been replaced. Ask for the new one." }, { status: 409 });
    return NextResponse.json({ ok: false, code: "BAD_BADGE", message: "No such mark in the ledger." }, { status: 409 });
  }
  if (them.id === me.id) return NextResponse.json({ ok: false, code: "SELF", message: "You cannot sign your own name." }, { status: 409 });

  // Idempotency
  const { data: existing } = await db.from("scans").select("id").eq("client_uuid", clientUuid).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, replay: true, scan_id: existing.id });

  // Duplicate pair check
  const { data: allScans } = await db.from("scans").select("scanner_id,receiver_id,voided_at");
  const alreadyPaired = (allScans ?? []).some((s: Record<string, unknown>) =>
    !s.voided_at &&
    [s.scanner_id, s.receiver_id].sort().join() === [me.id, them.id].sort().join()
  );
  if (alreadyPaired) return NextResponse.json({ ok: false, code: "ALREADY_PAIRED", message: "You already hold this thread." }, { status: 409 });

  const gameDay = gameDayFor(new Date(), 0, "Asia/Dubai");

  // Count today's scans for seq
  const todayScans = (allScans ?? []).filter((s: Record<string, unknown>) =>
    s.scanner_id === me.id && s.game_day === gameDay && !s.voided_at
  );
  const seq = todayScans.length + 1;

  const scanId = crypto.randomUUID();
  await db.from("scans").insert({
    id: scanId,
    scanner_id: me.id,
    receiver_id: them.id,
    base_points: 3 + (them.role !== me.role ? 2 : 0) + (them.role === "patron" ? 1 : 0),
    game_day: gameDay,
    client_uuid: clientUuid,
    via,
  });

  const breakdown = buildScanBreakdown({
    scannerRole: me.role,
    receiver: { display_name: them.display_name, role: them.role as Role, descriptor: them.descriptor },
    seq,
    scanId,
    cfg: DEFAULT_CONFIG,
  });

  return NextResponse.json(breakdown);
}
