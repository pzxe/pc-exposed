import { describe, it, expect, beforeEach } from "vitest";
import { HISTORY_KEY, MAX_HISTORY, entryBefore, historyStore } from "./history";
import { buildReport } from "./format";
import { clearAllLocalData } from "./store";
import { analyze } from "@/engine/analyze";
import { makeScan } from "@/engine/testFixtures";
import type { FullAnalysis } from "@/app/state";
import { deltasBetween } from "@/screens/History";

const report = (at: number, spec = {}) => buildReport(analyze(makeScan(spec), { seed: 1 }) as FullAnalysis, { now: at });

beforeEach(() => { localStorage.clear(); historyStore.invalidate(); });

describe("scan history store", () => {
  it("keeps one entry per scan time, oldest first", () => {
    historyStore.add(report(3_000_000_000_000));
    historyStore.add(report(2_000_000_000_000));
    historyStore.add(report(3_000_000_000_000, { startupEnabled: 2 })); // same scan recorded again: replaces
    const list = historyStore.list();
    expect(list.map((r) => r.createdAt)).toEqual([2_000_000_000_000, 3_000_000_000_000]);
    expect(list[1].system.startupEnabled).toBe(2);
    expect(historyStore.has(2_000_000_000_000)).toBe(true);
  });

  it("caps the number of entries, dropping the oldest", () => {
    for (let i = 0; i < MAX_HISTORY + 5; i++) historyStore.add(report(1_700_000_000_000 + i * 86_400_000));
    const list = historyStore.list();
    expect(list).toHaveLength(MAX_HISTORY);
    expect(list[0].createdAt).toBe(1_700_000_000_000 + 5 * 86_400_000);
  });

  it("re-validates on read: tampered or corrupt entries are dropped", () => {
    const good = report(1_800_000_000_000);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([good, { format: "evil" }, { ...good, createdAt: "soon" }, 42]));
    historyStore.invalidate();
    expect(historyStore.list()).toHaveLength(1);
    localStorage.setItem(HISTORY_KEY, "{not json");
    historyStore.invalidate();
    expect(historyStore.list()).toEqual([]);
  });

  it("stores summaries only: no startup-app, process or app names", () => {
    historyStore.add(report(1_800_000_000_000, { startupEnabled: ["SecretTool"], procs: ["private.exe"] }));
    const raw = localStorage.getItem(HISTORY_KEY)!;
    expect(raw).not.toContain("SecretTool");
    expect(raw).not.toContain("private.exe");
  });

  it("delete one, clear all, and 'Reset all local data' all remove it", () => {
    historyStore.add(report(1_800_000_000_000));
    historyStore.add(report(1_900_000_000_000));
    historyStore.remove(historyStore.list()[0].id);
    expect(historyStore.list()).toHaveLength(1);
    historyStore.clear();
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
    historyStore.add(report(1_800_000_000_000));
    clearAllLocalData();
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(historyStore.list()).toEqual([]);
  });

  it("finds the previous entry and describes what changed in the right direction", () => {
    const a = report(1_800_000_000_000, { startupEnabled: 20 });
    const b = report(1_900_000_000_000, { startupEnabled: 4 });
    expect(entryBefore([a, b], b.createdAt)).toBe(a);
    expect(entryBefore([a, b], a.createdAt)).toBeUndefined();
    const d = deltasBetween(a, b);
    expect(d.find((x) => x.label === "Startup apps")).toEqual({ label: "Startup apps", text: "-16", tone: "good" });
    expect(d.find((x) => x.label === "Score")!.tone).toBe("good");
    expect(deltasBetween(a, a)).toEqual([]);
  });
});
