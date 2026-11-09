/**
 * Analysis engine types. The engine is pure and deterministic: the same
 * ScanReport (and seed, for roast variety) always yields the same Analysis.
 * It has no React, Tauri or network dependencies.
 */

export type Confidence = "high" | "medium" | "low";

/** One explainable contribution to a score. */
export interface Reason {
  /** Human-readable explanation, always grounded in a measured value. */
  text: string;
  /** Effect on the score: positive helps, negative hurts, neutral informs. */
  impact: "positive" | "negative" | "neutral";
}

export type CategoryId =
  | "hardware" | "memory" | "storage" | "startup" | "config" | "gaming";

export interface CategoryScore {
  id: CategoryId;
  label: string;
  /** 0-100, or null when there was not enough evidence to score. */
  score: number | null;
  confidence: Confidence;
  reasons: Reason[];
  /** What this score does NOT cover (shown in the UI to stay honest). */
  caveat?: string;
}

export type BottleneckKind =
  | "measured"       // observed in this scan
  | "potential"      // plausible from specs; not observed
  | "pairing"        // CPU/GPU class relationship; not a benchmark
  | "insufficient";  // we could not tell

export interface BottleneckObservation {
  kind: BottleneckKind;
  title: string;
  detail: string;
  confidence: Confidence;
  evidence: string[];
}

export interface PersonalityDef {
  id: string;
  title: string;
  /** lucide-react icon name. */
  icon: string;
  /** Color identity (hex). */
  color: string;
  description: string;
  /** Human-readable assignment conditions (shown in the UI). */
  conditions: string;
}

export interface PersonalityMatch {
  def: PersonalityDef;
  /** 0-1 strength; 0 means not eligible. */
  strength: number;
  reasons: string[];
}

export interface PersonalityResult {
  primary: PersonalityMatch;
  runnersUp: PersonalityMatch[];
}

export type RoastCategory = "hardware" | "startup" | "storage" | "gaming" | "overall";

export interface Roast {
  id: string;
  category: RoastCategory;
  text: string;
  /** How data-specific the line is (1 generic, 3 very specific). */
  specificity: 1 | 2 | 3;
}

export interface RoastSet {
  byCategory: Partial<Record<RoastCategory, Roast>>;
  best: Roast;
}

export interface Analysis {
  categories: CategoryScore[];
  /** 0-100 weighted over categories that could be scored; null if none could. */
  overall: { score: number | null; confidence: Confidence; verdict: string; reasons: Reason[] };
  bottlenecks: BottleneckObservation[];
  personality: PersonalityResult;
  roasts: RoastSet;
  /** Standing disclaimer: no gaming benchmark was run. */
  benchmarkNotice: string;
}
