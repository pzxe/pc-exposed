import { C, type Box, type Painter } from "./painter";
import { background, footer, grid, header, icon, layoutFor, tile, type Layout } from "./blocks";
import type { CardData } from "./cardData";

export type TemplateId = "identity" | "roast" | "hardware" | "score" | "wrapped";
export type Format = "portrait" | "landscape";

export const SIZES: Record<Format, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1350 },
  landscape: { w: 1920, h: 1080 },
};

export const TEMPLATES: { id: TemplateId; label: string; blurb: string }[] = [
  { id: "identity", label: "PC Identity", blurb: "Your PC's personality and key specs." },
  { id: "roast", label: "PC Roast", blurb: "The best roast, front and center." },
  { id: "hardware", label: "Hardware Flex", blurb: "The spec sheet, showcased." },
  { id: "score", label: "PC Score", blurb: "Score ring with the full breakdown." },
  { id: "wrapped", label: "PC Wrapped", blurb: "Everything at a glance." },
];

type Draw = (P: Painter, L: Layout, d: CardData, ic: HTMLImageElement | null) => void;

const eyebrow = (P: Painter, text: string, x: number, y: number, w: number, align: "left" | "center" = "left") =>
  P.text(text, { x, y, w, h: 34 }, { size: 26, weight: 700, color: C.muted, spacing: 8, align });

const verdictPill = (P: Painter, d: CardData, x: number, y: number, maxW: number) =>
  P.pill(d.score === null ? "No score" : `${d.score}/100 · ${d.verdict}`, x, y, 64, C.accent, maxW);

// ───────────────────────── 1. Identity ─────────────────────────
const identity: Draw = (P, L, d, ic) => {
  const { pad, W } = L;
  const color = d.personality.color;
  if (!L.landscape) {
    const w = W - 2 * pad;
    icon(P, ic, { x: pad, y: L.top + 10, w: 200, h: 200 }, color);
    eyebrow(P, "MY PC IS", pad, 440, w);
    P.text(d.personality.title, { x: pad, y: 484, w, h: 236 }, { size: 112, min: 52, weight: 800, family: "display", color, maxLines: 2, lineHeight: 1.05 });
    P.text(d.personality.description, { x: pad, y: 730, w, h: 150 }, { size: 36, min: 24, color: C.muted, maxLines: 4, lineHeight: 1.3 });
    verdictPill(P, d, pad, 896, w);
    const rows = [["CPU", d.cpu], ["GPU", d.vram ? `${d.gpu} · ${d.vram}` : d.gpu], ["Memory · Storage", `${d.ram} · ${d.storage}`]];
    const y0 = 984, rh = 70;
    P.roundRect({ x: pad, y: y0, w, h: rh * 3 + 28 }, 28, C.surface, C.border);
    rows.forEach(([k, v], i) => {
      const y = y0 + 14 + i * rh;
      P.text(k.toUpperCase(), { x: pad + 28, y: y + 18, w: 190, h: 28 }, { size: 20, weight: 700, color: C.muted, spacing: 3 });
      P.text(v, { x: pad + 240, y: y + 10, w: w - 240 - 28, h: 50 }, { size: 32, min: 20, weight: 600, family: "display", color: C.ink });
    });
  } else {
    const lw = 1000;
    icon(P, ic, { x: pad, y: L.top + 6, w: 220, h: 220 }, color);
    eyebrow(P, "MY PC IS", pad, 440, lw);
    P.text(d.personality.title, { x: pad, y: 484, w: lw, h: 260 }, { size: 120, min: 56, weight: 800, family: "display", color, maxLines: 2, lineHeight: 1.05 });
    P.text(d.personality.description, { x: pad, y: 770, w: lw, h: 150 }, { size: 34, min: 22, color: C.muted, maxLines: 3, lineHeight: 1.3 });
    const px = 1180, pw = W - pad - px, py = L.top - 6, ph = L.bottom - py;
    P.roundRect({ x: px, y: py, w: pw, h: ph }, 36, C.surface, C.border);
    P.ring(px + pw / 2, py + 190, 130, d.score, 22, { big: 96, small: 18 });
    P.text(d.verdict, { x: px + 40, y: py + 350, w: pw - 80, h: 70 }, { size: 56, weight: 800, family: "display", color: C.soft, align: "center" });
    const rows = [["CPU", d.cpu], ["GPU", d.gpu], ["Memory", d.ram]];
    rows.forEach(([k, v], i) => {
      const y = py + 450 + i * 100;
      P.text(k.toUpperCase(), { x: px + 40, y, w: pw - 80, h: 26 }, { size: 19, weight: 700, color: C.muted, spacing: 3 });
      P.text(v, { x: px + 40, y: y + 30, w: pw - 80, h: 66 }, { size: 32, min: 18, weight: 600, family: "display", color: C.ink, maxLines: 2, lineHeight: 1.1 });
    });
  }
};

