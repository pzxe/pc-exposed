import type { Page } from "@playwright/test";

/** Clicks a sidebar entry (scoped to the nav, since screens can have buttons with the same label). */
export async function nav(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name, exact: true }).click();
}

/**
 * Records a few synthetic (demo) scans through the real history store, showing a PC being
 * cleaned up over ~5 weeks. Synthetic data only: never a real machine.
 */
export async function seedHistory(page: Page) {
  await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const load = (path: string): Promise<any> => import(/* @vite-ignore */ path);
    const [{ analyze }, { makeScan }, { buildReport }, { historyStore }] = await Promise.all([
      load("/src/engine/analyze.ts"), load("/src/engine/testFixtures.ts"), load("/src/reports/format.ts"), load("/src/reports/history.ts"),
    ]);
    const day = 86_400_000, t0 = Date.now() - 40 * day;
    const steps = [
      { startupEnabled: 31, uptimeDays: 33, drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 60, kind: "ssd", system: true }], ramUsedPct: 88 },
      { startupEnabled: 24, uptimeDays: 12, drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 140, kind: "ssd", system: true }], ramUsedPct: 80 },
      { startupEnabled: 14, uptimeDays: 3, drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 300, kind: "ssd", system: true }], ramUsedPct: 62 },
      { startupEnabled: 6, uptimeDays: 1, drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 420, kind: "ssd", system: true }], ramUsedPct: 52 },
    ];
    steps.forEach((s, i) => historyStore.add(buildReport(analyze(makeScan({ threads: 16, gpu: "NVIDIA GeForce RTX 4080", vramGb: 16, ...s }), { seed: i }), { now: t0 + i * 12 * day })));
  });
}
