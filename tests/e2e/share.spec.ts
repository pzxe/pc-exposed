import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Renders every template at both export sizes in a real Chromium canvas and
 * checks: exact pixel size, a valid PNG, non-blank output, and that no text
 * overflows its container (the renderer reports this itself). Runs against all
 * 12 personalities and a stress scenario with very long names.
 * Set CARD_OUT=<dir> to also write the PNGs for visual inspection.
 */
test("all templates render correctly at target resolutions", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/?demo=1");
  await page.waitForSelector("text=Expose your PC");

  const out = process.env.CARD_OUT;
  if (out) mkdirSync(out, { recursive: true });

  const result = await page.evaluate(async () => {
    // Runs in the browser; the dev server serves these modules. Untyped on purpose.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const load = (path: string): Promise<any> => import(/* @vite-ignore */ path);
    const [{ renderCard, canvasToPng }, { buildCardData }, { analyze }, { makeScan }, { SIZES, TEMPLATES }, { PERSONALITIES }] = await Promise.all([
      load("/src/share/render.ts"), load("/src/share/cardData.ts"), load("/src/engine/analyze.ts"),
      load("/src/engine/testFixtures.ts"), load("/src/share/templates.ts"), load("/src/engine/personality.ts"),
    ]);
    const base = analyze(makeScan({
      threads: 16, gpu: "NVIDIA GeForce RTX 4080", vramGb: 16, ramGb: 32, startupEnabled: ["Discord", "Steam", "Spotify"],
      rgb: ["Corsair iCUE"], launchers: ["Steam", "Epic Games Launcher"], procs: ["chrome.exe"], startupDisabled: 6,
      drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 400, kind: "ssd", system: true }, { mount: "D:\\", totalGb: 2000, freeGb: 900, kind: "ssd" }],
    }), { seed: 3 });
    const stressScan = makeScan({
      threads: 16, gpu: "NVIDIA GeForce RTX 5090 Founders Edition Super Extreme Overclocked Water-Cooled Collectors Edition 32GB", vramGb: 32,
      ramGb: 192, startupEnabled: 45, apps: 400, drives: [{ mount: "C:\\", totalGb: 8000, freeGb: 100, kind: "ssd", system: true }],
    });
    const stress = analyze(stressScan, { seed: 9 });

    const rows: { name: string; w: number; h: number; overflows: string[]; truncated: string[]; overlaps: string[]; png: boolean; painted: number }[] = [];
    const images: Record<string, string> = {};
    const canvas = document.createElement("canvas");

    const run = async (name: string, a: typeof base, opts: { username: string; privacy: boolean; watermark: boolean }, personalityIdx: number | null, tpl: string, fmt: "portrait" | "landscape", keep: boolean) => {
      const data = buildCardData(a as never, opts, false);
      if (personalityIdx !== null) {
        const p = PERSONALITIES[personalityIdx];
        data.personality = { title: p.title, icon: p.icon, color: p.color, description: p.description };
      }
      const rep = await renderCard(canvas, tpl as never, fmt, data);
      const blob = await canvasToPng(canvas);
      const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
      const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => head[i] === b);
      const px = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let painted = 0;
      for (let i = 0; i < px.length; i += 4 * 97) if (Math.abs(px[i] - 0x11) + Math.abs(px[i + 1] - 0x10) + Math.abs(px[i + 2] - 0x14) > 30) painted++;
      rows.push({ name, w: canvas.width, h: canvas.height, overflows: rep.overflows, truncated: rep.truncated, overlaps: rep.overlaps, png, painted });
      if (keep) images[name] = canvas.toDataURL("image/png");
    };

    for (const t of TEMPLATES) for (const fmt of ["portrait", "landscape"] as const) {
      await run(`${t.id}-${fmt}`, base, { username: "@PCFlexer", privacy: false, watermark: true }, null, t.id, fmt, true);
      await run(`${t.id}-${fmt}-privacy`, base, { username: "@PCFlexer", privacy: true, watermark: true }, null, t.id, fmt, true);
      await run(`${t.id}-${fmt}-stress`, stress, { username: "WWWWWWWWWWWWWWWWWWWWWWWW", privacy: false, watermark: true }, null, t.id, fmt, true);
      for (let i = 0; i < PERSONALITIES.length; i++) await run(`${t.id}-${fmt}-p${i}`, base, { username: "@PCFlexer", privacy: false, watermark: true }, i, t.id, fmt, false);
    }
    return { rows, images, sizes: SIZES };
  });

  expect(result.rows.length).toBe(5 * 2 * (3 + 12));
  for (const r of result.rows) {
    const fmt = r.name.includes("landscape") ? result.sizes.landscape : result.sizes.portrait;
    expect.soft(r.w, r.name).toBe(fmt.w);
    expect.soft(r.h, r.name).toBe(fmt.h);
    expect.soft(r.png, `${r.name} PNG signature`).toBe(true);
    expect.soft(r.painted, `${r.name} is blank`).toBeGreaterThan(40);
    expect.soft(r.overflows, `${r.name} overflow`).toEqual([]);
    expect.soft(r.overlaps, `${r.name} overlap`).toEqual([]);
    // Normal data must never need ellipsis; stress data may fall back to it but never overflow.
    if (!r.name.endsWith("-stress")) expect.soft(r.truncated, `${r.name} truncated`).toEqual([]);
  }
  if (out) for (const [name, url] of Object.entries(result.images)) writeFileSync(`${out}/${name}.png`, Buffer.from(url.split(",")[1], "base64"));
});