// ───────────────────────── 2. Roast ─────────────────────────
/** Draws a quote vertically centered in `box`, with the opening mark anchored to the real text block. */
function quote(P: Painter, text: string, box: Box, s: { size: number; min: number; maxLines: number }) {
  const style = { ...s, weight: 700, family: "display" as const, color: C.soft, lineHeight: 1.18 };
  const { blockH } = P.layout(text, box, style);
  const y0 = box.y + (box.h - blockH) / 2;
  P.text("“", { x: box.x - 4, y: y0 - 150, w: 200, h: 220 }, { size: 220, weight: 800, family: "display", color: C.accent, alpha: 0.4 });
  P.text(text, { x: box.x, y: y0, w: box.w, h: blockH + 1 }, style);
}

const roast: Draw = (P, L, d, ic) => {
  const { pad, W } = L;
  const color = d.personality.color;
  if (!L.landscape) {
    const w = W - 2 * pad;
    eyebrow(P, "BEST ROAST", pad, L.top + 6, w);
    quote(P, d.roast, { x: pad, y: L.top + 120, w, h: 720 }, { size: 92, min: 40, maxLines: 8 });
    icon(P, ic, { x: pad, y: 1058, w: 96, h: 96 }, color);
    P.text(d.personality.title, { x: pad + 120, y: 1062, w: w - 120, h: 50 }, { size: 38, min: 20, weight: 800, family: "display", color });
    P.text(d.score === null ? "No score" : `Score ${d.score}/100 · ${d.verdict}`, { x: pad + 120, y: 1112, w: w - 120, h: 40 }, { size: 28, color: C.muted });
  } else {
    const qw = 1080;
    eyebrow(P, "BEST ROAST", pad, L.top + 6, qw);
    quote(P, d.roast, { x: pad, y: L.top + 90, w: qw, h: 620 }, { size: 98, min: 40, maxLines: 6 });
    const px = 1260, pw = W - pad - px, py = L.top - 6, ph = L.bottom - py;
    P.roundRect({ x: px, y: py, w: pw, h: ph }, 36, C.surface, C.border);
    icon(P, ic, { x: px + (pw - 140) / 2, y: py + 40, w: 140, h: 140 }, color);
    P.text(d.personality.title, { x: px + 36, y: py + 210, w: pw - 72, h: 130 }, { size: 46, min: 24, weight: 800, family: "display", color, align: "center", maxLines: 2, lineHeight: 1.1 });
    P.ring(px + pw / 2, py + 520, 100, d.score, 18, { big: 72, small: 15 });
    P.text(d.verdict, { x: px + 36, y: py + 650, w: pw - 72, h: 50 }, { size: 40, weight: 700, family: "display", color: C.soft, align: "center" });
  }
};

