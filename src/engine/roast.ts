import { ROAST_LIBRARY, type RoastContext, type RoastEntry } from "./roastLibrary";
import type { Roast, RoastCategory, RoastSet } from "./types";

export const ROAST_CATEGORIES: RoastCategory[] = ["hardware", "startup", "storage", "gaming", "overall"];

/** Small deterministic PRNG (mulberry32): same seed, same roasts. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RoastOptions {
  seed: number;
  /** Roast ids shown recently; avoided whenever an alternative exists. */
  recentIds?: string[];
}

const toRoast = (e: RoastEntry, ctx: RoastContext): Roast => ({
  id: e.id, category: e.category, specificity: e.specificity, text: e.text(ctx),
});

/** Weighted pick favouring data-specific lines (weight = specificity²). */
function pick(entries: RoastEntry[], rng: () => number): RoastEntry {
  const total = entries.reduce((a, e) => a + e.specificity ** 2, 0);
  let r = rng() * total;
  for (const e of entries) {
    r -= e.specificity ** 2;
    if (r <= 0) return e;
  }
  return entries[entries.length - 1];
}

/** All roasts that the scan data currently supports (used by tests and the UI). */
export function eligibleRoasts(ctx: RoastContext): Roast[] {
  return ROAST_LIBRARY.filter((e) => e.when(ctx)).map((e) => toRoast(e, ctx));
}

export function generateRoasts(ctx: RoastContext, opts: RoastOptions): RoastSet {
  const rng = makeRng(opts.seed);
  const recent = new Set(opts.recentIds ?? []);
  const byCategory: Partial<Record<RoastCategory, Roast>> = {};
  const chosen: RoastEntry[] = [];

  for (const cat of ROAST_CATEGORIES) {
    const eligible = ROAST_LIBRARY.filter((e) => e.category === cat && e.when(ctx));
    if (eligible.length === 0) continue;
    const fresh = eligible.filter((e) => !recent.has(e.id));
    const entry = pick(fresh.length > 0 ? fresh : eligible, rng);
    chosen.push(entry);
    byCategory[cat] = toRoast(entry, ctx);
  }

  // Best roast: the most data-specific line; ties broken by the seeded RNG.
  const top = Math.max(...chosen.map((e) => e.specificity));
  const best = pick(chosen.filter((e) => e.specificity === top), rng);
  return { byCategory, best: toRoast(best, ctx) };
}
