/**
 * Glow-Up Plan: "what would raise my score, and by how much?"
 *
 * Each action is a concrete change to the measured Facts (e.g. "5 startup apps instead of 14").
 * The projected score is computed by re-running the SAME scoring rules on the changed facts,
 * so a projection can never disagree with how the real score is calculated. Nothing here is a
 * performance prediction; it is "what these rules would say".
 *
 * Pure and deterministic. No React, Tauri or network.
 */
import type { Facts } from "./facts";
import { classForTier } from "./hardwareClass";
import { scoreFacts } from "./analyze";
import type { CategoryId } from "./types";

export type Effort = "free" | "upgrade";

export interface CategoryChange { id: CategoryId; label: string; before: number | null; after: number | null }

export interface AdviceAction {
  id: string;
  effort: Effort;
  title: string;
  /** Why this matters for THIS PC, with the measured number. */
  why: string;
  /** How to do it, in plain steps. */
  how: string;
  /** Supporting specifics (e.g. the startup app names found). Shown in the app only. */
  details: string[];
  /** Honest limits of the projection. */
  caveat?: string;
  before: number;
  after: number;
  gain: number;
  changes: CategoryChange[];
}

export interface Projection { after: number; gain: number }

export interface GlowUpPlan {
  /** Current overall score; null when the PC could not be scored (then there is no plan). */
  current: number | null;
  actions: AdviceAction[];
  /** All free actions applied together (gains do not simply add up). */
  allFree?: Projection;
  /** Every action applied together. */
  everything?: Projection;
}

interface Candidate {
  id: string;
  effort: Effort;
  title: string;
  why: string;
  how: string;
  details?: string[];
  caveat?: string;
  apply: (f: Facts) => Facts;
}

const TARGET_STARTUP = 5;
const TARGET_FREE_PCT = 30;
const RAM_TIERS = [8, 16, 32, 64];
const gbText = (n: number) => (n >= 100 ? `${Math.round(n)} GB` : `${Math.round(n * 10) / 10} GB`);

