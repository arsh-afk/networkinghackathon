/**
 * Seed script for dev testing:
 * Creates sample players across Artificer, Broker, Weaver, Patron roles,
 * ready to test login, QR code rendering, scanning, and arena leaderboard.
 */

import crypto from "node:crypto";
import { hashSecret } from "../src/lib/crypto";

export const SAMPLE_PLAYERS = [
  {
    display_name: "Layla Haddad",
    role: "weaver",
    descriptor: "crafter of narratives",
    badge_code: "042917",
    email: "layla.haddad@aurak.ac.ae",
    pin: "123456",
  },
  {
    display_name: "Omar Rashed",
    role: "artificer",
    descriptor: "architect of mechanics",
    badge_code: "182940",
    email: "omar.rashed@aurak.ac.ae",
    pin: "123456",
  },
  {
    display_name: "Farid Al-Mansoori",
    role: "patron",
    descriptor: "benefactor & visionary",
    badge_code: "991024",
    email: "farid.almansoori@aurak.ac.ae",
    pin: "123456",
  },
  {
    display_name: "Sara Qasimi",
    role: "broker",
    descriptor: "negotiator of treaties",
    badge_code: "405112",
    email: "sara.qasimi@aurak.ac.ae",
    pin: "123456",
  },
  {
    display_name: "Tariq Zayed",
    role: "artificer",
    descriptor: "signal builder",
    badge_code: "330192",
    email: "tariq.zayed@aurak.ac.ae",
    pin: "123456",
  },
];

export async function generateHashedSeed() {
  const seeded = [];
  for (const p of SAMPLE_PLAYERS) {
    const hash = await hashSecret(p.pin);
    seeded.push({
      id: crypto.randomUUID(),
      display_name: p.display_name,
      role: p.role,
      descriptor: p.descriptor,
      badge_code: p.badge_code,
      email: p.email,
      pin_hash: hash,
      is_active: true,
      is_admin: false,
    });
  }
  return seeded;
}

if (require.main === module) {
  generateHashedSeed().then((players) => {
    console.log("Generated seeded player profiles:");
    players.forEach((p) => {
      console.log(`- ${p.display_name} (${p.role.toUpperCase()}) | Badge: ${p.badge_code} | PIN: 123456 | ${p.email}`);
    });
  });
}
