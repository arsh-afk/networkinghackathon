/**
 * Fixture-driven scoring test matching plan/02-data-model-and-scoring.md §4.5
 *
 * Aria (Broker), 10 scans:
 * 1. Weaver (+5, rung 1, mult 1.0) = 5.00
 * 2. Patron (+6 under A4, rung 2, mult 1.0) = 6.00 (plan doc says 7 under old rules; A4 reduced patron = 6)
 * 3. Artificer (+5, rung 3, mult 1.0) = 5.00
 * 4. Broker (+3, rung 4, mult 1.0) = 3.00
 * 5. Weaver (+5, rung 5, mult 1.0) = 5.00
 * 6. Broker (+3, rung 6, mult 1.0) = 3.00
 * 7. Patron (+6 under A4, rung 7, mult 1.0) = 6.00
 * 8. Weaver (+5, rung 8, mult 1.0) = 5.00
 * 9. Broker (+3, rung 9, mult 0.5) = 1.50
 * 10. Artificer (+5, rung 10, mult 0.5) = 2.50
 *
 * Distinct roles: Weaver, Patron, Artificer, Broker = 4 distinct roles -> diversity mult x1.25
 */

import { baseScanPoints, tierMultiplier, diversityMultiplier, type Role } from "./scoring";

function assertEqual(actual: number, expected: number, msg: string) {
  if (Math.abs(actual - expected) > 0.001) {
    throw new Error(`FAIL: ${msg} — expected ${expected}, got ${actual}`);
  }
  console.log(`  ✓ ${msg}: ${actual}`);
}

console.log("=== THE SYNDICATE ACCORD: SCORING TEST ===");

// 1. Base points
console.log("\n1. Base points:");
assertEqual(baseScanPoints("broker", "broker"), 3, "Same role (Broker -> Broker)");
assertEqual(baseScanPoints("broker", "weaver"), 5, "Cross-faction (Broker -> Weaver)");
assertEqual(baseScanPoints("broker", "artificer"), 5, "Cross-faction (Broker -> Artificer)");
assertEqual(baseScanPoints("broker", "patron"), 6, "Patron cross-faction under A4 (3 + 2 cross + 1 patron)");
assertEqual(baseScanPoints("patron", "patron"), 4, "Patron same-role under A4 (3 + 1 patron)");

// 2. Tier multipliers
console.log("\n2. Tier multipliers:");
assertEqual(tierMultiplier(1), 1.0, "Rung 1");
assertEqual(tierMultiplier(8), 1.0, "Rung 8 (tier 1 end)");
assertEqual(tierMultiplier(9), 0.5, "Rung 9 (tier 2 start)");
assertEqual(tierMultiplier(15), 0.5, "Rung 15 (tier 2 end)");
assertEqual(tierMultiplier(16), 0.25, "Rung 16 (tier 3 start)");

// 3. Diversity multipliers
console.log("\n3. Diversity multipliers:");
assertEqual(diversityMultiplier("broker", ["broker", "broker"]), 0.75, "Mono role (only own role)");
assertEqual(diversityMultiplier("broker", ["broker", "weaver"]), 1.0, "Two roles");
assertEqual(diversityMultiplier("broker", ["broker", "weaver", "artificer"]), 1.25, "Three distinct roles");
assertEqual(diversityMultiplier("broker", ["weaver", "artificer", "patron"]), 1.25, "Three other roles (no own)");

// 4. Aria worked example
console.log("\n4. Aria worked example (A4 patron numbers):");
const ariaScans: Array<{ role: Role; expectedBase: number; expectedMult: number; expectedWeighted: number }> = [
  { role: "weaver", expectedBase: 5, expectedMult: 1.0, expectedWeighted: 5.0 },
  { role: "patron", expectedBase: 6, expectedMult: 1.0, expectedWeighted: 6.0 },
  { role: "artificer", expectedBase: 5, expectedMult: 1.0, expectedWeighted: 5.0 },
  { role: "broker", expectedBase: 3, expectedMult: 1.0, expectedWeighted: 3.0 },
  { role: "weaver", expectedBase: 5, expectedMult: 1.0, expectedWeighted: 5.0 },
  { role: "broker", expectedBase: 3, expectedMult: 1.0, expectedWeighted: 3.0 },
  { role: "patron", expectedBase: 6, expectedMult: 1.0, expectedWeighted: 6.0 },
  { role: "weaver", expectedBase: 5, expectedMult: 1.0, expectedWeighted: 5.0 },
  { role: "broker", expectedBase: 3, expectedMult: 0.5, expectedWeighted: 1.5 },
  { role: "artificer", expectedBase: 5, expectedMult: 0.5, expectedWeighted: 2.5 },
];

let rawTotal = 0;
let weightedTotal = 0;

ariaScans.forEach((s, idx) => {
  const seq = idx + 1;
  const base = baseScanPoints("broker", s.role);
  const mult = tierMultiplier(seq);
  const weighted = base * mult;
  assertEqual(base, s.expectedBase, `Scan #${seq} base`);
  assertEqual(mult, s.expectedMult, `Scan #${seq} mult`);
  assertEqual(weighted, s.expectedWeighted, `Scan #${seq} weighted`);
  rawTotal += base;
  weightedTotal += weighted;
});

assertEqual(rawTotal, 46, "Aria raw total (with A4 patron = 6)");
assertEqual(weightedTotal, 42.0, "Aria weighted total before diversity");

const rolesTouched: Role[] = ariaScans.map(s => s.role);
const divMult = diversityMultiplier("broker", rolesTouched);
assertEqual(divMult, 1.25, "Aria diversity mult");

const finalScanPts = weightedTotal * divMult;
assertEqual(finalScanPts, 52.5, "Aria final scan points for the day (42.0 * 1.25 = 52.50)");

console.log("\n✅ ALL SCORING ASSERTIONS PASSED!");