test("Studio UI: preview, options and privacy mode work end to end", async ({ page }) => {
  await page.goto("/?demo=1");
  await page.getByRole("button", { name: "Share Studio" }).click();
  const canvas = page.getByTestId("card-canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("render-info")).toContainText("1080×1350 PNG · all text fits");
  await page.getByRole("radio", { name: /landscape/i }).click();
  await expect(page.getByTestId("render-info")).toContainText("1920×1080 PNG");
  expect(await canvas.evaluate((c: HTMLCanvasElement) => [c.width, c.height])).toEqual([1920, 1080]);
  await page.getByLabel("Username (optional)").fill("<b>Neo</b>\u202E");
  await expect(page.getByLabel("Username (optional)")).toHaveValue("bNeo/b");
  await page.getByLabel(/Privacy mode/).check();
  await expect(page.getByLabel("Username (optional)")).toBeDisabled();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PNG" }).click();
  expect((await dl).suggestedFilename()).toBe("pc-exposed-identity-landscape.png");
});

test("comparison card renders correctly at both sizes, including hostile and sparse reports", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?demo=1");
  await page.waitForSelector("text=Expose your PC");
  const out = process.env.CARD_OUT;
  if (out) mkdirSync(out, { recursive: true });

  const result = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const load = (path: string): Promise<any> => import(/* @vite-ignore */ path);
    const [{ drawCompareCard }, { buildReport }, { analyze }, { makeScan }, { canvasToPng }] = await Promise.all([
      load("/src/share/compareCard.ts"), load("/src/reports/format.ts"), load("/src/engine/analyze.ts"),
      load("/src/engine/testFixtures.ts"), load("/src/share/render.ts"),
    ]);
    const mk = (spec: object, label: string) => buildReport(analyze(makeScan(spec), { seed: 1 }), { label });
    const big = mk({ threads: 32, gpu: "NVIDIA GeForce RTX 4090", vramGb: 24, ramGb: 64, startupEnabled: 3 }, "Gaming rig");
    const small = mk({ threads: 8, gpu: "NVIDIA GeForce GTX 1660 SUPER", vramGb: 6, ramGb: 16, startupEnabled: 30 }, "Old faithful");
    const sparse = mk({ threads: null, gpu: null, ramGb: null, drives: null }, "Sparse");
    const hostile = { ...big, label: "W".repeat(40), system: { ...big.system, gpu: { ...big.system.gpu, name: "NVIDIA GeForce RTX 5090 Founders Edition Super Extreme Overclocked Water-Cooled Collectors Edition 32GB" } } };
    const longLabelB = { ...small, label: "<img src=x onerror=alert(1)>An Extremely Long Label For A Perfectly Normal PC" };

    const cases: [string, unknown, unknown, boolean][] = [
      ["normal", big, small, false], ["privacy", big, small, true], ["sparse", big, sparse, false],
      ["hostile", hostile, longLabelB, false], ["hostile-privacy", hostile, longLabelB, true], ["sparse-both", sparse, sparse, false],
    ];
    const rows: { name: string; w: number; h: number; overflows: string[]; truncated: string[]; overlaps: string[]; png: boolean; painted: number; summary: string }[] = [];
    const images: Record<string, string> = {};
    const canvas = document.createElement("canvas");
    await document.fonts.ready;
    for (const fmt of ["portrait", "landscape"] as const) {
      for (const [n, a, b, privacy] of cases) {
        const r = drawCompareCard(canvas, fmt, a, b, { privacy, watermark: true });
        const blob = await canvasToPng(canvas);
        const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
        const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => head[i] === x);
        const px = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0;
        for (let i = 0; i < px.length; i += 4 * 97) if (Math.abs(px[i] - 0x11) + Math.abs(px[i + 1] - 0x10) + Math.abs(px[i + 2] - 0x14) > 30) painted++;
        rows.push({ name: `compare-${fmt}-${n}`, w: canvas.width, h: canvas.height, overflows: r.report.overflows, truncated: r.report.truncated, overlaps: r.report.overlaps, png, painted, summary: r.summary });
        images[`compare-${fmt}-${n}`] = canvas.toDataURL("image/png");
      }
    }
    return { rows, images };
  });

  expect(result.rows).toHaveLength(12);
  for (const r of result.rows) {
    const landscape = r.name.includes("landscape");
    expect.soft(r.w, r.name).toBe(landscape ? 1920 : 1080);
    expect.soft(r.h, r.name).toBe(landscape ? 1080 : 1350);
    expect.soft(r.png, `${r.name} PNG`).toBe(true);
    expect.soft(r.painted, `${r.name} blank`).toBeGreaterThan(40);
    expect.soft(r.overflows, `${r.name} overflow`).toEqual([]);
    expect.soft(r.overlaps, `${r.name} overlap`).toEqual([]);
    if (!r.name.includes("hostile")) expect.soft(r.truncated, `${r.name} truncated`).toEqual([]);
  }
  if (out) for (const [name, url] of Object.entries(result.images)) writeFileSync(`${out}/${name}.png`, Buffer.from(url.split(",")[1], "base64"));
});

