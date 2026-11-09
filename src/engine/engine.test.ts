import { describe, it, expect } from "vitest";
import { analyze } from "./analyze";
import { classifyGpu, classifyCpu } from "./hardwareClass";
import { PERSONALITIES } from "./personality";
import { ROAST_LIBRARY } from "./roastLibrary";
import { eligibleRoasts, generateRoasts, makeRng, ROAST_CATEGORIES } from "./roast";
import { makeScan, type Spec } from "./testFixtures";

const GOOD_DRIVE = [{ mount: "C:\\", totalGb: 1000, freeGb: 500, kind: "ssd" as const, system: true }];

describe("hardware classification", () => {
  it.each([
    ["NVIDIA GeForce RTX 5090", 5], ["NVIDIA GeForce RTX 5080", 5], ["NVIDIA GeForce RTX 4070 Ti", 4],
    ["NVIDIA GeForce RTX 4060", 3], ["NVIDIA GeForce RTX 3080", 4], ["NVIDIA GeForce RTX 3060", 2],
    ["NVIDIA GeForce GTX 1080", 3], ["NVIDIA GeForce GTX 1660 SUPER", 2], ["NVIDIA GeForce GTX 1050 Ti", 1],
    ["AMD Radeon RX 7900 XTX", 5], ["AMD Radeon RX 6600", 2], ["AMD Radeon RX 580", 2], ["AMD Radeon RX 9070 XT", 4],
    ["Intel(R) Arc(TM) A770 Graphics", 3], ["Intel(R) Arc(TM) B580 Graphics", 3], ["Intel(R) UHD Graphics 770", 0],
    ["AMD Radeon(TM) Graphics", 0],
  ])("%s → tier %i", (name, tier) => {
    expect(classifyGpu(name)?.tier).toBe(tier);
  });

  it("returns undefined for unknown models instead of guessing", () => {
    expect(classifyGpu("Mystery Accelerator 9000")).toBeUndefined();
  });

  it("classifies CPUs by measured threads, not model names", () => {
    expect(classifyCpu(32).tier).toBe(5);
    expect(classifyCpu(16).tier).toBe(4);
    expect(classifyCpu(8).tier).toBe(2);
    expect(classifyCpu(4, 1500).tier).toBe(0); // low-clock penalty
  });
});

describe("RAM nominal size", () => {
  it("snaps usable memory to the installed size only when close", async () => {
    const { nominalRamGb } = await import("./facts");
    expect(nominalRamGb(31.1)).toBe(32);
    expect(nominalRamGb(15.6)).toBe(16);
    expect(nominalRamGb(63.8)).toBe(64);
    expect(nominalRamGb(20)).toBe(20); // not near a standard size: reported as-is
  });

  it("snaps VRAM the same way (15.6 → 16) and leaves odd sizes alone", async () => {
    const { nominalVramGb } = await import("./facts");
    expect(nominalVramGb(15.6)).toBe(16);
    expect(nominalVramGb(7.8)).toBe(8);
    expect(nominalVramGb(0.5)).toBe(0.5);
  });
});

