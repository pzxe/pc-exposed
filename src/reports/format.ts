/**
 * PC EXPOSED report format, version 1. Documented in docs/report-format.md.
 *
 * A report is a SUMMARY: hardware class facts and scores. It deliberately has
 * no process names, startup app names, installed-app lists, drive letters,
 * MAC/IP addresses or raw scan data.
 *
 * Imported files are untrusted input. `validateReport` never copies the input
 * object: it reads only whitelisted fields and rebuilds a clean report, so
 * unknown fields (including `__proto__`/`constructor` tricks) are discarded.
 */
import type { FullAnalysis } from "@/app/state";
import type { CategoryId } from "@/engine/types";
import { genericCpu, vendorOf } from "@/share/cardData";
import { APP_VERSION } from "@/lib/version";

export const REPORT_FORMAT = "pc-exposed-report" as const;
export const REPORT_VERSION = 1 as const;
export const MAX_REPORT_BYTES = 1024 * 1024; // 1 MB

export const CATEGORY_IDS: readonly CategoryId[] = ["hardware", "memory", "storage", "startup", "config", "gaming"];

export interface ReportV1 {
  format: typeof REPORT_FORMAT;
  formatVersion: typeof REPORT_VERSION;
  id: string;
  /** Unix epoch milliseconds. */
  createdAt: number;
  label: string;
  appVersion: string;
  system: {
    cpu?: { name?: string; threads?: number; cores?: number; maxClockGhz?: number; tier?: number };
    gpu?: { name?: string; vramGb?: number; tier?: number; classLabel?: string };
    ramGb?: number;
    storage?: { drives?: number; totalTb?: number; systemFreePercent?: number; systemDriveKind?: "ssd" | "hdd" };
    os?: { name?: string; isWindows11?: boolean };
    startupEnabled?: number;
    appCount?: number;
  };
  scores: {
    overall: number | null;
    verdict: string;
    categories: { id: CategoryId; label: string; score: number | null }[];
  };
  personality?: { id: string; title: string };
  privacy: { modelsHidden: boolean };
}

// ───────────────────────── sanitizing ─────────────────────────

/**
 * Removes control characters, bidi overrides/zero-width characters and angle
 * brackets, collapses whitespace and caps the length (in code points).
 */
export function cleanText(raw: string, max: number): string {
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(cleaned).slice(0, max).join("");
}

// ───────────────────────── building ─────────────────────────

export function newReportId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function buildReport(a: FullAnalysis, opts: { label?: string; now?: number; appVersion?: string } = {}): ReportV1 {
  const f = a.facts;
  const now = opts.now ?? Date.now();
  const r: ReportV1 = {
    format: REPORT_FORMAT, formatVersion: REPORT_VERSION, id: newReportId(), createdAt: now,
    label: cleanText(opts.label ?? `${a.personality.primary.def.title} · ${new Date(now).toLocaleDateString()}`, 40) || "My PC",
    appVersion: opts.appVersion ?? APP_VERSION,
    system: {
      cpu: f.cpuName !== undefined || f.logicalThreads !== undefined
        ? { name: f.cpuName, threads: f.logicalThreads, cores: f.physicalCores, maxClockGhz: f.maxClockGhz, tier: f.cpuClass?.tier } : undefined,
      gpu: f.gpuName ? { name: f.gpuName, vramGb: f.gpuVramGb, tier: f.gpuClass?.tier, classLabel: f.gpuClass?.label } : undefined,
      ramGb: f.ramGb,
      storage: f.driveCount !== undefined
        ? { drives: f.driveCount, totalTb: f.totalStorageTb, systemFreePercent: f.systemFreePercent, systemDriveKind: f.systemDriveKind } : undefined,
      os: f.osName !== undefined ? { name: f.osName, isWindows11: f.isWindows11 } : undefined,
      startupEnabled: f.startupEnabled,
      appCount: f.appCount,
    },
    scores: {
      overall: a.overall.score,
      verdict: a.overall.verdict,
      categories: a.categories.map((c) => ({ id: c.id, label: c.label, score: c.score })),
    },
    personality: { id: a.personality.primary.def.id, title: a.personality.primary.def.title },
    privacy: { modelsHidden: false },
  };
  return JSON.parse(JSON.stringify(r)) as ReportV1; // drops `undefined` fields
}

