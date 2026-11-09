import type { FullAnalysis } from "@/app/state";
import type { Facts } from "@/engine/facts";
import { eligibleRoasts } from "@/engine/roast";
import { buildWrapped } from "@/engine/wrapped";

export interface CardOptions {
  username: string;
  /** Hides identifying details: exact models, app names, drive letters, username. */
  privacy: boolean;
  watermark: boolean;
}

export interface CardData {
  username?: string;
  demo: boolean;
  privacy: boolean;
  watermark: boolean;
  score: number | null;
  verdict: string;
  confidence: string;
  personality: { title: string; icon: string; color: string; description: string };
  cpu: string;
  threads?: string;
  gpu: string;
  vram?: string;
  ram: string;
  storage: string;
  categories: { label: string; score: number | null }[];
  hardwareScore: number | null;
  strongest?: string;
  weakest?: string;
  startup: string;
  discovery: { title: string; text: string };
  roast: string;
  verdictLine: string;
}

const MAX_NAME = 24;

/**
 * Sanitizes the optional username. Removes control characters, bidi-override
 * characters (which can visually reorder text), angle brackets, and collapses
 * whitespace. Result is at most 24 characters. Canvas text is not HTML, but
 * the same rules keep exported images clean.
 */
export function sanitizeUsername(raw: string): string {
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(cleaned).slice(0, MAX_NAME).join("");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Identifier { term: string; replacement: string }

/** Everything in the scan that could identify this specific machine's setup. */
export function identifiersOf(f: Facts): Identifier[] {
  const ids: Identifier[] = [];
  const short = (f.gpuName ?? "").replace(/NVIDIA |GeForce |AMD |\(R\)|\(TM\)/g, "").replace(/\s+/g, " ").trim();
  if (f.gpuName) ids.push({ term: f.gpuName, replacement: "your GPU" });
  if (short && short !== f.gpuName) ids.push({ term: short, replacement: "your GPU" });
  if (f.cpuName) ids.push({ term: f.cpuName, replacement: "your CPU" });
  for (const n of f.startupNames) ids.push({ term: n, replacement: "an app" });
  for (const n of f.rgbApps) ids.push({ term: n, replacement: "lighting software" });
  for (const n of f.launchers) ids.push({ term: n, replacement: "a launcher" });
  for (const n of f.topProcesses) ids.push({ term: n.replace(/\.exe$/i, ""), replacement: "an app" });
  return ids.filter((i) => i.term.length >= 3).sort((a, b) => b.term.length - a.term.length);
}

export function redact(text: string, ids: Identifier[]): string {
  return ids.reduce((t, i) => t.replace(new RegExp(escapeRe(i.term), "gi"), i.replacement), text);
}

const mentions = (text: string, ids: Identifier[]) => ids.some((i) => new RegExp(escapeRe(i.term), "i").test(text));

/** Generic CPU label for privacy mode. Thread count is shown separately, so it is not repeated here. */
export const genericCpu = (vendor?: string) => (vendor ? `${vendor} processor` : "Processor");

export function vendorOf(name?: string): string | undefined {
  if (!name) return undefined;
  return /nvidia|geforce|rtx|gtx/i.test(name) ? "NVIDIA" : /amd|radeon|ryzen/i.test(name) ? "AMD" : /intel|arc/i.test(name) ? "Intel" : undefined;
}

const fmtTb = (tb: number) => (tb >= 1 ? `${tb.toFixed(1)} TB` : `${Math.round(tb * 1024)} GB`);

export function buildCardData(a: FullAnalysis, opts: CardOptions, demo: boolean): CardData {
  const f = a.facts;
  const w = buildWrapped(a);
  const privacy = opts.privacy;
  const ids = identifiersOf(f);
  const name = sanitizeUsername(opts.username);

  const gpuClass = f.gpuClass ? `${f.gpuClass.label.toLowerCase()}-class` : "";
  const cpuVendor = vendorOf(f.cpuName) ?? "";
  const gpuVendor = vendorOf(f.gpuName) ?? "";

  // Roast: in privacy mode prefer a line that names nothing identifying; redact as a last resort.
  let roast = a.roasts.best.text;
  if (privacy && mentions(roast, ids)) {
    const ctx = { f, s: Object.fromEntries(a.categories.filter((c) => c.score !== null).map((c) => [c.id, c.score as number])), overall: a.overall.score, personalityId: a.personality.primary.def.id };
    const safe = eligibleRoasts(ctx).filter((r) => !mentions(r.text, ids)).sort((x, y) => y.specificity - x.specificity || x.id.localeCompare(y.id));
    roast = safe.length ? safe[0].text : redact(roast, ids);
  }

  return {
    username: privacy || !name ? undefined : name,
    demo, privacy, watermark: opts.watermark,
    score: a.overall.score, verdict: a.overall.verdict, confidence: a.overall.confidence,
    personality: w.personality,
    cpu: f.cpuName ? (privacy ? genericCpu(cpuVendor) : f.cpuName) : "CPU unavailable",
    threads: f.logicalThreads !== undefined ? `${f.logicalThreads} threads${f.physicalCores !== undefined ? ` · ${f.physicalCores} cores` : ""}` : undefined,
    gpu: f.gpuName ? (privacy ? `${gpuVendor} ${gpuClass} GPU`.replace(/\s+/g, " ").trim() : f.gpuName.replace(/^NVIDIA /, "")) : "GPU unavailable",
    vram: f.gpuVramGb !== undefined && f.gpuVramGb >= 1 ? `${Math.round(f.gpuVramGb)} GB VRAM` : undefined,
    ram: f.ramGb !== undefined ? `${f.ramGb} GB RAM` : "RAM unavailable",
    storage: f.driveCount !== undefined ? `${f.driveCount} ${f.driveCount === 1 ? "drive" : "drives"}${f.totalStorageTb ? ` · ${fmtTb(f.totalStorageTb)}` : ""}` : "Storage unavailable",
    categories: a.categories.map((c) => ({ label: c.label, score: c.score })),
    hardwareScore: a.categories.find((c) => c.id === "hardware")?.score ?? null,
    strongest: w.strongest ? `${w.strongest.label} · ${w.strongest.score}` : undefined,
    weakest: w.weakest ? `${w.weakest.label} · ${w.weakest.score}` : undefined,
    startup: f.startupEnabled !== undefined ? `${f.startupEnabled} startup ${f.startupEnabled === 1 ? "app" : "apps"}` : "Startup unavailable",
    discovery: privacy ? { title: w.discovery.title, text: redact(w.discovery.text, ids) } : w.discovery,
    roast,
    verdictLine: w.verdictLine,
  };
}
