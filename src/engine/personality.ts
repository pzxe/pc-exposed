import type { BottleneckObservation, CategoryScore, PersonalityDef, PersonalityMatch, PersonalityResult } from "./types";
import type { Facts } from "./facts";

/** Everything a personality rule may look at. Built from real scan findings only. */
export interface PersonalityContext {
  f: Facts;
  /** Category scores by id; undefined when the category had no evidence. */
  s: Partial<Record<CategoryScore["id"], number>>;
  bottlenecks: BottleneckObservation[];
}

interface Rule {
  def: PersonalityDef;
  /** Returns strength 0-1 (0 = not eligible) and the evidence behind it. */
  evaluate: (c: PersonalityContext) => { strength: number; reasons: string[] };
}

const NONE = { strength: 0, reasons: [] as string[] };
const gb = (n: number) => `${Math.round(n)} GB`;

export const RULES: Rule[] = [
  {
    def: {
      id: "overkill-machine", title: "THE OVERKILL MACHINE", icon: "Rocket", color: "#FF8FB1",
      description: "Absurd amounts of hardware. This PC has never once been the bottleneck, and neither has anyone's patience for it.",
      conditions: "Hardware Power ≥ 92 and 64 GB or more of RAM.",
    },
    evaluate: ({ f, s }) => {
      if ((s.hardware ?? 0) >= 92 && (f.ramGb ?? 0) >= 60)
        return { strength: 0.9, reasons: [`Hardware Power ${s.hardware}/100`, `${gb(f.ramGb!)} of RAM`] };
      return NONE;
    },
  },
  {
    def: {
      id: "gaming-monster", title: "THE GAMING MONSTER", icon: "Gamepad2", color: "#A879FF",
      description: "Built to push pixels. The GPU is the star and everything else is the supporting cast.",
      conditions: "High-end or enthusiast GPU class and Gaming Readiness ≥ 85.",
    },
    evaluate: ({ f, s }) => {
      if (f.gpuClass && f.gpuClass.tier >= 4 && (s.gaming ?? 0) >= 85)
        return { strength: 0.6 + ((s.gaming ?? 85) - 85) / 100, reasons: [`${f.gpuName} (${f.gpuClass.label})`, `Gaming Readiness ${s.gaming}/100`] };
      return NONE;
    },
  },
  {
    def: {
      id: "silent-killer", title: "THE SILENT KILLER", icon: "Ghost", color: "#7FE0B0",
      description: "Strong hardware, quietly run. No clutter, no drama, just frames.",
      conditions: "Hardware Power ≥ 75 with Startup and Storage scores ≥ 85 and memory use under 70%.",
    },
    evaluate: ({ f, s }) => {
      if ((s.hardware ?? 0) >= 75 && (s.startup ?? 0) >= 85 && (s.storage ?? 0) >= 85 && (f.ramUsedPercent ?? 100) < 70)
        return { strength: 0.66, reasons: [`Hardware Power ${s.hardware}/100`, `${f.startupEnabled} startup entries`, `${Math.round(f.systemFreePercent ?? 0)}% free on the system drive`] };
      return NONE;
    },
  },
  {
    def: {
      id: "rgb-addict", title: "THE RGB ADDICT", icon: "Lightbulb", color: "#FF6AD5",
      description: "Lighting software is installed, and it is not shy about it. Performance may or may not be proportional to glow.",
      conditions: "Two or more RGB/peripheral suites installed (one gives a weaker match).",
    },
    evaluate: ({ f }) => {
      if (f.rgbApps.length >= 2) return { strength: 0.78, reasons: [`RGB/peripheral software found: ${f.rgbApps.join(", ")}`] };
      if (f.rgbApps.length === 1) return { strength: 0.5, reasons: [`RGB/peripheral software found: ${f.rgbApps[0]}`] };
      return NONE;
    },
  },
  {
    def: {
      id: "budget-survivor", title: "THE BUDGET SURVIVOR", icon: "LifeBuoy", color: "#F3C969",
      description: "Not the strongest machine, but it shows up every day and gets it done.",
      conditions: "Hardware Power below 45. This reflects capability, not age or price.",
    },
    evaluate: ({ s }) => {
      if (s.hardware !== undefined && s.hardware < 45)
        return { strength: 0.6 + (45 - s.hardware) / 100, reasons: [`Hardware Power ${s.hardware}/100`] };
      return NONE;
    },
  },
  {
    def: {
      id: "workhorse", title: "THE WORKHORSE", icon: "Hammer", color: "#6EC1FF",
      description: "Plenty of threads and memory for real work. It is not flashy; it is dependable.",
      conditions: "16 GB+ RAM, 12+ threads, and a GPU below enthusiast class.",
    },
    evaluate: ({ f }) => {
      if ((f.ramGb ?? 0) >= 15 && (f.logicalThreads ?? 0) >= 12 && (f.gpuClass?.tier ?? 0) <= 3)
        return { strength: 0.55, reasons: [`${f.logicalThreads} threads`, `${gb(f.ramGb!)} RAM`, ...(f.gpuClass ? [`GPU class ${f.gpuClass.label}`] : [])] };
      return NONE;
    },
  },
  {
    def: {
      id: "sleeping-giant", title: "THE SLEEPING GIANT", icon: "Moon", color: "#8E9BFF",
      description: "Serious hardware held back by housekeeping. A tidy-up would wake it right up.",
      conditions: "Hardware Power ≥ 75 but Startup < 50, Storage < 60, or Configuration < 60.",
    },
    evaluate: ({ f, s }) => {
      if ((s.hardware ?? 0) < 75) return NONE;
      const why: string[] = [];
      if ((s.startup ?? 100) < 50) why.push(`${f.startupEnabled} enabled startup entries`);
      if ((s.storage ?? 100) < 60) why.push(`only ${Math.round(f.systemFreePercent ?? 0)}% free on the system drive`);
      if ((s.config ?? 100) < 60) why.push(`System Configuration ${s.config}/100`);
      return why.length ? { strength: 0.72, reasons: [`Hardware Power ${s.hardware}/100`, ...why] } : NONE;
    },
  },
  {
    def: {
      id: "bottleneck-victim", title: "THE BOTTLENECK VICTIM", icon: "Funnel", color: "#FF9B5E",
      description: "Parts that are not quite on the same page. One of them is carrying the team.",
      conditions: "GPU class 2+ tiers above CPU class, or measured memory pressure alongside an upper-mid or better GPU.",
    },
    evaluate: ({ f, bottlenecks }) => {
      const mismatch = bottlenecks.find((b) => b.kind === "pairing" && /^GPU class is well above/.test(b.title));
      if (mismatch) return { strength: 0.75, reasons: [mismatch.title, ...mismatch.evidence] };
      const mem = bottlenecks.find((b) => b.kind === "measured" && /Memory pressure/.test(b.title));
      if (mem && (f.gpuClass?.tier ?? 0) >= 3) return { strength: 0.74, reasons: [mem.title, ...mem.evidence] };
      return NONE;
    },
  },
  {
    def: {
      id: "storage-hoarder", title: "THE STORAGE HOARDER", icon: "Archive", color: "#C9A27E",
      description: "Drives everywhere, and most of them are filling up. Everything is kept just in case.",
      conditions: "Any drive under 10% free, or 5+ drives that are 60%+ full overall.",
    },
    evaluate: ({ f }) => {
      if (f.lowestFreePercent !== undefined && f.lowestFreePercent < 10)
        return { strength: 0.8, reasons: [`A drive is down to ${Math.round(f.lowestFreePercent)}% free`] };
      if ((f.driveCount ?? 0) >= 5 && (f.totalUsedPercent ?? 0) >= 60)
        return { strength: 0.6, reasons: [`${f.driveCount} drives`, `${Math.round(f.totalUsedPercent!)}% used overall`] };
      return NONE;
    },
  },
  {
    def: {
      id: "clean-machine", title: "THE CLEAN MACHINE", icon: "Sparkles", color: "#5EEAD4",
      description: "Tidy, lean and well kept. Not the fastest on the block, but spotless.",
      conditions: "Startup, Storage and Configuration all ≥ 85, Memory ≥ 80, and Hardware Power below 75.",
    },
    evaluate: ({ s }) => {
      if ((s.hardware ?? 100) < 75 && (s.startup ?? 0) >= 85 && (s.storage ?? 0) >= 85 && (s.config ?? 0) >= 85 && (s.memory ?? 0) >= 80)
        return { strength: 0.62, reasons: [`Startup ${s.startup}`, `Storage ${s.storage}`, `Configuration ${s.config}`, `Memory ${s.memory}`] };
      return NONE;
    },
  },
  {
    def: {
      id: "chaos-engine", title: "THE CHAOS ENGINE", icon: "Tornado", color: "#FF6B6B",
      description: "Hundreds of things launching, installed and running at once. It works. Nobody knows how.",
      conditions: "30+ enabled startup entries, or 250+ installed apps.",
    },
    evaluate: ({ f }) => {
      const why: string[] = [];
      if ((f.startupEnabled ?? 0) >= 30) why.push(`${f.startupEnabled} enabled startup entries`);
      if ((f.appCount ?? 0) >= 250) why.push(`${f.appCount} installed applications`);
      return why.length ? { strength: 0.7 + why.length * 0.05, reasons: why } : NONE;
    },
  },
  {
    def: {
      id: "office-warrior", title: "THE OFFICE WARRIOR", icon: "Briefcase", color: "#9CA3AF",
      description: "Built for documents, calls and a hundred browser tabs. Gaming was never in the job description.",
      conditions: "Integrated graphics (or Gaming Readiness below 55) and moderate Hardware Power.",
    },
    evaluate: ({ f, s }) => {
      const lowGaming = f.gpuIntegrated === true || ((s.gaming ?? 100) < 55);
      if (lowGaming && (s.hardware ?? 0) >= 30 && (s.hardware ?? 100) < 70)
        return { strength: 0.58 + (f.hasBattery ? 0.05 : 0), reasons: [f.gpuIntegrated ? "Integrated graphics" : `Gaming Readiness ${s.gaming}/100`, ...(f.hasBattery ? ["Has a battery (portable)"] : [])] };
      return NONE;
    },
  },
];

export const PERSONALITIES: PersonalityDef[] = RULES.map((r) => r.def);

/** Used only when no rule matches: a neutral default, clearly labelled as such. */
const FALLBACK_ID = "workhorse";

export function classifyPersonality(ctx: PersonalityContext): PersonalityResult {
  const matches: PersonalityMatch[] = RULES.map((r) => ({ def: r.def, ...r.evaluate(ctx) }));
  const eligible = matches.filter((m) => m.strength > 0).sort((a, b) => b.strength - a.strength || a.def.id.localeCompare(b.def.id));

  if (eligible.length === 0) {
    const def = PERSONALITIES.find((d) => d.id === FALLBACK_ID)!;
    return {
      primary: { def, strength: 0.2, reasons: ["No strong signal in the scan matched a specific personality, so this neutral default was used."] },
      runnersUp: [],
    };
  }
  return { primary: eligible[0], runnersUp: eligible.slice(1, 3) };
}