/** Replaces exact CPU/GPU model names with generic classes. */
export function anonymizeReport(r: ReportV1): ReportV1 {
  const out = JSON.parse(JSON.stringify(r)) as ReportV1;
  const cpu = out.system.cpu;
  if (cpu?.name) cpu.name = genericCpu(vendorOf(cpu.name));
  const gpu = out.system.gpu;
  if (gpu?.name) gpu.name = `${vendorOf(gpu.name) ?? ""} ${gpu.classLabel ? `${gpu.classLabel.toLowerCase()}-class ` : ""}GPU`.replace(/\s+/g, " ").trim();
  out.privacy.modelsHidden = true;
  return out;
}

export function serializeReport(r: ReportV1): string {
  return JSON.stringify(r, null, 2);
}

// ───────────────────────── validation ─────────────────────────

export type ParseResult = { ok: true; report: ReportV1 } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const own = (o: Obj, k: string): unknown => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const MAX_ERRORS = 12;

class Ctx {
  errors: string[] = [];
  err(msg: string) { if (this.errors.length < MAX_ERRORS) this.errors.push(msg); }

  num(o: Obj, key: string, path: string, min: number, max: number, int = false): number | undefined {
    const v = own(o, key);
    if (v === undefined || v === null) return undefined;
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) {
      this.err(`${path}.${key} must be ${int ? "an integer" : "a number"} between ${min} and ${max}`);
      return undefined;
    }
    return v;
  }
  str(o: Obj, key: string, path: string, max: number): string | undefined {
    const v = own(o, key);
    if (v === undefined || v === null) return undefined;
    if (typeof v !== "string") { this.err(`${path}.${key} must be a string`); return undefined; }
    const c = cleanText(v, max);
    return c === "" ? undefined : c;
  }
  bool(o: Obj, key: string, path: string): boolean | undefined {
    const v = own(o, key);
    if (v === undefined || v === null) return undefined;
    if (typeof v !== "boolean") { this.err(`${path}.${key} must be true or false`); return undefined; }
    return v;
  }
  obj(o: Obj, key: string, path: string): Obj | undefined {
    const v = own(o, key);
    if (v === undefined || v === null) return undefined;
    if (!isObj(v)) { this.err(`${path}.${key} must be an object`); return undefined; }
    return v;
  }
}

