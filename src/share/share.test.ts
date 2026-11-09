import { describe, it, expect } from "vitest";
import { ellipsize, fitText, wrapText, type Measure } from "./text";
import { buildCardData, identifiersOf, redact, sanitizeUsername } from "./cardData";
import { analyze } from "@/engine/analyze";
import { makeScan } from "@/engine/testFixtures";
import { SIZES, TEMPLATES } from "./templates";
import type { FullAnalysis } from "@/app/state";

// Fake monospace-ish measure: width = chars × size × 0.5
const measure: Measure = (t, font) => t.length * parseInt(/(\d+)px/.exec(font)![1], 10) * 0.5;
const fontFor = (n: number) => `700 ${n}px X`;

describe("text fitting", () => {
  it("wraps on words and breaks over-long words by character", () => {
    // width = chars × 10 × 0.5, so 60px fits 12 chars: "aaa bbb ccc" (11) fits one line, "aaa bbb ccc ddd" wraps.
    expect(wrapText("aaa bbb ccc", 60, fontFor(10), measure)).toEqual(["aaa bbb ccc"]);
    expect(wrapText("aaa bbb ccc ddd", 60, fontFor(10), measure)).toEqual(["aaa bbb ccc", "ddd"]);
    const lines = wrapText("Supercalifragilisticexpialidocious", 100, fontFor(20), measure);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(measure(l, fontFor(20))).toBeLessThanOrEqual(100);
  });

  it("shrinks the font before truncating", () => {
    const r = fitText("one two three four five six seven eight nine ten", { maxW: 300, maxH: 200, startSize: 60, minSize: 20, maxLines: 4, lineHeight: 1.2, fontFor, measure });
    expect(r.truncated).toBe(false);
    expect(r.size).toBeLessThan(60);
    expect(r.lines.length).toBeLessThanOrEqual(4);
    for (const l of r.lines) expect(measure(l, fontFor(r.size))).toBeLessThanOrEqual(300);
  });

  it("only ellipsizes at the minimum size, and the result still fits", () => {
    const long = "word ".repeat(200);
    const r = fitText(long, { maxW: 300, maxH: 100, startSize: 40, minSize: 20, maxLines: 2, lineHeight: 1.2, fontFor, measure });
    expect(r.truncated).toBe(true);
    expect(r.size).toBe(20);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[1].endsWith("…")).toBe(true);
    for (const l of r.lines) expect(measure(l, fontFor(20))).toBeLessThanOrEqual(300);
  });

  it("ellipsize leaves short text alone", () => {
    expect(ellipsize("short", 500, fontFor(20), measure)).toBe("short");
  });
});

describe("username sanitizing", () => {
  it("strips control, bidi-override and bracket characters and limits length", () => {
    expect(sanitizeUsername("  <b>Al\u202Eice</b>\u0000  ")).toBe("bAlice/b");
    expect(sanitizeUsername("a\n\n b\t c")).toBe("a b c");
    expect(Array.from(sanitizeUsername("x".repeat(100)))).toHaveLength(24);
    expect(sanitizeUsername("\u200B\u200F")).toBe("");
    expect(sanitizeUsername("😀".repeat(30))).toBe("😀".repeat(24));
  });
});

const scan = makeScan({
  threads: 16, gpu: "NVIDIA GeForce RTX 4080", vramGb: 16, ramGb: 32,
  startupEnabled: ["Discord", "Steam", "Spotify", "Overwolf"], rgb: ["Corsair iCUE", "OpenRGB"], launchers: ["Steam", "Epic Games Launcher", "GOG Galaxy"],
  procs: ["chrome.exe"], drives: [{ mount: "C:\\", totalGb: 1000, freeGb: 400, kind: "ssd", system: true }, { mount: "D:\\", totalGb: 2000, freeGb: 900, kind: "ssd" }],
});
const full = (seed: number) => analyze(scan, { seed }) as FullAnalysis;

describe("card data and privacy mode", () => {
  it("normal mode shows exact models and the username", () => {
    const d = buildCardData(full(1), { username: "Sam", privacy: false, watermark: true }, false);
    expect(d.gpu).toBe("GeForce RTX 4080");
    expect(d.cpu).toBe("Test CPU");
    expect(d.username).toBe("Sam");
    expect(d.watermark).toBe(true);
  });

  it("privacy mode removes every identifying string, across many roast seeds", () => {
    const a0 = full(0);
    const ids = identifiersOf(a0.facts).map((i) => i.term);
    for (let seed = 0; seed < 60; seed++) {
      const d = buildCardData(full(seed), { username: "SecretName", privacy: true, watermark: false }, false);
      const blob = JSON.stringify(d).toLowerCase();
      expect(d.username).toBeUndefined();
      expect(blob).not.toContain("secretname");
      for (const term of ids) expect(blob, `leaked "${term}" (seed ${seed})`).not.toContain(term.toLowerCase());
      expect(blob).not.toMatch(/[a-z]:\\/);
    }
  });

  it("privacy mode substitutes generic classes for models", () => {
    const d = buildCardData(full(1), { username: "", privacy: true, watermark: true }, false);
    expect(d.gpu).toBe("NVIDIA enthusiast-class GPU");
    expect(d.cpu).toBe("Processor");
  });

  it("redact replaces longer identifiers first and is case-insensitive", () => {
    const ids = identifiersOf(full(1).facts);
    expect(redact("steam wakes up. Epic Games Launcher too.", ids)).not.toMatch(/steam|epic/i);
  });

  it("flags demo data on the card model", () => {
    expect(buildCardData(full(1), { username: "", privacy: false, watermark: false }, true).demo).toBe(true);
  });

  it("defines the five required templates and both export sizes", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["identity", "roast", "hardware", "score", "wrapped"]);
    expect(SIZES.portrait).toEqual({ w: 1080, h: 1350 });
    expect(SIZES.landscape).toEqual({ w: 1920, h: 1080 });
  });
});
