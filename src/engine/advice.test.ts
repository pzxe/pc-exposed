import { describe, it, expect } from "vitest";
import { buildPlan, candidates } from "./advice";
import { scoreFacts } from "./analyze";
import { extractFacts, type Facts } from "./facts";
import { classifyGpu } from "./hardwareClass";
import { makeScan, type Spec } from "./testFixtures";

const factsOf = (spec: Spec) => extractFacts(makeScan(spec));

describe("Glow-Up Plan", () => {
  it("proposes trimming startup apps and projects with the real scoring rules", () => {
    const f = factsOf({ startupEnabled: 14 });
    const plan = buildPlan(f);
    const trim = plan.actions.find((a) => a.id === "startup-trim")!;
    expect(trim).toBeDefined();
    expect(trim.effort).toBe("free");
    expect(trim.before).toBe(scoreFacts(f).overall.score);
    expect(trim.gain).toBe(trim.after - trim.before);
    expect(trim.gain).toBeGreaterThan(0);
    expect(trim.changes).toContainEqual({ id: "startup", label: "Startup Efficiency", before: 70, after: 100 });
    expect(trim.details.join(" ")).toContain("App0"); // the real names found, not made up
  });

  it("every projection equals rescoring the changed facts (no separate, drifting rules)", () => {
    const f = factsOf({ startupEnabled: 30, ramGb: 8, ramUsedPct: 91, drives: [{ mount: "C:\\", totalGb: 500, freeGb: 20, kind: "hdd", system: true }], build: "19045.1", uptimeDays: 40, apps: 320, gpu: "NVIDIA GeForce GTX 1650" });
    for (const c of candidates(f)) {
      const plan = buildPlan(f).actions.find((a) => a.id === c.id);
      if (plan) expect(plan.after).toBe(scoreFacts(c.apply(f)).overall.score);
    }
  });

  it("covers free fixes and upgrades for a struggling PC, best first", () => {
    const f = factsOf({ startupEnabled: 30, ramGb: 8, ramUsedPct: 91, drives: [{ mount: "C:\\", totalGb: 500, freeGb: 25, kind: "hdd", system: true }], build: "19045.1", uptimeDays: 40, apps: 320, gpu: "NVIDIA GeForce GTX 1650" });
    const plan = buildPlan(f);
    const ids = plan.actions.map((a) => a.id);
    for (const id of ["startup-trim", "disk-space", "restart", "close-apps", "uninstall", "ram-upgrade", "ssd", "windows11", "gpu-upgrade"]) expect(ids, id).toContain(id);
    expect(plan.actions.find((a) => a.id === "disk-space")!.title).toBe("Free 125 GB on the system drive");
    expect(plan.actions.find((a) => a.id === "ram-upgrade")!.title).toBe("Upgrade to 16 GB of RAM");
    expect(plan.actions.find((a) => a.id === "windows11")!.caveat).toMatch(/does not check Windows 11 eligibility/);
    const gains = plan.actions.map((a) => a.gain);
    expect(gains).toEqual([...gains].sort((a, b) => b - a));
    // Combined projections: at least the best single free fix, never more than everything.
    const bestFree = Math.max(...plan.actions.filter((a) => a.effort === "free").map((a) => a.gain));
    expect(plan.allFree!.gain).toBeGreaterThanOrEqual(bestFree);
    expect(plan.everything!.gain).toBeGreaterThanOrEqual(plan.allFree!.gain);
    expect(plan.everything!.after).toBeLessThanOrEqual(100);
  });

  it("shows nothing for a PC with nothing to fix (no filler advice)", () => {
    const plan = buildPlan(factsOf({ gpu: "NVIDIA GeForce RTX 4090", vramGb: 24, threads: 32, ramGb: 64, startupEnabled: 3, uptimeDays: 1 }));
    expect(plan.current).not.toBeNull();
    expect(plan.actions).toEqual([]);
    expect(plan.allFree).toBeUndefined();
  });

  it("returns no plan when the PC could not be scored", () => {
    const empty: Facts = { gpuUtilKnown: false, startupNames: [], ssdCount: 0, hddCount: 0, rgbApps: [], launchers: [], topProcesses: [], browserRunning: false };
    expect(buildPlan(empty)).toEqual({ current: null, actions: [] });
  });

  it("never suggests an upgrade beyond the top GPU class", () => {
    expect(candidates(factsOf({ gpu: "NVIDIA GeForce RTX 5090" })).some((c) => c.id === "gpu-upgrade")).toBe(false);
  });
});

describe("GPU recognition for common laptop names", () => {
  it.each([
    ["AMD Radeon(TM) 890M Graphics", 0],
    ["AMD Radeon(TM) 780M", 0],
    ["AMD Radeon 760M", 0],
    ["Intel(R) Arc(TM) 140V GPU (16GB)", 0],
    ["Intel(R) Arc(TM) 130T GPU", 0],
    ["Intel(R) Arc(TM) Graphics", 0],
    ["Intel(R) Arc(TM) A770 Graphics", 3],
    ["Intel(R) Arc(TM) B580 Graphics", 3],
  ])("%s → tier %i", (name, tier) => {
    expect(classifyGpu(name)?.tier).toBe(tier);
  });
});