const strip = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Validates untrusted data and returns a freshly built, sanitized report. */
export function validateReport(input: unknown): ParseResult {
  const c = new Ctx();
  if (!isObj(input)) return { ok: false, errors: ["The file must contain a JSON object."] };

  if (own(input, "format") !== REPORT_FORMAT) return { ok: false, errors: [`This is not a PC EXPOSED report (format must be "${REPORT_FORMAT}").`] };
  const version = own(input, "formatVersion");
  if (version !== REPORT_VERSION) {
    return { ok: false, errors: [typeof version === "number" && version > REPORT_VERSION
      ? `This report uses format version ${version}, which this app version does not support. Update PC EXPOSED.`
      : `Unsupported report format version (expected ${REPORT_VERSION}).`] };
  }

  const id = own(input, "id");
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{6,64}$/.test(id)) c.err("id must be 6-64 letters, digits, '-' or '_'");
  const createdAt = c.num(input, "createdAt", "report", 1577836800000, 4102444800000, true);
  if (createdAt === undefined) c.err("createdAt is required");
  const label = c.str(input, "label", "report", 40) ?? "Imported PC";
  const appVersion = c.str(input, "appVersion", "report", 32);
  if (appVersion !== undefined && !/^[0-9A-Za-z.+-]+$/.test(appVersion)) c.err("appVersion has invalid characters");

  // system
  const sys = c.obj(input, "system", "report");
  if (!sys) c.err("system is required");
  const system: ReportV1["system"] = {};
  if (sys) {
    const cpu = c.obj(sys, "cpu", "system");
    if (cpu) system.cpu = strip({
      name: c.str(cpu, "name", "system.cpu", 80), threads: c.num(cpu, "threads", "system.cpu", 1, 1024, true),
      cores: c.num(cpu, "cores", "system.cpu", 1, 1024, true), maxClockGhz: c.num(cpu, "maxClockGhz", "system.cpu", 0.1, 10),
      tier: c.num(cpu, "tier", "system.cpu", 0, 5, true),
    });
    const gpu = c.obj(sys, "gpu", "system");
    if (gpu) system.gpu = strip({
      name: c.str(gpu, "name", "system.gpu", 100), vramGb: c.num(gpu, "vramGb", "system.gpu", 0, 1024),
      tier: c.num(gpu, "tier", "system.gpu", 0, 5, true), classLabel: c.str(gpu, "classLabel", "system.gpu", 20),
    });
    system.ramGb = c.num(sys, "ramGb", "system", 0.1, 16384);
    const st = c.obj(sys, "storage", "system");
    if (st) {
      const kind = own(st, "systemDriveKind");
      if (kind !== undefined && kind !== null && kind !== "ssd" && kind !== "hdd") c.err('system.storage.systemDriveKind must be "ssd" or "hdd"');
      system.storage = strip<NonNullable<ReportV1["system"]["storage"]>>({
        drives: c.num(st, "drives", "system.storage", 0, 256, true), totalTb: c.num(st, "totalTb", "system.storage", 0, 10000),
        systemFreePercent: c.num(st, "systemFreePercent", "system.storage", 0, 100),
        systemDriveKind: kind === "ssd" ? "ssd" : kind === "hdd" ? "hdd" : undefined,
      });
    }
    const os = c.obj(sys, "os", "system");
    if (os) system.os = strip({ name: c.str(os, "name", "system.os", 60), isWindows11: c.bool(os, "isWindows11", "system.os") });
    system.startupEnabled = c.num(sys, "startupEnabled", "system", 0, 100000, true);
    system.appCount = c.num(sys, "appCount", "system", 0, 100000, true);
  }

  // scores
  const sc = c.obj(input, "scores", "report");
  if (!sc) c.err("scores is required");
  let overall: number | null = null;
  let verdict = "";
  const categories: ReportV1["scores"]["categories"] = [];
  if (sc) {
    const o = own(sc, "overall");
    if (o === null) overall = null;
    else if (typeof o === "number" && Number.isFinite(o) && o >= 0 && o <= 100) overall = Math.round(o);
    else c.err("scores.overall must be a number between 0 and 100, or null");
    verdict = c.str(sc, "verdict", "scores", 24) ?? "";
    const cats = own(sc, "categories");
    if (!Array.isArray(cats) || cats.length < 1 || cats.length > 12) c.err("scores.categories must be a list of 1-12 items");
    else {
      const seen = new Set<string>();
      cats.forEach((item, i) => {
        const p = `scores.categories[${i}]`;
        if (!isObj(item)) return c.err(`${p} must be an object`);
        const cid = own(item, "id");
        if (typeof cid !== "string" || !CATEGORY_IDS.includes(cid as CategoryId)) return c.err(`${p}.id must be one of ${CATEGORY_IDS.join(", ")}`);
        if (seen.has(cid)) return c.err(`${p}.id "${cid}" appears twice`);
        seen.add(cid);
        const s = own(item, "score");
        let score: number | null = null;
        if (s === null) score = null;
        else if (typeof s === "number" && Number.isFinite(s) && s >= 0 && s <= 100) score = Math.round(s);
        else return c.err(`${p}.score must be a number between 0 and 100, or null`);
        categories.push({ id: cid as CategoryId, label: c.str(item, "label", p, 40) ?? cid, score });
      });
    }
  }

  // personality
  let personality: ReportV1["personality"];
  const pr = c.obj(input, "personality", "report");
  if (pr) {
    const pid = own(pr, "id");
    const title = c.str(pr, "title", "personality", 40);
    if (typeof pid !== "string" || !/^[a-z][a-z0-9-]{0,39}$/.test(pid)) c.err("personality.id must be lowercase letters, digits and '-'");
    else if (title) personality = { id: pid, title };
  }

  const priv = c.obj(input, "privacy", "report");
  const modelsHidden = priv ? c.bool(priv, "modelsHidden", "privacy") ?? false : false;

  if (c.errors.length > 0 || createdAt === undefined) return { ok: false, errors: c.errors };
  return {
    ok: true,
    report: {
      format: REPORT_FORMAT, formatVersion: REPORT_VERSION, id: id as string, createdAt, label,
      appVersion: appVersion ?? "unknown", system: JSON.parse(JSON.stringify(system)) as ReportV1["system"],
      scores: { overall, verdict, categories }, ...(personality ? { personality } : {}), privacy: { modelsHidden },
    },
  };
}

/** Parses the text of an imported file. Applies the size limit before any parsing. */
export function parseReportFile(text: string): ParseResult {
  if (new TextEncoder().encode(text).length > MAX_REPORT_BYTES) {
    return { ok: false, errors: ["The file is larger than 1 MB, which a PC EXPOSED report never is."] };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["The file is not valid JSON."] };
  }
  return validateReport(data);
}
