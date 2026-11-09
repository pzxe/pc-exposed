import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyze } from "@/engine/analyze";
import { makeScan } from "@/engine/testFixtures";
import type { FullAnalysis } from "@/app/state";
import {
  anonymizeReport, buildReport, cleanText, MAX_REPORT_BYTES, parseReportFile, serializeReport, validateReport, type ReportV1,
} from "./format";
import { compareReports } from "./compare";
import { clearAllLocalData, LOCAL_DATA_KEYS, MAX_REPORTS, REPORTS_KEY, reportStore } from "./store";
import { makeRng } from "@/engine/roast";

const analysis = (spec: Parameters<typeof makeScan>[0] = {}) => analyze(makeScan(spec), { seed: 1 }) as FullAnalysis;
const sample = () => buildReport(analysis({ gpu: "NVIDIA GeForce RTX 4080", vramGb: 16 }), { label: "Rig A", now: 1_767_225_600_000 });

describe("report building and the documented format", () => {
  it("round-trips through validation unchanged", () => {
    const r = sample();
    const v = validateReport(JSON.parse(serializeReport(r)));
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.report).toEqual(r);
  });

  it("contains no identifying scan details (processes, startup names, drive letters, apps)", () => {
    const a = analysis({ startupEnabled: ["Discord", "Steam"], procs: ["chrome.exe"], rgb: ["Corsair iCUE"], launchers: ["Steam"] });
    const json = serializeReport(buildReport(a));
    for (const secret of ["Discord", "chrome", "iCUE", "Steam", "C:\\\\", "mount"]) expect(json).not.toContain(secret);
  });

  it("the example in docs/report-format.md is a valid report", () => {
    const md = readFileSync(resolve(__dirname, "../../docs/report-format.md"), "utf8");
    const block = /```json\n([\s\S]*?)```/.exec(md)![1];
    const v = parseReportFile(block);
    expect(v.ok, JSON.stringify(v)).toBe(true);
  });

  it("anonymize hides exact models without mutating the original", () => {
    const r = sample();
    const before = JSON.stringify(r);
    const anon = anonymizeReport(r);
    expect(JSON.stringify(r)).toBe(before);
    expect(anon.privacy.modelsHidden).toBe(true);
    expect(anon.system.gpu?.name).toBe("NVIDIA enthusiast-class GPU");
    expect(JSON.stringify(anon)).not.toContain("RTX 4080");
    expect(JSON.stringify(anon)).not.toContain("Test CPU");
  });
});