// ───────────────────────── 3. Hardware flex ─────────────────────────
const hardware: Draw = (P, L, d) => {
  const { pad, W } = L;
  if (!L.landscape) {
    const w = W - 2 * pad;
    eyebrow(P, "THE SPEC SHEET", pad, L.top + 6, w);
    const gh = P.text(d.gpu, { x: pad, y: L.top + 60, w, h: 300 }, { size: 104, min: 44, weight: 800, family: "display", color: C.soft, maxLines: 3, lineHeight: 1.05 });
    if (d.vram) P.text(d.vram, { x: pad, y: L.top + 60 + gh + 24, w, h: 52 }, { size: 40, weight: 700, color: C.accent });
    const tw = (w - 24) / 2;
    const g = grid({ x: pad, y: 640, w, h: 0 }, [240, 240], [[tw, tw], [tw, tw]], 24);
    tile(P, g[0][0], "Processor", d.cpu, { size: 40, lines: 3, sub: d.threads });
    tile(P, g[0][1], "Memory", d.ram.replace(" RAM", ""), { size: 72, lines: 1, sub: "RAM installed" });
    tile(P, g[1][0], "Storage", d.storage, { size: 44, lines: 2 });
    tile(P, g[1][1], "Hardware power", d.hardwareScore === null ? "—" : `${d.hardwareScore}/100`, { size: 72, lines: 1, color: C.accent, sub: "estimated from specs" });
  } else {
    const lw = 880;
    eyebrow(P, "THE SPEC SHEET", pad, L.top + 6, lw);
    const gh = P.text(d.gpu, { x: pad, y: L.top + 70, w: lw, h: 400 }, { size: 132, min: 48, weight: 800, family: "display", color: C.soft, maxLines: 3, lineHeight: 1.05 });
    if (d.vram) P.text(d.vram, { x: pad, y: L.top + 70 + gh + 28, w: lw, h: 60 }, { size: 46, weight: 700, color: C.accent });
    const x0 = 1040, tw = (W - pad - x0 - 24) / 2, th = (L.bottom - L.top - 24) / 2;
    const g = grid({ x: x0, y: L.top, w: 0, h: 0 }, [th, th], [[tw, tw], [tw, tw]], 24);
    tile(P, g[0][0], "Processor", d.cpu, { size: 38, lines: 3, sub: d.threads });
    tile(P, g[0][1], "Memory", d.ram.replace(" RAM", ""), { size: 76, lines: 1, sub: "RAM installed" });
    tile(P, g[1][0], "Storage", d.storage, { size: 42, lines: 2 });
    tile(P, g[1][1], "Hardware power", d.hardwareScore === null ? "—" : `${d.hardwareScore}/100`, { size: 76, lines: 1, color: C.accent, sub: "estimated from specs" });
  }
};

// ───────────────────────── 4. Score ─────────────────────────
const bars = (P: Painter, d: CardData, x: number, y: number, w: number, rowH: number, labelSize: number) => {
  d.categories.forEach((c, i) => {
    const ry = y + i * rowH;
    P.text(c.label, { x, y: ry, w: w * 0.4, h: rowH }, { size: labelSize, weight: 600, color: C.ink, valign: "middle", min: 16 });
    const bx = x + w * 0.42, bw = w * 0.42, bh = 16;
    P.roundRect({ x: bx, y: ry + rowH / 2 - bh / 2, w: bw, h: bh }, bh / 2, C.surface2);
    if (c.score !== null) {
      const g = P.ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, C.accent); g.addColorStop(1, C.soft);
      P.ctx.fillStyle = g;
      P.ctx.beginPath(); P.ctx.roundRect(bx, ry + rowH / 2 - bh / 2, Math.max(bh, (bw * c.score) / 100), bh, bh / 2); P.ctx.fill();
    }
    P.text(c.score === null ? "n/a" : `${c.score}`, { x: x + w * 0.88, y: ry, w: w * 0.12, h: rowH }, { size: labelSize, weight: 700, color: c.score === null ? C.muted : C.soft, align: "right", valign: "middle" });
  });
};

const score: Draw = (P, L, d) => {
  const { pad, W } = L;
  if (!L.landscape) {
    const w = W - 2 * pad;
    P.ring(W / 2, L.top + 260, 200, d.score, 32, { big: 160, small: 24 });
    P.text(d.verdict, { x: pad, y: L.top + 500, w, h: 90 }, { size: 78, weight: 800, family: "display", color: C.soft, align: "center" });
    P.pill(`${d.confidence} confidence`, W / 2 - 150, L.top + 604, 52, C.muted, 300);
    bars(P, d, pad, L.top + 690, w, 52, 28);
  } else {
    const cx = pad + 400;
    P.ring(cx, (L.top + L.bottom) / 2 - 20, 280, d.score, 40, { big: 220, small: 28 });
    const x0 = 1020, w = W - pad - x0;
    P.text(d.verdict, { x: x0, y: L.top, w, h: 110 }, { size: 96, weight: 800, family: "display", color: C.soft });
    P.pill(`${d.confidence} confidence`, x0, L.top + 128, 52, C.muted, 320);
    bars(P, d, x0, L.top + 230, w, 80, 32);
  }
};

