/**
 * Component classes (tiers 0-5) used for pairing and readiness estimates.
 *
 * Honesty rules:
 *  - GPU class is an ESTIMATE parsed from the model name; `basis` says so.
 *  - CPU class comes from measured thread count (plus a low-clock penalty),
 *    not from a model-name table, so new CPUs are handled without updates.
 *  - Age is never used. An old part is classified by what it is, and an
 *    unrecognized model yields `undefined` (insufficient evidence), not a guess.
 */
export interface HwClass {
  /** 0 integrated/minimal, 1 entry, 2 mainstream, 3 upper-mid, 4 high-end, 5 enthusiast. */
  tier: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  basis: string;
}

const LABELS = ["Integrated", "Entry", "Mainstream", "Upper-mid", "High-end", "Enthusiast"] as const;
const mk = (tier: HwClass["tier"], basis: string): HwClass => ({ tier, label: LABELS[tier], basis });

const t = (n: number): HwClass["tier"] => Math.max(0, Math.min(5, n)) as HwClass["tier"];

export function classifyGpu(name: string): HwClass | undefined {
  const n = name.trim();
  const basis = "estimated from the GPU model name";

  // Intel Arc dedicated
  const arc = /Arc(?:\(TM\))?\s+(?:Pro\s+)?([AB])(\d)(\d{2})/i.exec(n);
  if (arc) {
    const d = parseInt(arc[2], 10);
    const battlemage = arc[1].toUpperCase() === "B";
    // Battlemage B5xx/B7xx: upper-mid. Alchemist A7xx: upper-mid, A5xx: mainstream, A3xx: entry.
    return mk(t(d >= 7 || (battlemage && d >= 5) ? 3 : d >= 5 ? 2 : 1), basis);
  }

  // Integrated graphics
  if (
    /Intel\(R\)\s*(UHD|HD|Iris|Graphics)|Intel.*Graphics(?!.*Arc)|Radeon\(TM\)\s*Graphics|Radeon\s+\d{3}M\b|Vega\s+\d+\s+Graphics|Radeon\s+Graphics/i.test(n)
  ) {
    return mk(0, "integrated graphics detected from the adapter name");
  }

  // NVIDIA GeForce RTX / GTX
  const nv = /(?:RTX|GTX)\s*(\d{3,4})/i.exec(n);
  if (nv) {
    const num = parseInt(nv[1], 10);
    const gen = Math.floor(num / 100);
    const suffix = num % 100;
    if (/RTX/i.test(n) && gen >= 40) {
      const map: Record<number, number> = { 90: 5, 80: 5, 70: 4, 60: 3, 50: 2 };
      return mk(t(map[suffix] ?? 2), basis);
    }
    if (/RTX/i.test(n)) {
      const map: Record<number, number> = { 90: 4, 80: 4, 70: 3, 60: 2, 50: 1 };
      return mk(t(map[suffix] ?? 1), basis);
    }
    // GTX 10/16 series
    const map: Record<number, number> = { 80: 3, 70: 3, 60: 2, 50: 1 };
    return mk(t(map[suffix] ?? 1), basis);
  }

  // AMD Radeon RX
  const rx4 = /RX\s*(\d{4})/i.exec(n);
  if (rx4) {
    const num = parseInt(rx4[1], 10);
    if (num === 9070) return mk(4, basis);
    if (num === 9060) return mk(3, basis);
    const gen = Math.floor(num / 1000);
    const h = Math.floor((num % 1000) / 100);
    const modern: Record<number, number> = { 9: 5, 8: 4, 7: 4, 6: 3, 5: 2, 4: 1, 3: 1 };
    const older: Record<number, number> = { 9: 4, 8: 4, 7: 3, 6: 2, 5: 2, 4: 1, 3: 1 };
    return mk(t((gen >= 7 ? modern : older)[h] ?? 1), basis);
  }
  const rx3 = /RX\s*(\d{3})\b/i.exec(n);
  if (rx3) return mk(parseInt(rx3[1], 10) >= 570 ? 2 : 1, basis);

  return undefined; // unrecognized model: insufficient evidence
}

/** CPU class from measured logical thread count, with a penalty for very low rated clocks. */
export function classifyCpu(logicalThreads: number, maxClockMhz?: number): HwClass {
  let tier = logicalThreads >= 24 ? 5 : logicalThreads >= 16 ? 4 : logicalThreads >= 12 ? 3 : logicalThreads >= 8 ? 2 : logicalThreads >= 4 ? 1 : 0;
  if (maxClockMhz !== undefined && maxClockMhz > 0 && maxClockMhz < 2000) tier -= 1;
  return mk(t(tier), `measured from ${logicalThreads} logical processors`);
}