describe("importing untrusted reports", () => {
  const good = () => JSON.parse(serializeReport(sample())) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const reject = (mutate: (r: Record<string, any>) => void, re: RegExp) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const r = good(); mutate(r);
    const v = validateReport(r);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.join("\n")).toMatch(re);
  };

  it("rejects non-reports, wrong versions and bad JSON with clear messages", () => {
    expect(validateReport("nope").ok).toBe(false);
    expect(validateReport([1, 2]).ok).toBe(false);
    expect(validateReport({}).ok).toBe(false);
    reject((r) => { r.format = "something"; }, /not a PC EXPOSED report/);
    reject((r) => { r.formatVersion = 2; }, /not support/);
    reject((r) => { r.formatVersion = "1"; }, /Unsupported/);
    expect(parseReportFile("{not json")).toEqual({ ok: false, errors: ["The file is not valid JSON."] });
  });

  it("enforces the size limit before parsing", () => {
    const huge = `{"format":"pc-exposed-report","pad":"${"x".repeat(MAX_REPORT_BYTES)}"}`;
    const r = parseReportFile(huge);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/larger than 1 MB/);
  });

  it("rejects out-of-range, wrong-typed and malformed fields with the field path", () => {
    reject((r) => { r.system.cpu.threads = 99999; }, /system\.cpu\.threads/);
    reject((r) => { r.system.cpu.threads = 8.5; }, /system\.cpu\.threads.*integer/);
    reject((r) => { r.system.ramGb = -4; }, /system\.ramGb/);
    reject((r) => { r.system.ramGb = "32"; }, /system\.ramGb/);
    reject((r) => { r.system.storage.systemFreePercent = 120; }, /systemFreePercent/);
    reject((r) => { r.system.storage.systemDriveKind = "nvme"; }, /systemDriveKind/);
    reject((r) => { r.scores.overall = 101; }, /scores\.overall/);
    reject((r) => { r.scores.categories[0].score = "high"; }, /scores\.categories\[0\]\.score/);
    reject((r) => { r.scores.categories[0].id = "evil"; }, /categories\[0\]\.id/);
    reject((r) => { r.scores.categories[1].id = r.scores.categories[0].id; }, /appears twice/);
    reject((r) => { r.scores.categories = []; }, /1-12 items/);
    reject((r) => { r.createdAt = 5; }, /createdAt/);
    reject((r) => { r.id = "../../etc/passwd"; }, /id must be/);
    reject((r) => { r.appVersion = "1.0; rm -rf"; }, /appVersion/);
    reject((r) => { r.personality.id = "Bad Id!"; }, /personality\.id/);
    reject((r) => { r.system = "x"; }, /system/);
  });

  it("sanitizes text and caps lengths instead of trusting it", () => {
    const r = good();
    r.label = `<img src=x onerror=alert(1)>\u202EEvil\u0000 ${"x".repeat(500)}`;
    r.system.gpu.name = "<script>alert(1)</script>GPU";
    const v = validateReport(r);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.report.label.length).toBeLessThanOrEqual(40);
    expect(v.report.label).not.toMatch(/[<>\u202E\u0000]/);
    expect(v.report.system.gpu!.name).not.toMatch(/[<>]/);
  });

  it("discards unknown fields and cannot be used for prototype pollution", () => {
    const text = serializeReport(sample()).replace(
      '"format"',
      '"__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted2": true}}, "evil": "<script>", "format"',
    );
    const v = parseReportFile(text);
    expect(v.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted2).toBeUndefined();
    if (v.ok) {
      expect(Object.keys(v.report).sort()).toEqual(["appVersion", "createdAt", "format", "formatVersion", "id", "label", "personality", "privacy", "scores", "system"]);
      expect(JSON.stringify(v.report)).not.toContain("evil");
    }
  });

  it("survives 1500 random mutations without throwing, and anything accepted is within bounds", () => {
    const base = JSON.parse(serializeReport(sample()));
    const rng = makeRng(1234);
    const junk: unknown[] = [null, undefined, "", "x".repeat(300), -1, 1e308, NaN, Infinity, [], {}, true, "<b>", { a: 1 }, [1, 2, 3], 0];
    const paths: string[][] = [];
    const walk = (o: unknown, p: string[]) => { if (o && typeof o === "object") for (const k of Object.keys(o)) { paths.push([...p, k]); walk((o as Record<string, unknown>)[k], [...p, k]); } };
    walk(base, []);
    for (let i = 0; i < 1500; i++) {
      const copy = JSON.parse(JSON.stringify(base));
      for (let m = 0; m < 1 + Math.floor(rng() * 3); m++) {
        const path = paths[Math.floor(rng() * paths.length)];
        let t = copy;
        for (let k = 0; k < path.length - 1 && t && typeof t === "object"; k++) t = t[path[k]];
        if (t && typeof t === "object") t[path[path.length - 1]] = junk[Math.floor(rng() * junk.length)];
      }
      const v = validateReport(copy);
      if (v.ok) {
        const r = v.report;
        expect(r.label.length).toBeLessThanOrEqual(40);
        expect(r.scores.categories.length).toBeLessThanOrEqual(12);
        for (const c of r.scores.categories) expect(c.score === null || (c.score >= 0 && c.score <= 100)).toBe(true);
        if (r.system.cpu?.threads !== undefined) expect(r.system.cpu.threads).toBeLessThanOrEqual(1024);
        expect(JSON.stringify(r)).not.toMatch(/[<>]/);
      } else {
        expect(v.errors.length).toBeGreaterThan(0);
        expect(v.errors.length).toBeLessThanOrEqual(12);
      }
    }
  });

  it("cleanText strips control and bidi characters and counts code points", () => {
    expect(cleanText("a\u202Eb\u0007c", 10)).toBe("abc");
    expect(cleanText("😀😀😀", 2)).toBe("😀😀");
  });
});

describe("comparison", () => {
  const rep = (spec: Parameters<typeof makeScan>[0], label: string) => buildReport(analysis(spec), { label, now: 1_767_225_600_000 });

  it("decides each row from real values and explains the basis", () => {
    const a = rep({ threads: 32, gpu: "NVIDIA GeForce RTX 4090", vramGb: 24, ramGb: 64, startupEnabled: 3 }, "Big");
    const b = rep({ threads: 8, gpu: "NVIDIA GeForce GTX 1660 SUPER", vramGb: 6, ramGb: 16, startupEnabled: 30 }, "Small");
    const c = compareReports(a, b);
    const row = (id: string) => c.rows.find((r) => r.id.startsWith(`${id}-`))!;
    expect(row("cpu").winner).toBe("a");
    expect(row("gpu").winner).toBe("a");
    expect(row("ram").winner).toBe("a");
    expect(row("startup").winner).toBe("a"); // fewer startup apps wins
    expect(row("overall").winner).toBe("a");
    expect(c.summary).toBe("Big leads " + c.aWins + "–" + c.bWins);
    for (const r of c.rows) expect(r.basis.length).toBeGreaterThan(5);
  });

  it("ties on equal values and reports n/a when data is missing (never as a loss)", () => {
    const a = rep({}, "A");
    const b = rep({}, "B");
    const same = compareReports(a, b);
    expect(same.aWins).toBe(0);
    expect(same.bWins).toBe(0);
    expect(same.summary).toMatch(/Evenly matched/);

    const missing = rep({ gpu: null, ramGb: null }, "Missing");
    const c = compareReports(a, missing);
    const gpu = c.rows.find((r) => r.id.startsWith("gpu-"))!;
    expect(gpu.winner).toBe("n/a");
    expect(gpu.b).toBe("Unavailable");
    expect(c.rows.find((r) => r.id.startsWith("ram-"))!.winner).toBe("n/a");
  });

  it("does not declare a storage winner over a rounding-level difference", () => {
    const a = rep({ drives: [{ mount: "C:\\", totalGb: 3512, freeGb: 1000, kind: "ssd", system: true }] }, "A");
    const b = { ...rep({ drives: [{ mount: "C:\\", totalGb: 3500, freeGb: 1000, kind: "ssd", system: true }] }, "B") };
    expect(compareReports(a, b).rows.find((r) => r.id.startsWith("storage-"))!.winner).toBe("tie");
    const c = rep({ drives: [{ mount: "C:\\", totalGb: 2000, freeGb: 1000, kind: "ssd", system: true }] }, "C");
    expect(compareReports(a, c).rows.find((r) => r.id.startsWith("storage-"))!.winner).toBe("a");
  });

  it("GPU compares estimated class first and VRAM only as tie-breaker", () => {
    const hiClassLowVram = rep({ gpu: "NVIDIA GeForce RTX 4080", vramGb: 8 }, "A");
    const loClassHiVram = rep({ gpu: "NVIDIA GeForce RTX 3060", vramGb: 24 }, "B");
    expect(compareReports(hiClassLowVram, loClassHiVram).rows.find((r) => r.id.startsWith("gpu-"))!.winner).toBe("a");
    const sameClass = compareReports(rep({ gpu: "NVIDIA GeForce RTX 4080", vramGb: 16 }, "A"), rep({ gpu: "NVIDIA GeForce RTX 4080", vramGb: 12 }, "B"));
    expect(sameClass.rows.find((r) => r.id.startsWith("gpu-"))!.winner).toBe("a");
  });
});