describe("scoring", () => {
  it("every score is 0-100 and has at least one reason", () => {
    const a = analyze(makeScan({ drives: GOOD_DRIVE }));
    for (const c of a.categories) {
      expect(c.reasons.length).toBeGreaterThan(0);
      if (c.score !== null) expect(c.score).toBeGreaterThanOrEqual(0), expect(c.score).toBeLessThanOrEqual(100);
    }
    expect(a.overall.score).not.toBeNull();
  });

  it("missing data yields null scores, never zero", () => {
    const a = analyze(makeScan({ threads: null, ramGb: null, gpu: null, drives: null }));
    const by = Object.fromEntries(a.categories.map((c) => [c.id, c]));
    expect(by.memory.score).toBeNull();
    expect(by.storage.score).toBeNull();
    expect(by.gaming.score).toBeNull();
    expect(by.hardware.score).toBeNull();
    expect(by.hardware.confidence).toBe("low");
    // startup and config still have evidence, so overall exists and excludes the rest
    expect(a.overall.score).not.toBeNull();
    expect(a.overall.reasons.some((r) => /excluded, not scored as zero/.test(r.text))).toBe(true);
  });

  it("overall is null when nothing can be scored", () => {
    const s = makeScan({ threads: null, ramGb: null, gpu: null, drives: null });
    s.startup = { status: "unavailable", reason: "x" };
    s.os = { status: "unavailable", reason: "x" };
    s.apps = { status: "unavailable", reason: "x" };
    const a = analyze(s);
    expect(a.overall.score).toBeNull();
    expect(a.overall.verdict).toBe("Not enough data");
  });

  it("hardware confidence reflects how many parts could be scored", () => {
    expect(analyze(makeScan()).categories[0].confidence).toBe("high");
    expect(analyze(makeScan({ gpu: "Mystery Accelerator" })).categories[0].confidence).toBe("medium");
  });

  it("unrecognized GPU is not scored and says so", () => {
    const a = analyze(makeScan({ gpu: "Mystery Accelerator" }));
    const hw = a.categories.find((c) => c.id === "hardware")!;
    expect(hw.reasons.some((r) => /not a model this engine recognizes/.test(r.text))).toBe(true);
    expect(a.categories.find((c) => c.id === "gaming")!.score).toBeNull();
  });

  it("does not penalize old hardware for being old: a clean old PC scores well on everything but raw power", () => {
    const a = analyze(makeScan({
      threads: 4, ramGb: 8, ramUsedPct: 40, gpu: "NVIDIA GeForce GTX 1050 Ti", vramGb: 4,
      startupEnabled: 3, drives: GOOD_DRIVE, apps: 60,
    }));
    const by = Object.fromEntries(a.categories.map((c) => [c.id, c.score]));
    expect(by.storage).toBe(100);
    expect(by.startup).toBe(100);
    expect(by.config).toBe(100);
    expect(by.hardware).toBeLessThan(45);
  });

  it("penalizes a full system drive, an HDD boot drive and Windows 10", () => {
    const base = analyze(makeScan({ drives: GOOD_DRIVE }));
    const full = analyze(makeScan({ drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 30, kind: "ssd", system: true }] }));
    const hdd = analyze(makeScan({ drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 500, kind: "hdd", system: true }] }));
    const w10 = analyze(makeScan({ drives: GOOD_DRIVE, build: "19045.1" }));
    const sc = (x: ReturnType<typeof analyze>, id: string) => x.categories.find((c) => c.id === id)!.score!;
    expect(sc(full, "storage")).toBeLessThan(sc(base, "storage"));
    expect(sc(hdd, "storage")).toBe(sc(base, "storage") - 20);
    expect(sc(w10, "config")).toBeLessThan(sc(base, "config"));
  });

  it("unknown drive type adds no SSD/HDD adjustment", () => {
    const a = analyze(makeScan({ drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 500, kind: null, system: true }] }));
    const st = a.categories.find((c) => c.id === "storage")!;
    expect(st.score).toBe(100);
    expect(st.reasons.some((r) => /not reported/.test(r.text))).toBe(true);
  });

  it("startup score steps down with entry count", () => {
    const sc = (n: number) => analyze(makeScan({ startupEnabled: n })).categories.find((c) => c.id === "startup")!.score!;
    expect(sc(3)).toBe(100);
    expect(sc(8)).toBe(85);
    expect(sc(20)).toBe(50);
    expect(sc(50)).toBe(15);
  });

  it("is deterministic", () => {
    const s = makeScan({ drives: GOOD_DRIVE });
    expect(analyze(s, { seed: 7 })).toEqual(analyze(s, { seed: 7 }));
  });
});

