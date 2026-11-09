import { C, Painter, type Box, type RenderReport } from "./painter";
import { background, footer, header, layoutFor, type Layout } from "./blocks";
import { SIZES, type Format } from "./templates";
import { anonymizeReport, cleanText, type ReportV1 } from "@/reports/format";
import { compareReports, type CompareRow, type Winner } from "@/reports/compare";

export interface CompareCardOptions {
  /** Hide exact CPU/GPU model names (shown as classes). */
  privacy: boolean;
  watermark: boolean;
  demo?: boolean;
}

/** Rows shown on the card (the full set lives in the app). */
const CARD_ROWS = ["cpu", "gpu", "ram", "storage", "startup", "hardware", "gaming"];

function rowFor(rows: CompareRow[], id: string): CompareRow | undefined {
  return rows.find((r) => r.id.startsWith(`${id}-`));
}

const winColor = (w: Winner, side: "a" | "b") => (w === side ? C.soft : C.muted);

function scoreCard(P: Painter, b: Box, r: ReportV1, side: "A" | "B", wins: boolean, compact: boolean) {
  P.roundRect(b, 28, C.surface, wins ? C.accent : C.border, wins ? 3 : 2);
  const pad = 26;
  const ringR = compact ? 62 : 86;
  if (compact) {
    P.ring(b.x + pad + ringR + 6, b.y + b.h / 2, ringR, r.scores.overall, 14, { big: 56, small: 0 });
    const tx = b.x + pad + ringR * 2 + 40, tw = b.w - (tx - b.x) - pad;
    P.text(`PC ${side}`, { x: tx, y: b.y + 28, w: tw, h: 26 }, { size: 20, weight: 700, color: C.accent, spacing: 4 });
    P.text(r.label, { x: tx, y: b.y + 62, w: tw, h: 100 }, { size: 40, min: 22, weight: 800, family: "display", color: C.ink, maxLines: 2, lineHeight: 1.1 });
    P.text(r.scores.verdict || "—", { x: tx, y: b.y + b.h - 62, w: tw, h: 36 }, { size: 28, weight: 600, color: C.muted });
  } else {
    P.text(`PC ${side}`, { x: b.x + pad, y: b.y + 24, w: b.w - 2 * pad, h: 26 }, { size: 20, weight: 700, color: C.accent, spacing: 4 });
    P.ring(b.x + b.w / 2, b.y + 128, ringR, r.scores.overall, 16, { big: 64, small: 0 });
    P.text(r.label, { x: b.x + pad, y: b.y + 230, w: b.w - 2 * pad, h: 84 }, { size: 34, min: 20, weight: 800, family: "display", color: C.ink, maxLines: 2, align: "center", lineHeight: 1.1 });
    P.text(r.scores.verdict || "—", { x: b.x + pad, y: b.y + b.h - 50, w: b.w - 2 * pad, h: 32 }, { size: 24, weight: 600, color: C.muted, align: "center" });
  }
}

export interface CompareRender { report: RenderReport; summary: string }

/** Draws the comparison card. Imported labels are sanitized again here as defense in depth. */
export function drawCompareCard(canvas: HTMLCanvasElement, format: Format, a0: ReportV1, b0: ReportV1, opts: CompareCardOptions): CompareRender {
  const { w: W, h: H } = SIZES[format];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");

  const prep = (r: ReportV1): ReportV1 => {
    const c = opts.privacy && !r.privacy.modelsHidden ? anonymizeReport(r) : r;
    return { ...c, label: cleanText(c.label, 40) || "PC" };
  };
  const a = prep(a0), b = prep(b0);
  const cmp = compareReports(a, b);
  const L: Layout = layoutFor(W, H);
  const P = new Painter(ctx, W, H);

  background(P, { color: C.accent, demo: opts.demo ?? false, watermark: opts.watermark, privacy: opts.privacy });
  header(P, L, { color: C.accent, demo: false, watermark: false, privacy: false });
  // Summary pill in the header's right corner (the compare card has no username).
  P.pill(cmp.summary, W - L.pad, L.pad + 4, 52, C.accent, L.landscape ? 640 : 480, "right");
  P.guardBottom = L.bottom;

  const area = { x: L.pad, y: L.top - 8, w: W - 2 * L.pad };
  const gap = 24;
  const half = (area.w - gap) / 2;
  const cardH = L.landscape ? 200 : 384;
  const aWins = cmp.aWins > cmp.bWins, bWins = cmp.bWins > cmp.aWins;
  scoreCard(P, { x: area.x, y: area.y, w: half, h: cardH }, a, "A", aWins, L.landscape);
  scoreCard(P, { x: area.x + half + gap, y: area.y, w: half, h: cardH }, b, "B", bWins, L.landscape);

  const rows = CARD_ROWS.map((id) => rowFor(cmp.rows, id)).filter((r): r is CompareRow => !!r);
  const top = area.y + cardH + gap;
  const rowH = (L.bottom - top - gap * 0) / rows.length;
  const labelW = L.landscape ? 250 : 200;
  const colW = (area.w - labelW - 2 * 16) / 2;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const box = { x: area.x, y: y + 4, w: area.w, h: rowH - 8 };
    P.roundRect(box, 20, i % 2 === 0 ? C.surface : "#1B1624", C.border, 1);
    P.text(r.label.toUpperCase(), { x: box.x + 24, y: box.y, w: labelW - 24, h: box.h }, { size: 20, weight: 700, color: C.muted, spacing: 3, valign: "middle", min: 14, maxLines: 2, lineHeight: 1.15 });
    const size = L.landscape ? 28 : 28;
    const colA = { x: box.x + labelW + 8, y: box.y + 6, w: colW - 16, h: box.h - 12 };
    const colB = { x: colA.x + colW + 16, y: colA.y, w: colA.w, h: colA.h };
    const mk = (side: "a" | "b", col: Box, text: string) => {
      P.text(`${r.winner === side ? "✓ " : ""}${text}`, col, { size, min: 16, weight: r.winner === side ? 800 : 600, family: "display", color: winColor(r.winner, side), maxLines: 2, valign: "middle", lineHeight: 1.1 });
    };
    mk("a", colA, r.a);
    mk("b", colB, r.b);
  });

  P.guardBottom = null;
  footer(P, L, { color: C.accent, demo: opts.demo ?? false, watermark: opts.watermark, privacy: opts.privacy });
  return { report: P.report, summary: cmp.summary };
}
