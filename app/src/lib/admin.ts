import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/db";
import { cookieName, readSessionByToken } from "@/lib/session";

export type AdminContext = {
  db: NonNullable<ReturnType<typeof getServiceSupabase>>;
  admin: Record<string, unknown>;
};

export async function requireAdmin(req: NextRequest): Promise<AdminContext | NextResponse> {
  const token = req.cookies.get(cookieName("admin"))?.value;
  const admin = await readSessionByToken("admin", token);
  if (!admin) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });

  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ ok: false, code: "DB_NOT_CONFIGURED" }, { status: 503 });
  return { db, admin };
}

export function isAdminError(context: AdminContext | NextResponse): context is NextResponse {
  return context instanceof NextResponse;
}

export async function recordAdminAction(
  context: AdminContext,
  action: string,
  target: string | null,
  before: unknown,
  after: unknown,
) {
  const { error } = await context.db.from("audit_log").insert({
    actor_type: "admin",
    actor_id: String(context.admin.id),
    action,
    target,
    before: before ?? null,
    after: after ?? null,
  });
  if (error) {
    console.error(`[admin] Audit write failed for ${action}:`, error.message);
    throw new Error("AUDIT_WRITE_FAILED");
  }
}

export function parseObjectBody(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