test("the render audit itself works: it reports overlap, overflow and truncation, and stays quiet otherwise", async ({ page }) => {
  await page.goto("/?demo=1");
  await page.waitForSelector("text=Expose your PC");
  const r = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const load = (path: string): Promise<any> => import(/* @vite-ignore */ path);
    const { Painter } = await load("/src/share/painter.ts");
    const mk = () => { const c = document.createElement("canvas"); c.width = 600; c.height = 400; return new Painter(c.getContext("2d")!, 600, 400); };
    const st = { size: 40, color: "#fff", weight: 700 };

    const clean = mk();
    clean.text("First line", { x: 20, y: 20, w: 500, h: 60 }, st);
    clean.text("Second line", { x: 20, y: 120, w: 500, h: 60 }, st);

    const overlap = mk();
    overlap.text("Hello overlapping", { x: 20, y: 20, w: 500, h: 60 }, st);
    overlap.text("World colliding", { x: 40, y: 40, w: 500, h: 60 }, st);

    const overflow = mk();
    overflow.text("This text is much too wide for the box", { x: 500, y: 20, w: 400, h: 60 }, { ...st, align: "left", min: 40 });

    const trunc = mk();
    trunc.text("word ".repeat(100), { x: 20, y: 20, w: 300, h: 60 }, { ...st, size: 30, min: 30, maxLines: 1 });

    const guard = mk();
    guard.guardBottom = 300;
    guard.roundRect({ x: 10, y: 250, w: 100, h: 100 }, 8, "#fff");
    return { clean: clean.report, overlap: overlap.report, overflow: overflow.report, trunc: trunc.report, guard: guard.report };
  });
  expect(r.clean.overlaps).toEqual([]);
  expect(r.clean.overflows).toEqual([]);
  expect(r.overlap.overlaps).toHaveLength(1);
  expect(r.overflow.overflows.length).toBeGreaterThan(0);
  expect(r.trunc.truncated).toHaveLength(1);
  expect(r.guard.overflows[0]).toMatch(/extends past content bottom/);
});

test("no card text clips even with a much wider font than Segoe UI (fallback-font robustness)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?demo=1");
  await page.waitForSelector("text=Expose your PC");
  const problems = await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const load = (path: string): Promise<any> => import(/* @vite-ignore */ path);
    const [{ renderCard }, { buildCardData }, { analyze }, { makeScan }, { TEMPLATES }, { typography }, { drawCompareCard }, { buildReport }] = await Promise.all([
      load("/src/share/render.ts"), load("/src/share/cardData.ts"), load("/src/engine/analyze.ts"), load("/src/engine/testFixtures.ts"),
      load("/src/share/templates.ts"), load("/src/share/painter.ts"), load("/src/share/compareCard.ts"), load("/src/reports/format.ts"),
    ]);
    const out: string[] = [];
    const canvas = document.createElement("canvas");
    const spec = { rgb: ["Corsair iCUE"], launchers: ["Steam"], startupEnabled: 12, startupDisabled: 6, drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 400, kind: "ssd", system: true }, { mount: "D:\\", totalGb: 2000, freeGb: 900, kind: "ssd" }] };
    for (const family of ["Verdana, sans-serif", "Georgia, serif", "'Courier New', monospace"]) {
      typography.override = family;
      try {
        const a = analyze(makeScan(spec), { seed: 3 });
        for (const privacy of [false, true]) {
          const data = buildCardData(a, { username: "@PCFlexer", privacy, watermark: true }, false);
          for (const t of TEMPLATES) for (const f of ["portrait", "landscape"]) {
            const r = await renderCard(canvas, t.id, f, data);
            for (const k of ["overflows", "truncated", "overlaps"] as const) if (r[k].length) out.push(`[${family}] ${t.id}-${f}${privacy ? "-privacy" : ""} ${k}: ${r[k].join(" | ")}`);
          }
        }
        const mk = (s2: object, label: string) => buildReport(analyze(makeScan(s2), { seed: 1 }), { label });
        for (const f of ["portrait", "landscape"]) {
          const r = drawCompareCard(canvas, f, mk(spec, "Gaming rig"), mk({ ...spec, threads: 8, gpu: "NVIDIA GeForce GTX 1660 SUPER", ramGb: 16 }, "Old faithful"), { privacy: false, watermark: true });
          for (const k of ["overflows", "truncated", "overlaps"] as const) if (r.report[k].length) out.push(`[${family}] compare-${f} ${k}: ${r.report[k].join(" | ")}`);
        }
      } finally {
        typography.override = null;
      }
    }
    return out;
  });
  expect(problems, problems.join("\n")).toEqual([]);
});
