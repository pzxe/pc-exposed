import type { Facts } from "./facts";
import type { Analysis, CategoryScore } from "./types";

export interface WrappedData {
  score: number | null;
  verdict: string;
  confidence: string;
  personality: { title: string; icon: string; color: string; description: string };
  strongest?: { label: string; score: number };
  weakest?: { label: string; score: number; why: string };
  startupEnabled?: number;
  ramGb?: number;
  cpu?: string;
  threads?: number;
  gpu?: string;
  vramGb?: number;
  storage?: { drives?: number; totalTb?: number; systemFreePercent?: number };
  discovery: { title: string; text: string };
  bestRoast: string;
  verdictLine: string;
}

type Full = Analysis & { facts: Facts };

/** Picks the single most notable true thing about this PC (deterministic, first match wins). */
export function mostInteresting(f: Facts): { title: string; text: string } {
  if ((f.startupDisabled ?? 0) >= 5 && (f.startupDisabled ?? 0) > (f.startupEnabled ?? 0))
    return { title: "A tidy startup", text: `You've disabled ${f.startupDisabled} startup entries, more than the ${f.startupEnabled} still running.` };
  if ((f.uptimeDays ?? 0) >= 14)
    return { title: "Marathon runner", text: `This PC has been on for ${Math.round(f.uptimeDays!)} days without a restart.` };
  if (f.rgbApps.length >= 2)
    return { title: "Glow management", text: `${f.rgbApps.length} lighting/peripheral suites installed: ${f.rgbApps.join(", ")}.` };
  if ((f.driveCount ?? 0) >= 5)
    return { title: "Drive collector", text: `${f.driveCount} drives${f.totalStorageTb ? ` holding ${f.totalStorageTb.toFixed(1)} TB in total` : ""}.` };
  if ((f.gpuVramGb ?? 0) >= 12 && f.gpuName)
    return { title: "Memory to spare", text: `${f.gpuName} carries ${Math.round(f.gpuVramGb!)} GB of dedicated VRAM.` };
  if (f.launchers.length >= 3)
    return { title: "Launcher overload", text: `${f.launchers.length} game launchers are installed: ${f.launchers.join(", ")}.` };
  if (f.gpuIntegrated) return { title: "Integrated and proud", text: `Graphics come from the processor itself (${f.gpuName}).` };
  if ((f.appCount ?? 0) >= 150) return { title: "Software library", text: `${f.appCount} applications are installed.` };
  if (f.logicalThreads) return { title: "Quietly capable", text: `${f.logicalThreads} threads are available, and nothing odd stood out.` };
  return { title: "Refreshingly normal", text: "Nothing unusual stood out in this scan." };
}

const scored = (c: CategoryScore): c is CategoryScore & { score: number } => c.score !== null;

export function buildWrapped(a: Full): WrappedData {
  const f = a.facts;
  const cats = a.categories.filter(scored);
  const strongest = cats.length ? [...cats].sort((x, y) => y.score - x.score)[0] : undefined;
  const weakest = cats.length ? [...cats].sort((x, y) => x.score - y.score)[0] : undefined;
  const p = a.personality.primary.def;
  const weakWhy = weakest ? (weakest.reasons.find((r) => r.impact === "negative") ?? weakest.reasons[0])?.text ?? "" : "";

  const verdictLine =
    a.overall.score === null
      ? "There wasn't enough data to score this PC."
      : `${a.overall.verdict}. ${a.overall.score}/100 across ${cats.length} categories (${a.overall.confidence} confidence). ${p.description}`;

  return {
    score: a.overall.score,
    verdict: a.overall.verdict,
    confidence: a.overall.confidence,
    personality: { title: p.title, icon: p.icon, color: p.color, description: p.description },
    strongest: strongest && { label: strongest.label, score: strongest.score },
    weakest: weakest && { label: weakest.label, score: weakest.score, why: weakWhy },
    startupEnabled: f.startupEnabled,
    ramGb: f.ramGb,
    cpu: f.cpuName,
    threads: f.logicalThreads,
    gpu: f.gpuName,
    vramGb: f.gpuVramGb,
    storage: { drives: f.driveCount, totalTb: f.totalStorageTb, systemFreePercent: f.systemFreePercent },
    discovery: mostInteresting(f),
    bestRoast: a.roasts.best.text,
    verdictLine,
  };
}
