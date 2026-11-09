import type { ReportV1 } from "./format";

export type Winner = "a" | "b" | "tie" | "n/a";

export interface CompareRow {
  id: string;
  label: string;
  a: string;
  b: string;
  winner: Winner;
  /** How the winner was decided, shown in the UI so no comparison is a black box. */
  basis: string;
}

export interface Comparison {
  rows: CompareRow[];
  aWins: number;
  bWins: number;
  ties: number;
  summary: string;
}

const NA = "Unavailable";

function higher(a: number | undefined, b: number | undefined): Winner {
  if (a === undefined || b === undefined) return "n/a";
  return a === b ? "tie" : a > b ? "a" : "b";
}
/** Like `higher`, but values within `rel` (e.g. 0.03 = 3%) of each other tie: avoids declaring a winner over rounding. */
function higherTol(a: number | undefined, b: number | undefined, rel: number): Winner {
  if (a === undefined || b === undefined) return "n/a";
  return Math.abs(a - b) <= Math.max(a, b) * rel ? "tie" : a > b ? "a" : "b";
}
const lower = (a?: number, b?: number): Winner => {
  const w = higher(a, b);
  return w === "a" ? "b" : w === "b" ? "a" : w;
};

const fmtTb = (tb?: number) => (tb === undefined ? NA : tb >= 1 ? `${tb.toFixed(1)} TB` : `${Math.round(tb * 1024)} GB`);
const catScore = (r: ReportV1, id: string): number | undefined => r.scores.categories.find((c) => c.id === id)?.score ?? undefined;

function cpuText(r: ReportV1): string {
  const c = r.system.cpu;
  if (!c) return NA;
  return [c.name, c.threads !== undefined ? `${c.threads} threads` : undefined].filter(Boolean).join(" · ") || NA;
}

function gpuText(r: ReportV1): string {
  const g = r.system.gpu;
  if (!g) return NA;
  return [g.name, g.vramGb !== undefined && g.vramGb >= 1 ? `${Math.round(g.vramGb)} GB VRAM` : undefined].filter(Boolean).join(" · ") || NA;
}

/** GPU: estimated class first, then dedicated VRAM as the tie-breaker. */
function gpuWinner(a: ReportV1, b: ReportV1): Winner {
  const ta = a.system.gpu?.tier, tb = b.system.gpu?.tier;
  if (ta === undefined || tb === undefined) return "n/a";
  if (ta !== tb) return ta > tb ? "a" : "b";
  return higher(a.system.gpu?.vramGb, b.system.gpu?.vramGb);
}

export function compareReports(a: ReportV1, b: ReportV1): Comparison {
  const score = (id: string, label: string): CompareRow => {
    const x = catScore(a, id), y = catScore(b, id);
    return { id, label, a: x === undefined ? NA : `${x}/100`, b: y === undefined ? NA : `${y}/100`, winner: higher(x, y), basis: "higher score wins" };
  };
  const rows: CompareRow[] = [
    {
      id: "overall", label: "Overall score",
      a: a.scores.overall === null ? NA : `${a.scores.overall}/100`, b: b.scores.overall === null ? NA : `${b.scores.overall}/100`,
      winner: higher(a.scores.overall ?? undefined, b.scores.overall ?? undefined), basis: "higher score wins",
    },
    { id: "cpu", label: "CPU", a: cpuText(a), b: cpuText(b), winner: higher(a.system.cpu?.threads, b.system.cpu?.threads), basis: "more threads wins (a rough proxy, not a benchmark)" },
    { id: "gpu", label: "GPU", a: gpuText(a), b: gpuText(b), winner: gpuWinner(a, b), basis: "higher estimated class wins, then more VRAM (not a benchmark)" },
    { id: "ram", label: "RAM", a: a.system.ramGb === undefined ? NA : `${a.system.ramGb} GB`, b: b.system.ramGb === undefined ? NA : `${b.system.ramGb} GB`, winner: higher(a.system.ramGb, b.system.ramGb), basis: "more memory wins" },
    { id: "storage", label: "Storage", a: fmtTb(a.system.storage?.totalTb), b: fmtTb(b.system.storage?.totalTb), winner: higherTol(a.system.storage?.totalTb, b.system.storage?.totalTb, 0.03), basis: "more total capacity wins (within 3% counts as a tie)" },
    {
      id: "startup", label: "Startup apps",
      a: a.system.startupEnabled === undefined ? NA : String(a.system.startupEnabled), b: b.system.startupEnabled === undefined ? NA : String(b.system.startupEnabled),
      winner: lower(a.system.startupEnabled, b.system.startupEnabled), basis: "fewer startup apps wins",
    },
    score("hardware", "Hardware Power"),
    score("gaming", "Gaming Readiness"),
    score("memory", "Memory Health"),
    score("storage", "Storage Health"),
    score("startup", "Startup Efficiency"),
    score("config", "System Configuration"),
  ];
  // The category rows reuse ids; keep row ids unique for React keys.
  rows.forEach((r, i) => { r.id = `${r.id}-${i}`; });

  const aWins = rows.filter((r) => r.winner === "a").length;
  const bWins = rows.filter((r) => r.winner === "b").length;
  const ties = rows.filter((r) => r.winner === "tie").length;
  const summary = aWins === bWins ? `Evenly matched: ${aWins} wins each` : `${aWins > bWins ? a.label : b.label} leads ${Math.max(aWins, bWins)}–${Math.min(aWins, bWins)}`;
  return { rows, aWins, bWins, ties, summary };
}