describe("bottleneck analysis", () => {
  const kinds = (spec: Spec) => analyze(makeScan(spec)).bottlenecks;

  it("reports measured pressure only when it was actually measured", () => {
    expect(kinds({ ramUsedPct: 40 }).some((b) => b.kind === "measured")).toBe(false);
    const m = kinds({ ramUsedPct: 95, drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 50, kind: "ssd", system: true }] }).filter((b) => b.kind === "measured");
    expect(m.map((b) => b.title)).toEqual(expect.arrayContaining(["Memory pressure right now", "System drive nearly full"]));
  });

  it("flags GPU/CPU class gaps as pairing observations, never as measured", () => {
    const b = kinds({ threads: 4, gpu: "NVIDIA GeForce RTX 4080" });
    const pair = b.find((x) => x.kind === "pairing")!;
    expect(pair.title).toMatch(/GPU class is well above CPU class/);
    expect(pair.detail).toMatch(/not a measured bottleneck/);
    expect(b.some((x) => x.kind === "measured")).toBe(false);
  });

  it("says balanced when classes are close", () => {
    expect(kinds({ threads: 16, gpu: "NVIDIA GeForce RTX 4070" }).find((x) => x.kind === "pairing")!.title).toMatch(/reasonably matched/);
  });

  it("always notes that GPU load is unknown when no sensor data exists", () => {
    expect(kinds({}).some((b) => b.kind === "insufficient" && /GPU load unknown/.test(b.title))).toBe(true);
  });

  it("potential items are labelled as not observed and never claim benchmarks", () => {
    const b = kinds({ ramGb: 8, gpu: "NVIDIA GeForce RTX 4070", vramGb: 6 });
    const potential = b.filter((x) => x.kind === "potential");
    expect(potential.length).toBeGreaterThanOrEqual(2);
    const text = JSON.stringify(b).toLowerCase();
    expect(text).not.toMatch(/benchmarked|we measured fps|average fps/);
  });

  it("includes the no-benchmark notice", () => {
    expect(analyze(makeScan()).benchmarkNotice).toMatch(/did not run any benchmark/);
  });
});

describe("personality engine", () => {
  it("defines at least 12 unique personalities with title, icon, color, description and conditions", () => {
    expect(PERSONALITIES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(PERSONALITIES.map((p) => p.id)).size).toBe(PERSONALITIES.length);
    expect(new Set(PERSONALITIES.map((p) => p.title)).size).toBe(PERSONALITIES.length);
    for (const p of PERSONALITIES) {
      expect(p.title).toMatch(/^THE /);
      expect(p.icon).toBeTruthy();
      expect(p.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.description.length).toBeGreaterThan(20);
      expect(p.conditions.length).toBeGreaterThan(10);
    }
  });

  const cases: [string, Spec][] = [
    ["overkill-machine", { threads: 32, gpu: "NVIDIA GeForce RTX 5090", vramGb: 32, ramGb: 64, startupEnabled: 3, drives: GOOD_DRIVE }],
    ["gaming-monster", { threads: 16, gpu: "NVIDIA GeForce RTX 4080", vramGb: 16, ramGb: 32, startupEnabled: 20, drives: GOOD_DRIVE }],
    ["silent-killer", { threads: 16, gpu: "NVIDIA GeForce RTX 3070", vramGb: 8, ramGb: 32, startupEnabled: 4, ramUsedPct: 40, drives: GOOD_DRIVE }],
    ["rgb-addict", { threads: 8, gpu: "NVIDIA GeForce RTX 3060", ramGb: 16, rgb: ["Corsair iCUE", "Razer Synapse"], startupEnabled: 12, drives: GOOD_DRIVE }],
    ["budget-survivor", { threads: 4, gpu: "NVIDIA GeForce GTX 1050 Ti", vramGb: 4, ramGb: 8, startupEnabled: 12, drives: GOOD_DRIVE }],
    ["workhorse", { threads: 16, gpu: "NVIDIA GeForce GTX 1660 SUPER", vramGb: 6, ramGb: 32, startupEnabled: 12, drives: GOOD_DRIVE }],
    ["sleeping-giant", { threads: 16, gpu: "NVIDIA GeForce RTX 4080", vramGb: 16, ramGb: 32, startupEnabled: 27, drives: GOOD_DRIVE }],
    ["bottleneck-victim", { threads: 4, gpu: "NVIDIA GeForce RTX 4080", vramGb: 16, ramGb: 32, startupEnabled: 12, drives: GOOD_DRIVE }],
    ["storage-hoarder", { threads: 12, gpu: "NVIDIA GeForce RTX 3060", ramGb: 16, startupEnabled: 12, drives: [
      { mount: "C:\\", totalGb: 1000, freeGb: 400, kind: "ssd", system: true }, { mount: "D:\\", totalGb: 4000, freeGb: 200, kind: "hdd" }] }],
    ["clean-machine", { threads: 8, gpu: "NVIDIA GeForce RTX 3060", ramGb: 16, ramUsedPct: 40, startupEnabled: 3, drives: GOOD_DRIVE, apps: 80 }],
    ["chaos-engine", { threads: 12, gpu: "NVIDIA GeForce RTX 3060", ramGb: 16, startupEnabled: 35, drives: GOOD_DRIVE }],
    ["office-warrior", { threads: 12, gpu: "Intel(R) UHD Graphics 770", vramGb: 0.5, ramGb: 16, startupEnabled: 12, drives: GOOD_DRIVE }],
  ];

  it.each(cases)("scan evidence can reach %s", (id, spec) => {
    const a = analyze(makeScan(spec));
    expect(a.personality.primary.def.id).toBe(id);
    expect(a.personality.primary.reasons.length).toBeGreaterThan(0);
  });

  it("covers every defined personality", () => {
    expect(new Set(cases.map(([id]) => id))).toEqual(new Set(PERSONALITIES.map((p) => p.id)));
  });

  it("falls back to a clearly-labelled default when there is no signal", () => {
    const s = makeScan({ threads: null, ramGb: null, gpu: null, drives: null });
    s.startup = { status: "unavailable", reason: "x" };
    s.os = { status: "unavailable", reason: "x" };
    s.apps = { status: "unavailable", reason: "x" };
    const p = analyze(s).personality.primary;
    expect(p.strength).toBeLessThan(0.3);
    expect(p.reasons[0]).toMatch(/neutral default/);
  });

  it("does not assign RGB ADDICT without RGB software evidence", () => {
    for (const [, spec] of cases) {
      if (spec.rgb) continue;
      expect(analyze(makeScan(spec)).personality.primary.def.id).not.toBe("rgb-addict");
    }
  });
});