describe("local storage", () => {
  beforeEach(() => { localStorage.clear(); reportStore.invalidate(); });
  const mk = (label: string): ReportV1 => ({ ...sample(), label, id: `id-${label}-${Math.random().toString(36).slice(2, 8)}` });

  it("saves, lists, replaces by id, removes and clears", () => {
    const a = mk("alpha"), b = mk("beta");
    expect(reportStore.save(a, "local").ok).toBe(true);
    expect(reportStore.save(b, "imported").ok).toBe(true);
    expect(reportStore.list().map((s) => s.report.label)).toEqual(["beta", "alpha"]);
    expect(reportStore.list()[0].source).toBe("imported");
    reportStore.save({ ...a, label: "alpha2" }, "local");
    expect(reportStore.list().filter((s) => s.report.id === a.id)).toHaveLength(1);
    expect(reportStore.remove(a.id).ok).toBe(true);
    expect(reportStore.list()).toHaveLength(1);
    reportStore.clear();
    expect(reportStore.list()).toEqual([]);
    expect(localStorage.getItem(REPORTS_KEY)).toBeNull();
  });

  it("keeps the snapshot referentially stable until something changes", () => {
    reportStore.save(mk("x"), "local");
    const s1 = reportStore.getSnapshot();
    expect(reportStore.getSnapshot()).toBe(s1);
    reportStore.save(mk("y"), "local");
    expect(reportStore.getSnapshot()).not.toBe(s1);
  });

  it("enforces the report limit instead of silently dropping data", () => {
    for (let i = 0; i < MAX_REPORTS; i++) expect(reportStore.save(mk(`r${i}`), "local").ok).toBe(true);
    const over = reportStore.save(mk("overflow"), "local");
    expect(over.ok).toBe(false);
    expect(reportStore.list()).toHaveLength(MAX_REPORTS);
  });

  it("drops corrupted or tampered entries on read instead of trusting them", () => {
    const good = sample();
    const tampered = { ...good, system: { ...good.system, ramGb: -999 }, id: "tampered-1" };
    localStorage.setItem(REPORTS_KEY, JSON.stringify([
      { report: good, source: "local", savedAt: 1 }, { report: tampered, source: "local", savedAt: 2 },
      { report: "garbage", source: "local" }, null, 7, { source: "imported" },
    ]));
    reportStore.invalidate();
    expect(reportStore.list().map((s) => s.report.id)).toEqual([good.id]);
    localStorage.setItem(REPORTS_KEY, "{{{not json");
    reportStore.invalidate();
    expect(reportStore.list()).toEqual([]);
  });

  it("clearAllLocalData removes every key the app owns", () => {
    for (const k of LOCAL_DATA_KEYS) localStorage.setItem(k, "x");
    localStorage.setItem("unrelated-key", "keep");
    clearAllLocalData();
    for (const k of LOCAL_DATA_KEYS) expect(localStorage.getItem(k)).toBeNull();
    expect(localStorage.getItem("unrelated-key")).toBe("keep");
  });
});

describe("rendering safety (static guard)", () => {
  it("app code never uses raw-HTML or dynamic-code sinks", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.|testFixtures/.test(name)) files.push(p);
      }
    };
    walk(resolve(__dirname, ".."));
    const bad = /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write|\beval\s*\(|new Function\s*\(/;
    const offenders = files.filter((f) => bad.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
