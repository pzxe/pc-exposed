import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { nav, seedHistory } from "./helpers";

/**
 * Quality gates run against every screen, using the labelled dev-only demo data:
 *  - axe-core WCAG 2.0/2.1 A + AA audit (no violations allowed)
 *  - no horizontal overflow at the minimum (1000x680), default and large window sizes
 */
const SCREENS = [
  "Dashboard", "Investigation", "PC Exposure", "Personality", "Hardware", "System Analysis",
  "Glow-Up Plan", "PC Roast", "Share Studio", "Compare PCs", "History", "Settings",
];
const SIZES = [{ width: 1000, height: 680 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }];

async function open(page: Page, name: string) {
  await nav(page, name);
  await page.waitForTimeout(450); // entrance animation
}

async function loaded(page: Page) {
  await page.goto("/?demo=1");
  await page.waitForSelector("text=Expose your PC");
  await page.waitForTimeout(300);
}

test.describe("accessibility (axe-core, WCAG 2.1 AA)", () => {
  for (const name of SCREENS) {
    test(`${name} has no violations`, async ({ page }) => {
      await loaded(page);
      await open(page, name);
      if (name === "Compare PCs") {
        await page.getByRole("button", { name: /Save current scan/ }).click();
        await page.getByRole("button", { name: /as PC A/ }).first().click();
        await page.getByRole("button", { name: /as PC B/ }).nth(1).click();
        await page.waitForTimeout(400);
      }
      if (name === "PC Exposure") await page.getByRole("button", { name: /Startup Efficiency/ }).click();
      if (name === "History") {
        // Audit the populated screen (chart + list), not just the opt-in empty state.
        await seedHistory(page);
        await page.waitForSelector("[data-testid=history-list]");
        await page.waitForTimeout(400);
      }
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const summary = results.violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`);
      expect(summary, summary.join("\n")).toEqual([]);
    });
  }

  test("PC Wrapped dialog has no violations", async ({ page }) => {
    await loaded(page);
    await open(page, "PC Exposure");
    await page.getByRole("button", { name: /Open PC Wrapped/ }).click();
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const summary = results.violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
});

test.describe("layout at supported window sizes", () => {
  for (const size of SIZES) {
    test(`no horizontal overflow at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await loaded(page);
      const problems: string[] = [];
      for (const name of SCREENS) {
        await open(page, name);
        const o = await page.evaluate(() => {
          const main = document.querySelector("main")!;
          return { mainOverflow: main.scrollWidth - main.clientWidth, bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        if (o.mainOverflow > 1 || o.bodyOverflow > 1) problems.push(`${name}: main +${o.mainOverflow}px, page +${o.bodyOverflow}px`);
      }
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
});

test.describe("performance budgets", () => {
  test("every share-card template renders within budget (warm)", async ({ page }) => {
    await loaded(page);
    const timings = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const load = (path: string): Promise<any> => import(/* @vite-ignore */ path);
      const [{ renderCard }, { buildCardData }, { analyze }, { makeScan }, { TEMPLATES }] = await Promise.all([
        load("/src/share/render.ts"), load("/src/share/cardData.ts"), load("/src/engine/analyze.ts"), load("/src/engine/testFixtures.ts"), load("/src/share/templates.ts"),
      ]);
      const data = buildCardData(analyze(makeScan({ rgb: ["Corsair iCUE"], launchers: ["Steam"] }), { seed: 1 }), { username: "@me", privacy: false, watermark: true }, false);
      const canvas = document.createElement("canvas");
      const out: Record<string, number> = {};
      for (const t of TEMPLATES) for (const f of ["portrait", "landscape"]) {
        await renderCard(canvas, t.id, f, data); // warm-up (fonts, icon decode)
        const t0 = performance.now();
        for (let i = 0; i < 3; i++) await renderCard(canvas, t.id, f, data);
        out[`${t.id}-${f}`] = Math.round((performance.now() - t0) / 3);
      }
      return out;
    });
    const slow = Object.entries(timings).filter(([, ms]) => ms > 250);
    expect(slow, JSON.stringify(timings)).toEqual([]);
  });

  test("the analysis engine analyzes a scan in a few milliseconds", async ({ page }) => {
    await loaded(page);
    const ms = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const load = (path: string): Promise<any> => import(/* @vite-ignore */ path);
      const [{ analyze }, { makeScan }] = await Promise.all([load("/src/engine/analyze.ts"), load("/src/engine/testFixtures.ts")]);
      const scan = makeScan({ startupEnabled: 40, apps: 300 });
      const t0 = performance.now();
      for (let i = 0; i < 200; i++) analyze(scan, { seed: i });
      return (performance.now() - t0) / 200;
    });
    expect(ms).toBeLessThan(15);
  });
});
