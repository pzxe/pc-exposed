import type { CategoryScore, Confidence, Reason } from "./types";
import type { Facts } from "./facts";

/**
 * Transparent scoring. Each category returns a 0-100 score built from named
 * components, plus a Reason for every component that moved the score. A
 * category with no usable evidence returns score = null (never a made-up 0).
 */

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const gb = (n: number) => `${Math.round(n * 10) / 10} GB`;
const pos = (text: string): Reason => ({ text, impact: "positive" });
const neg = (text: string): Reason => ({ text, impact: "negative" });
const info = (text: string): Reason => ({ text, impact: "neutral" });

const TIER_SCORE = [18, 36, 55, 70, 85, 96];

function ramCapacityScore(g: number): number {
  if (g >= 60) return 100;
  if (g >= 30) return 92;
  if (g >= 15) return 72;
  if (g >= 7) return 42;
  return 20;
}

interface Part { weight: number; score: number }
/** Weighted mean that renormalizes over the parts that exist. */
function blend(parts: Part[]): number | null {
  const w = parts.reduce((a, p) => a + p.weight, 0);
  if (w === 0) return null;
  return parts.reduce((a, p) => a + p.score * p.weight, 0) / w;
}

export function scoreHardware(f: Facts): CategoryScore {
  const reasons: Reason[] = [];
  const parts: Part[] = [];

  if (f.cpuClass && f.logicalThreads !== undefined) {
    const s = TIER_SCORE[f.cpuClass.tier];
    parts.push({ weight: 0.4, score: s });
    const cores = f.physicalCores !== undefined ? `${f.physicalCores} cores / ` : "";
    reasons.push((s >= 70 ? pos : info)(`CPU class: ${f.cpuClass.label} (${cores}${f.logicalThreads} threads) — ${f.cpuClass.basis}.`));
  } else reasons.push(info("CPU details were unavailable, so the CPU was not scored."));

  if (f.gpuClass) {
    const s = TIER_SCORE[f.gpuClass.tier];
    parts.push({ weight: 0.4, score: s });
    reasons.push((s >= 70 ? pos : info)(`GPU class: ${f.gpuClass.label} (${f.gpuName}) — ${f.gpuClass.basis}.`));
  } else if (f.gpuName) {
    reasons.push(info(`"${f.gpuName}" is not a model this engine recognizes, so the GPU was not scored rather than guessed.`));
  } else reasons.push(info("No graphics adapter was reported, so the GPU was not scored."));

  if (f.ramGb !== undefined) {
    const s = ramCapacityScore(f.ramGb);
    parts.push({ weight: 0.2, score: s });
    reasons.push((s >= 70 ? pos : s < 50 ? neg : info)(`${gb(f.ramGb)} of RAM.`));
  }

  const score = blend(parts);
  const confidence: Confidence = parts.length === 3 ? "high" : parts.length === 2 ? "medium" : "low";
  return {
    id: "hardware", label: "Hardware Power",
    score: score === null ? null : clamp(score),
    confidence: parts.length === 0 ? "low" : confidence,
    reasons,
    caveat: "Classes are derived from specs and model names; no benchmark was run.",
  };
}

export function scoreMemory(f: Facts): CategoryScore {
  if (f.ramGb === undefined || f.ramUsedPercent === undefined) {
    return { id: "memory", label: "Memory Health", score: null, confidence: "low", reasons: [info("Memory data was unavailable.")] };
  }
  const reasons: Reason[] = [];
  const cap = ramCapacityScore(f.ramGb);
  reasons.push((cap >= 70 ? pos : cap < 50 ? neg : info)(`Capacity: ${gb(f.ramGb)} installed.`));

  const u = f.ramUsedPercent;
  const pressure = u < 60 ? 100 : u < 75 ? 85 : u < 85 ? 65 : u < 92 ? 40 : 20;
  reasons.push(
    (pressure >= 85 ? pos : pressure <= 40 ? neg : info)(`In use at scan time: ${Math.round(u)}% (${gb((f.ramUsableGb ?? f.ramGb) * (u / 100))} used).`),
  );
  if (f.topProcesses.length) reasons.push(info(`Largest memory consumers right now: ${f.topProcesses.slice(0, 3).join(", ")}.`));

  return {
    id: "memory", label: "Memory Health",
    score: clamp(cap * 0.6 + pressure * 0.4),
    confidence: "medium",
    reasons,
    caveat: "Usage is a single point-in-time reading; it changes with whatever is open.",
  };
}

