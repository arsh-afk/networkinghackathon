import { notFound } from "next/navigation";
import WardenClient from "./WardenClient";

export const dynamic = "force-dynamic";

export default function WardenEntryPage({ params }: { params: { secret: string } }) {
  const expected = process.env.ADMIN_PORTAL_SECRET_PATH;
  // Hidden portal: wrong/missing secret behaves as not found (no link on main portal).
  if (!expected || params.secret !== expected) notFound();
  return <WardenClient portalSecret={params.secret} />;
}