describe("roast engine", () => {
  const rich = makeScan({
    threads: 16, gpu: "NVIDIA GeForce RTX 4080", vramGb: 16, ramGb: 32, ramUsedPct: 85, startupEnabled: ["Discord", "Steam", "Spotify", ...Array(14).fill("X")],
    startupDisabled: 20, rgb: ["Corsair iCUE", "OpenRGB"], launchers: ["Steam", "Epic Games Launcher", "GOG Galaxy"], procs: ["chrome.exe"],
    uptimeDays: 20, apps: 200, build: "19045.1",
    drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 40, kind: "ssd", system: true }, { mount: "D:\\", totalGb: 4000, freeGb: 100, kind: "hdd" },
      { mount: "E:\\", totalGb: 1000, freeGb: 500, kind: "ssd" }, { mount: "F:\\", totalGb: 1000, freeGb: 500, kind: "ssd" }, { mount: "G:\\", totalGb: 1000, freeGb: 500, kind: "ssd" }],
  });

  it("has a large original library covering all five categories", () => {
    expect(ROAST_LIBRARY.length).toBeGreaterThanOrEqual(100);
    for (const cat of ROAST_CATEGORIES) expect(ROAST_LIBRARY.filter((r) => r.category === cat).length).toBeGreaterThanOrEqual(10);
    expect(new Set(ROAST_LIBRARY.map((r) => r.id)).size).toBe(ROAST_LIBRARY.length);
  });

  it("every category always has at least one eligible roast, even for a sparse scan", () => {
    const a = analyze(makeScan({ threads: null, ramGb: null, gpu: null, drives: null }));
    for (const cat of ROAST_CATEGORIES) expect(a.roasts.byCategory[cat]).toBeDefined();
  });

  it("is deterministic per seed and varies across seeds", () => {
    const set = (seed: number) => JSON.stringify(analyze(rich, { seed }).roasts);
    expect(set(1)).toBe(set(1));
    const variants = new Set(Array.from({ length: 30 }, (_, i) => set(i)));
    expect(variants.size).toBeGreaterThan(10);
  });

  it("avoids recently shown roasts when alternatives exist", () => {
    const first = analyze(rich, { seed: 3 }).roasts;
    const recent = Object.values(first.byCategory).map((r) => r!.id);
    for (let seed = 0; seed < 25; seed++) {
      const next = analyze(rich, { seed, recentRoastIds: recent }).roasts;
      for (const r of Object.values(next.byCategory)) expect(recent).not.toContain(r!.id);
    }
  });

  it("falls back to repeating only when every option was recently shown", () => {
    const ctx = { f: analyze(rich).facts, s: {}, overall: 80, personalityId: "workhorse" };
    const all = eligibleRoasts(ctx).map((r) => r.id);
    const set = generateRoasts(ctx, { seed: 1, recentIds: all });
    expect(Object.keys(set.byCategory).length).toBe(5);
  });

  it("every rendered line is short, complete and contains no template leftovers", () => {
    const scans = [rich, makeScan(), makeScan({ threads: 4, ramGb: 8, gpu: "Intel(R) UHD Graphics 770", battery: true })];
    for (const s of scans) {
      const a = analyze(s);
      const ctx = { f: a.facts, s: Object.fromEntries(a.categories.filter((c) => c.score !== null).map((c) => [c.id, c.score!])), overall: a.overall.score, personalityId: a.personality.primary.def.id };
      for (const r of eligibleRoasts(ctx)) {
        expect(r.text.length, r.id).toBeLessThanOrEqual(130);
        expect(r.text, r.id).not.toMatch(/undefined|NaN|\{|\}|null|Infinity/);
      }
    }
  });

  it("only makes data-specific claims the scan supports", () => {
    const quiet = analyze(makeScan({ startupEnabled: ["OneApp"], procs: ["Code.exe"], rgb: [], launchers: [], battery: false, build: "26100.1", uptimeDays: 1 }));
    const texts = eligibleRoasts({ f: quiet.facts, s: {}, overall: 70, personalityId: "workhorse" }).map((r) => r.text).join(" | ");
    expect(texts).not.toMatch(/Discord|Steam|Spotify|Teams|OneDrive|Adobe/);
    expect(texts).not.toMatch(/lighting|battery|Windows 10|launchers? installed/i);
    expect(texts).not.toMatch(/browser tabs?\./); // browser lines need a browser in the top processes
  });

  it("vendor-specific lines fire for the right GPUs only (word-boundary regression)", () => {
    const ids = (gpu: string) => {
      const a = analyze(makeScan({ gpu, vramGb: 16 }));
      const s = Object.fromEntries(a.categories.filter((c) => c.score !== null).map((c) => [c.id, c.score!]));
      return eligibleRoasts({ f: a.facts, s, overall: a.overall.score, personalityId: a.personality.primary.def.id }).map((r) => r.id);
    };
    expect(ids("Intel(R) Arc(TM) B580 Graphics")).toContain("hw-gpu-intel-arc");
    expect(ids("AMD Radeon RX 7900 XTX")).toContain("hw-gpu-amd");
    expect(ids("AMD Radeon RX 7800 XT")).toContain("hw-gpu-amd");
    expect(ids("AMD Radeon RX 6600")).not.toContain("hw-gpu-amd"); // mainstream class: the line is gated to upper-mid and above
    expect(ids("NVIDIA GeForce RTX 4080")).not.toContain("hw-gpu-amd");
    expect(ids("NVIDIA GeForce RTX 4080")).not.toContain("hw-gpu-intel-arc");
    expect(ids("Intel(R) UHD Graphics 770")).not.toContain("hw-gpu-intel-arc");
  });

  it("engine source files contain no stray control characters (e.g. a backspace where \\b was meant)", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { resolve, join } = await import("node:path");
    const dir = resolve(__dirname);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
      expect(/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(readFileSync(join(dir, f), "utf8")), f).toBe(false);
    }
  });

  it("uses real values from the scan in specific lines", () => {
    const a = analyze(rich, { seed: 5 });
    const texts = eligibleRoasts({ f: a.facts, s: {}, overall: 80, personalityId: "gaming-monster" }).map((r) => r.text).join(" | ");
    expect(texts).toContain("RTX 4080");
    expect(texts).toContain("17 things launch at login");
  });

  it("best roast is the most data-specific selected line", () => {
    const set = analyze(rich, { seed: 9 }).roasts;
    const max = Math.max(...Object.values(set.byCategory).map((r) => r!.specificity));
    expect(set.best.specificity).toBe(max);
  });

  it("PRNG is stable", () => {
    const r = makeRng(42);
    expect([r(), r(), r()].every((v) => v >= 0 && v < 1)).toBe(true);
    expect(makeRng(42)()).toBe(makeRng(42)());
  });
});
