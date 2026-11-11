import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { nav, seedHistory } from "./helpers";

/**
 * Regenerates the README screenshots, sample cards and the per-release update gallery in docs/screenshots.
 * Opt-in (it writes files):  $env:SCREENSHOTS=1; npm run screenshots
 *
 * Everything uses the dev-only, clearly labelled DEMO data: never a real machine, so the public
 * repository does not publish anyone's actual hardware or startup apps. Cards carry the
 * "DEMO DATA (synthetic)" footer.
 */
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to regenerate docs/screenshots");

const OUT = resolve(import.meta.dirname, "../../docs/screenshots");
const VERSION = "v0.2.0-beta.1";
const UPDATES = `${OUT}/updates/${VERSION}`;

async function shot(page: Page, name: string, screen: string | null, dir = OUT) {
  if (screen) await nav(page, screen);
  await page.waitForTimeout(700);
  await page.mouse.move(0, 799); // no hover states in the picture
  await page.screenshot({ path: `${dir}/${name}.png` });
}

test("regenerate README screenshots and sample cards", async ({ page, context }) => {
  test.setTimeout(180_000);
  mkdirSync(UPDATES, { recursive: true });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?demo=1");
  await page.waitForSelector("text=Your last scan");

  await shot(page, "01-dashboard", null);
  await shot(page, "02-results", "PC Exposure");
  await page.getByRole("button", { name: /Startup Efficiency/ }).click();
  await shot(page, "02-results-explained", null);
  await shot(page, "03-personality", "Personality");
  await shot(page, "04-analysis", "System Analysis");
  await shot(page, "05-roast", "PC Roast");
  await shot(page, "06-share-studio", "Share Studio");
  await nav(page, "Compare PCs");
  await page.getByRole("button", { name: /Save current scan/ }).click();
  await page.getByRole("button", { name: /as PC A/ }).first().click();
  await page.getByRole("button", { name: /as PC B/ }).nth(1).click();
  await shot(page, "07-compare", null);
  await shot(page, "08-settings", "Settings");

  // ── new in v0.2 (gaming-rig demo) ──
  await nav(page, "History");
  await seedHistory(page);
  await page.getByLabel("Record new scans").check();
  await page.waitForSelector("[data-testid=history-list]");
  await shot(page, "11-history", null);
  await page.setViewportSize({ width: 1280, height: 1100 });
  await shot(page, "history-timeline", null, UPDATES);
  await page.setViewportSize({ width: 1280, height: 800 });
  await shot(page, "dashboard", "Dashboard", UPDATES);
  await nav(page, "Hardware");
  await page.getByRole("button", { name: "Copy specs" }).click();
  await shot(page, "hardware-copy-specs", null, UPDATES);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("GPU: NVIDIA GeForce RTX 4080");
  writeFileSync(`${UPDATES}/spec-sheet-example.txt`, copied.replace(/\r?\n/g, "\n"));

  await nav(page, "PC Exposure");
  await page.getByRole("button", { name: /Open PC Wrapped/ }).click();
  await page.waitForTimeout(500);
  for (let i = 0; i < 2; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(300); }
  await page.screenshot({ path: `${OUT}/09-wrapped.png` });
  await page.keyboard.press("Escape");

  // ── Glow-Up Plan (budget-laptop demo, so the plan has something to say) ──
  await page.goto("/?demo=budget");
  await page.waitForSelector("text=Your last scan");
  await shot(page, "10-glow-up-plan", "Glow-Up Plan");
  await page.setViewportSize({ width: 1280, height: 2100 });
  await shot(page, "glow-up-plan", "Glow-Up Plan", UPDATES);
  await page.setViewportSize({ width: 1280, height: 800 });
  await nav(page, "PC Exposure");
  await page.waitForTimeout(600);
  await page.getByTestId("plan-teaser").screenshot({ path: `${UPDATES}/results-plan-teaser.png` });
  await page.setViewportSize({ width: 1000, height: 680 });
  await shot(page, "minimum-window-1000x680", "Glow-Up Plan", UPDATES);
  await page.setViewportSize({ width: 1280, height: 800 });

  // Sample cards, rendered at full export resolution from the same demo scan.
  const cards = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const load = (path: string): Promise<any> => import(/* @vite-ignore */ path);
    const [{ renderCard }, { buildCardData }, { analyze }, { makeScan }] = await Promise.all([
      load("/src/share/render.ts"), load("/src/share/cardData.ts"), load("/src/engine/analyze.ts"), load("/src/engine/testFixtures.ts"),
    ]);
    const { drawCompareCard } = await load("/src/share/compareCard.ts");
    const { buildReport } = await load("/src/reports/format.ts");
    const spec = {
      threads: 16, gpu: "NVIDIA GeForce RTX 4080", vramGb: 16, ramGb: 32, ramUsedPct: 52,
      startupEnabled: ["Discord", "Steam", "Spotify", "OneDrive", "Overwolf", "Updater", "Sync", "Helper", "Agent", "Tray", "Launcher", "Cloud", "Notifier", "Widget"],
      startupDisabled: 9, rgb: ["Corsair iCUE"], launchers: ["Steam", "Epic Games Launcher"], procs: ["chrome.exe", "Code.exe"], apps: 120,
      drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 420, kind: "ssd", system: true }, { mount: "D:\\", totalGb: 2000, freeGb: 900, kind: "ssd" }],
    };
    const a = analyze(makeScan(spec), { seed: 7 });
    const data = buildCardData(a, { username: "@demo", privacy: false, watermark: true }, true); // demo = true labels the card
    const canvas = document.createElement("canvas");
    const out: Record<string, string> = {};
    for (const [name, tpl, fmt] of [
      ["card-identity-portrait", "identity", "portrait"], ["card-roast-landscape", "roast", "landscape"],
      ["card-hardware-portrait", "hardware", "portrait"], ["card-score-portrait", "score", "portrait"], ["card-wrapped-landscape", "wrapped", "landscape"],
    ] as const) {
      await renderCard(canvas, tpl, fmt, data);
      out[name] = canvas.toDataURL("image/png");
    }
    const mk = (s: object, label: string) => buildReport(analyze(makeScan(s), { seed: 1 }), { label });
    drawCompareCard(canvas, "landscape", mk(spec, "Gaming rig"), mk({ threads: 8, gpu: "NVIDIA GeForce GTX 1660 SUPER", vramGb: 6, ramGb: 16, startupEnabled: 30 }, "Old faithful"), { privacy: false, watermark: true, demo: true });
    out["card-compare-landscape"] = canvas.toDataURL("image/png");
    return out;
  });
  expect(Object.keys(cards)).toHaveLength(6);
  for (const [name, url] of Object.entries(cards)) writeFileSync(`${OUT}/${name}.png`, Buffer.from(url.split(",")[1], "base64"));
});