/** The candidate actions that apply to these facts. Exported for tests. */
export function candidates(f: Facts): Candidate[] {
  const out: Candidate[] = [];

  // ── free ──
  if (f.startupEnabled !== undefined && f.startupEnabled > TARGET_STARTUP) {
    const n = f.startupEnabled;
    out.push({
      id: "startup-trim", effort: "free",
      title: `Trim startup apps to ${TARGET_STARTUP}`,
      why: `${n} apps start with Windows. Keeping only the ones you need right after sign-in is the cheapest win there is.`,
      how: "Open Task Manager (Ctrl+Shift+Esc) → Startup apps, select an app and choose Disable. Disabled apps still work when you open them.",
      details: f.startupNames.length ? [`Starting with Windows now: ${f.startupNames.join(", ")}.`] : [],
      apply: (x) => ({ ...x, startupEnabled: TARGET_STARTUP, startupDisabled: (x.startupDisabled ?? 0) + (n - TARGET_STARTUP), startupNames: x.startupNames.slice(0, TARGET_STARTUP) }),
    });
  }

  if (f.systemFreePercent !== undefined && f.systemFreeGb !== undefined && f.systemFreePercent < TARGET_FREE_PCT && f.systemFreePercent > 0) {
    const p = f.systemFreePercent;
    const totalGb = f.systemFreeGb / (p / 100);
    const needGb = totalGb * (TARGET_FREE_PCT / 100) - f.systemFreeGb;
    out.push({
      id: "disk-space", effort: "free",
      title: `Free ${gbText(needGb)} on the system drive`,
      why: `The system drive is ${Math.round(p)}% free (${gbText(f.systemFreeGb)}). Windows needs room for updates, caching and virtual memory.`,
      how: "Settings → System → Storage → Cleanup recommendations, then Temporary files. Uninstall large games or apps you no longer use, or move them to another drive.",
      details: [],
      apply: (x) => ({
        ...x, systemFreePercent: TARGET_FREE_PCT, systemFreeGb: totalGb * (TARGET_FREE_PCT / 100),
        // If the system drive was the fullest drive, it no longer is.
        lowestFreePercent: x.lowestFreePercent !== undefined && x.lowestFreePercent >= p - 0.01 ? TARGET_FREE_PCT : x.lowestFreePercent,
      }),
    });
  }

  if (f.uptimeDays !== undefined && f.uptimeDays > 14) {
    out.push({
      id: "restart", effort: "free",
      title: "Restart the PC",
      why: `It has been running for ${Math.round(f.uptimeDays)} days. Many Windows and driver updates only finish on a restart.`,
      how: "Save your work, then Start → Power → Update and restart (or Restart). Shut down does not count: Fast Startup resumes the old session.",
      details: [],
      apply: (x) => ({ ...x, uptimeDays: 0.5 }),
    });
  }

  if (f.ramUsedPercent !== undefined && f.ramUsedPercent >= 75) {
    out.push({
      id: "close-apps", effort: "free",
      title: "Close memory-heavy apps you are not using",
      why: `${Math.round(f.ramUsedPercent)}% of memory was in use during the scan.`,
      how: "Open Task Manager → Processes, sort by Memory, and close what you don't need. Browser tabs are often the biggest consumer.",
      details: f.topProcesses.length ? [`Largest right now: ${f.topProcesses.slice(0, 5).join(", ")}.`] : [],
      caveat: "Memory use is a moment-in-time reading; it rises again with whatever you open.",
      apply: (x) => ({ ...x, ramUsedPercent: 55 }),
    });
  }

  if (f.appCount !== undefined && f.appCount > 200) {
    out.push({
      id: "uninstall", effort: "free",
      title: "Uninstall apps you no longer use",
      why: `${f.appCount} installed applications is a lot to keep patched and updated.`,
      how: "Settings → Apps → Installed apps, sort by Last used or Size, and uninstall what you don't recognize needing.",
      details: [],
      apply: (x) => ({ ...x, appCount: 200 }),
    });
  }

  // ── upgrades ──
  if (f.ramGb !== undefined && f.ramGb < 30) {
    const next = RAM_TIERS.find((t) => t > f.ramGb! * 1.05) ?? 32;
    out.push({
      id: "ram-upgrade", effort: "upgrade",
      title: `Upgrade to ${next} GB of RAM`,
      why: `${gbText(f.ramGb)} is installed. Modern games, browsers and creative apps routinely use more.`,
      how: "Check how many memory slots are free and which type your board takes (Task Manager → Performance → Memory shows slots used and speed). Matched pairs are best.",
      details: [],
      caveat: "Laptops with soldered memory cannot be upgraded.",
      apply: (x) => {
        const usedGb = x.ramUsedPercent !== undefined && x.ramUsableGb !== undefined ? (x.ramUsedPercent / 100) * x.ramUsableGb : undefined;
        const usable = next * 0.97;
        return { ...x, ramGb: next, ramUsableGb: usable, ramUsedPercent: usedGb !== undefined ? Math.min(100, (usedGb / usable) * 100) : x.ramUsedPercent };
      },
    });
  }

  if (f.systemDriveKind === "hdd") {
    out.push({
      id: "ssd", effort: "upgrade",
      title: "Move Windows to an SSD",
      why: "The system drive is a hard disk. An SSD is the single biggest upgrade for boot, app launch and load times.",
      how: "A SATA or NVMe SSD and a cloning tool (most SSD makers provide one free) move your existing Windows over without reinstalling.",
      details: [],
      apply: (x) => ({ ...x, systemDriveKind: "ssd", ssdCount: x.ssdCount + 1, hddCount: Math.max(0, x.hddCount - 1) }),
    });
  }

  if (f.isWindows10) {
    out.push({
      id: "windows11", effort: "upgrade",
      title: "Move to Windows 11",
      why: "Windows 10 reached its standard end of support on 14 Oct 2025 and no longer gets regular security updates.",
      how: "Run the PC Health Check app to see if this PC qualifies, then use Settings → Windows Update. Back up first.",
      details: [],
      caveat: "This app does not check Windows 11 eligibility (TPM 2.0, supported CPU). Treat this as a goal, not a guarantee.",
      apply: (x) => ({ ...x, isWindows10: false, isWindows11: true, osName: "Windows 11" }),
    });
  }

  if (f.gpuClass && f.gpuClass.tier < 5) {
    const tier = (f.gpuClass.tier + 1) as 1 | 2 | 3 | 4 | 5;
    const target = classForTier(tier, "projected upgrade");
    out.push({
      id: "gpu-upgrade", effort: "upgrade",
      title: f.gpuClass.tier === 0 ? "Add a dedicated graphics card" : `Step up to a ${target.label.toLowerCase()}-class GPU`,
      why: `The graphics are ${f.gpuClass.label.toLowerCase()}-class (${f.gpuName}). The GPU carries most of the weight in games.`,
      how: "Check your power supply's wattage and connectors and the case's free length before buying. A one-class step is usually the best value.",
      details: [],
      caveat: "Classes are estimated from model names. This shows how the score would change, not frame rates.",
      apply: (x) => ({ ...x, gpuClass: target, gpuIntegrated: false, gpuName: x.gpuName, gpuVramGb: Math.max(x.gpuVramGb ?? 0, tier >= 3 ? 12 : 8) }),
    });
  }

  return out;
}

/** Builds the plan: each action's projected effect, best first, plus combined projections. */
export function buildPlan(f: Facts): GlowUpPlan {
  const base = scoreFacts(f);
  const current = base.overall.score;
  if (current === null) return { current: null, actions: [] };

  const cands = candidates(f);
  const actions: AdviceAction[] = [];
  for (const c of cands) {
    const next = scoreFacts(c.apply(f));
    const after = next.overall.score;
    if (after === null || after <= current) continue; // only show what actually moves the score
    const changes = base.categories
      .map((cat, i) => ({ id: cat.id, label: cat.label, before: cat.score, after: next.categories[i].score }))
      .filter((ch) => ch.after !== ch.before);
    actions.push({
      id: c.id, effort: c.effort, title: c.title, why: c.why, how: c.how, details: c.details ?? [], caveat: c.caveat,
      before: current, after, gain: after - current, changes,
    });
  }
  actions.sort((a, b) => b.gain - a.gain || (a.effort === b.effort ? 0 : a.effort === "free" ? -1 : 1));

  const combine = (list: Candidate[]): Projection | undefined => {
    if (list.length === 0) return undefined;
    const after = scoreFacts(list.reduce((acc, c) => c.apply(acc), f)).overall.score;
    return after === null || after <= current ? undefined : { after, gain: after - current };
  };
  const useful = cands.filter((c) => actions.some((a) => a.id === c.id));
  return {
    current, actions,
    allFree: combine(useful.filter((c) => c.effort === "free")),
    everything: combine(useful),
  };
}