export function scoreStorage(f: Facts): CategoryScore {
  if (f.systemFreePercent === undefined) {
    return { id: "storage", label: "Storage Health", score: null, confidence: "low", reasons: [info("The system drive could not be identified.")] };
  }
  const reasons: Reason[] = [];
  const p = f.systemFreePercent;
  let s = p >= 30 ? 100 : p >= 20 ? 85 : p >= 15 ? 70 : p >= 10 ? 50 : p >= 5 ? 25 : 10;
  reasons.push((s >= 85 ? pos : s <= 50 ? neg : info)(`System drive has ${Math.round(p)}% free (${gb(f.systemFreeGb ?? 0)}).`));

  if (f.systemDriveKind === "ssd") reasons.push(pos("System drive is an SSD."));
  else if (f.systemDriveKind === "hdd") {
    s -= 20;
    reasons.push(neg("System drive is a hard disk, which is slower for boot and loading."));
  } else reasons.push(info("System drive type was not reported, so no SSD/HDD adjustment was made."));

  if (f.lowestFreePercent !== undefined && f.lowestFreePercent < 5 && f.lowestFreePercent < p) {
    s -= 8;
    reasons.push(neg(`Another drive is nearly full (${Math.round(f.lowestFreePercent)}% free).`));
  }
  return {
    id: "storage", label: "Storage Health", score: clamp(s), confidence: "medium", reasons,
    caveat: "Based on free space and drive type. SMART/wear data is not read, so physical drive health is not assessed.",
  };
}

export function scoreStartup(f: Facts): CategoryScore {
  if (f.startupEnabled === undefined) {
    return { id: "startup", label: "Startup Efficiency", score: null, confidence: "low", reasons: [info("Startup entries were unavailable.")] };
  }
  const n = f.startupEnabled;
  const s = n <= 5 ? 100 : n <= 10 ? 85 : n <= 15 ? 70 : n <= 25 ? 50 : n <= 40 ? 30 : 15;
  const reasons: Reason[] = [
    (s >= 85 ? pos : s <= 50 ? neg : info)(`${n} enabled startup ${n === 1 ? "entry" : "entries"} found.`),
  ];
  if ((f.startupDisabled ?? 0) > 0) reasons.push(info(`${f.startupDisabled} more are present but disabled (they cost nothing).`));
  return {
    id: "startup", label: "Startup Efficiency", score: s, confidence: "medium", reasons,
    caveat: "Counts Run-key and Startup-folder entries only; scheduled tasks and services are not included, and boot time was not measured.",
  };
}

export function scoreConfig(f: Facts): CategoryScore {
  const reasons: Reason[] = [];
  let s = 100;
  let evidence = 0;

  if (f.isWindows11) { evidence++; reasons.push(pos(`${f.osName ?? "Windows 11"} is a currently supported Windows generation.`)); }
  else if (f.isWindows10) { evidence++; s -= 25; reasons.push(neg("Windows 10 is past its standard end of support (14 Oct 2025), so it no longer gets regular security updates without an extended-support program.")); }

  if (f.uptimeDays !== undefined) {
    evidence++;
    const d = f.uptimeDays;
    if (d > 30) { s -= 10; reasons.push(neg(`Up for ${Math.round(d)} days without a restart; updates may be waiting.`)); }
    else if (d > 14) { s -= 5; reasons.push(info(`Up for ${Math.round(d)} days.`)); }
    else reasons.push(pos(`Restarted recently (up ${d < 1 ? "under a day" : `${Math.round(d)} days`}).`));
  }

  if (f.appCount !== undefined) {
    evidence++;
    if (f.appCount > 300) { s -= 10; reasons.push(neg(`${f.appCount} installed applications is a lot to keep updated.`)); }
    else if (f.appCount > 200) { s -= 5; reasons.push(info(`${f.appCount} installed applications.`)); }
    else reasons.push(pos(`${f.appCount} installed applications is a manageable count.`));
  }

  if (evidence === 0) return { id: "config", label: "System Configuration", score: null, confidence: "low", reasons: [info("No OS or application data was available.")] };
  return {
    id: "config", label: "System Configuration", score: clamp(s), confidence: evidence >= 3 ? "medium" : "low", reasons,
    caveat: "Does not inspect drivers, update status, security settings or BIOS.",
  };
}