// ───────────────────────── 5. Wrapped ─────────────────────────
const wrapped: Draw = (P, L, d) => {
  const { pad, W } = L;
  const color = d.personality.color;
  const gap = 20;
  const w = W - 2 * pad;
  if (!L.landscape) {
    const area = { x: pad, y: L.top - 8, w, h: 0 };
    const g = grid(area, [250, 180, 170, 200, 170], [[300, w - 300 - gap], [(w - gap) / 2, (w - gap) / 2], [(w - 2 * gap) / 3, (w - 2 * gap) / 3, (w - 2 * gap) / 3], [w], [w]], gap);
    drawScoreTile(P, g[0][0], d);
    tile(P, g[0][1], "My PC is", d.personality.title, { size: 52, lines: 2, color, sub: d.score === null ? undefined : `${d.score}/100 · ${d.verdict}` });
    tile(P, g[1][0], "Strongest", d.strongest ?? "—", { size: 38, lines: 2 });
    tile(P, g[1][1], "Weakest", d.weakest ?? "—", { size: 38, lines: 2 });
    tile(P, g[2][0], "Startup", d.startup.replace(" startup", ""), { size: 38, lines: 2 });
    tile(P, g[2][1], "Memory", d.ram.replace(" RAM", ""), { size: 44, lines: 1 });
    tile(P, g[2][2], "Storage", d.storage, { size: 32, lines: 2 });
    tile(P, g[3][0], d.discovery.title, d.discovery.text, { size: 36, lines: 3 });
    tile(P, g[4][0], "Best roast", `“${d.roast}”`, { size: 34, lines: 2, color: C.soft });
  } else {
    const area = { x: pad, y: L.top - 8, w, h: 0 };
    const q = (w - 3 * gap) / 4;
    const g = grid(area, [330, 170, 228], [[380, 780, w - 380 - 780 - 2 * gap], [q, q, q, q], [(w - gap) / 2, (w - gap) / 2]], gap);
    drawScoreTile(P, g[0][0], d);
    tile(P, g[0][1], "My PC is", d.personality.title, { size: 76, lines: 2, color, sub: d.score === null ? undefined : `${d.score}/100 · ${d.verdict}` });
    const right = g[0][2];
    tile(P, { ...right, h: 155 }, "Strongest", d.strongest ?? "—", { size: 30, lines: 2 });
    tile(P, { ...right, y: right.y + 175, h: 155 }, "Weakest", d.weakest ?? "—", { size: 30, lines: 2 });
    tile(P, g[1][0], "Startup", d.startup.replace(" startup", ""), { size: 36, lines: 2 });
    tile(P, g[1][1], "Memory", d.ram.replace(" RAM", ""), { size: 44, lines: 1 });
    tile(P, g[1][2], "Graphics", d.gpu, { size: 30, lines: 2 });
    tile(P, g[1][3], "Storage", d.storage, { size: 30, lines: 2 });
    tile(P, g[2][0], d.discovery.title, d.discovery.text, { size: 36, lines: 3 });
    tile(P, g[2][1], "Best roast", `“${d.roast}”`, { size: 36, lines: 3, color: C.soft });
  }
};

function drawScoreTile(P: Painter, b: Box, d: CardData) {
  P.roundRect(b, 28, C.surface, C.border, 2);
  P.text("SCORE", { x: b.x + 28, y: b.y + 24, w: b.w - 56, h: 28 }, { size: 20, weight: 700, color: C.muted, spacing: 3 });
  const r = Math.min(b.w, b.h - 40) / 2 - 30;
  P.ring(b.x + b.w / 2, b.y + b.h / 2 + 18, r, d.score, 16, { big: Math.round(r * 0.8), small: 12 });
}

const DRAW: Record<TemplateId, Draw> = { identity, roast, hardware, score, wrapped };

export function drawTemplate(P: Painter, id: TemplateId, d: CardData, ic: HTMLImageElement | null) {
  const L = layoutFor(P.W, P.H);
  const brand = { color: d.personality.color, username: d.username, demo: d.demo, watermark: d.watermark, privacy: d.privacy };
  background(P, brand);
  header(P, L, brand);
  P.guardBottom = L.bottom;
  DRAW[id](P, L, d, ic);
  P.guardBottom = null;
  footer(P, L, brand);
}
