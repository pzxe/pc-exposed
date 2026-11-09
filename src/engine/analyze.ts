import type { ScanReport } from "@/lib/scanTypes";
import { extractFacts, type Facts } from "./facts";
import { scoreConfig, scoreGaming, scoreHardware, scoreMemory, scoreOverall, scoreStartup, scoreStorage } from "./scoring";
import { analyzeBottlenecks, BENCHMARK_NOTICE } from "./bottleneck";
import { classifyPersonality } from "./personality";
import { generateRoasts } from "./roast";
import type { Analysis, CategoryScore } from "./types";

export interface AnalyzeOptions {
  /** Seed for roast variety. Defaults to the scan timestamp (stable per scan). */
  seed?: number;
  /** Roast ids to avoid repeating (persisted by the app between scans). */
  recentRoastIds?: string[];
}

/**
 * Entry point of the analysis engine: ScanReport in, Analysis out.
 * Pure and deterministic for a given (scan, seed, recentRoastIds).
 */
export function analyze(scan: ScanReport, opts: AnalyzeOptions = {}): Analysis & { facts: Facts } {
  const facts = extractFacts(scan);
  const categories: CategoryScore[] = [
    scoreHardware(facts), scoreMemory(facts), scoreStorage(facts),
    scoreStartup(facts), scoreConfig(facts), scoreGaming(facts),
  ];
  const overall = scoreOverall(categories);
  const bottlenecks = analyzeBottlenecks(facts);

  const s: Partial<Record<CategoryScore["id"], number>> = {};
  for (const c of categories) if (c.score !== null) s[c.id] = c.score;

  const personality = classifyPersonality({ f: facts, s, bottlenecks });
  const roasts = generateRoasts(
    { f: facts, s, overall: overall.score, personalityId: personality.primary.def.id },
    { seed: opts.seed ?? scan.scannedAtMs, recentIds: opts.recentRoastIds },
  );

  return { facts, categories, overall, bottlenecks, personality, roasts, benchmarkNotice: BENCHMARK_NOTICE };
}