export function scoreGaming(f: Facts): CategoryScore {
  if (!f.gpuClass) {
    return {
      id: "gaming", label: "Gaming Readiness", score: null, confidence: "low",
      reasons: [info(f.gpuName ? `"${f.gpuName}" is not recognized, so gaming readiness cannot be estimated.` : "No graphics adapter was reported.")],
      caveat: "Estimated from component classes. No benchmark was run.",
    };
  }
  const reasons: Reason[] = [];
  const parts: Part[] = [];
  const gs = TIER_SCORE[f.gpuClass.tier];
  parts.push({ weight: 0.6, score: gs });
  reasons.push((gs >= 70 ? pos : gs < 50 ? neg : info)(`GPU class ${f.gpuClass.label} (${f.gpuName}).`));

  if (f.cpuClass) {
    const cs = TIER_SCORE[f.cpuClass.tier];
    parts.push({ weight: 0.2, score: cs });
    reasons.push((cs >= 70 ? pos : info)(`CPU class ${f.cpuClass.label} (${f.logicalThreads} threads) for game logic and streaming.`));
  }
  if (f.ramGb !== undefined) {
    const rs = ramCapacityScore(f.ramGb);
    parts.push({ weight: 0.15, score: rs });
    reasons.push((rs >= 70 ? pos : rs < 50 ? neg : info)(`${gb(f.ramGb)} RAM for modern games.`));
  }
  const ssd = f.systemDriveKind === "ssd" || f.ssdCount > 0;
  if (f.systemDriveKind !== undefined || f.ssdCount + f.hddCount > 0) {
    parts.push({ weight: 0.05, score: ssd ? 100 : 30 });
    reasons.push((ssd ? pos : neg)(ssd ? "SSD storage available for fast game loading." : "Only hard disks detected, so loading will be slower."));
  }

  let score = blend(parts) ?? 0;
  if (f.gpuVramGb !== undefined && f.gpuClass.tier > 0) {
    if (f.gpuVramGb < 6) { score -= 6; reasons.push(neg(`${gb(f.gpuVramGb)} of dedicated VRAM is tight for current high-detail textures.`)); }
    else if (f.gpuVramGb >= 12) { score += 2; reasons.push(pos(`${gb(f.gpuVramGb)} of VRAM gives headroom for high-resolution textures.`)); }
  }
  return {
    id: "gaming", label: "Gaming Readiness", score: clamp(score), confidence: f.gpuClass ? "medium" : "low", reasons,
    caveat: "An estimate from component classes. No game or benchmark was run, so real frame rates may differ.",
  };
}

const WEIGHTS: Record<string, number> = { hardware: 0.25, memory: 0.15, storage: 0.15, startup: 0.15, config: 0.1, gaming: 0.2 };
const CONF = { high: 3, medium: 2, low: 1 } as const;

export function verdictFor(score: number): string {
  if (score >= 90) return "Elite";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Solid";
  if (score >= 40) return "Fair";
  return "Needs love";
}

export function scoreOverall(categories: CategoryScore[]) {
  const scored = categories.filter((c) => c.score !== null);
  if (scored.length === 0) {
    return { score: null, confidence: "low" as Confidence, verdict: "Not enough data", reasons: [info("No category had enough evidence to score.")] };
  }
  const w = scored.reduce((a, c) => a + WEIGHTS[c.id], 0);
  const score = clamp(scored.reduce((a, c) => a + (c.score as number) * WEIGHTS[c.id], 0) / w);
  const avgConf = scored.reduce((a, c) => a + CONF[c.confidence], 0) / scored.length;
  const confidence: Confidence = scored.length >= 5 && avgConf >= 1.8 ? "medium" : "low";
  const reasons: Reason[] = scored.map((c) => info(`${c.label}: ${c.score}/100 (weight ${Math.round((WEIGHTS[c.id] / w) * 100)}%).`));
  if (scored.length < categories.length) {
    reasons.push(info(`${categories.length - scored.length} categor${categories.length - scored.length === 1 ? "y" : "ies"} lacked evidence and ${categories.length - scored.length === 1 ? "was" : "were"} excluded, not scored as zero.`));
  }
  return { score, confidence, verdict: verdictFor(score), reasons };
}
