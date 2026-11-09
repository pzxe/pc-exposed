import { fitText } from "./text";

export const C = {
  bg: "#111014", surface: "#211B2B", surface2: "#2A2237", border: "#3A2F4D",
  accent: "#A879FF", soft: "#F1DDFE", muted: "#A89BB5", ink: "#F6EFFC", warn: "#F3C969",
} as const;

const FAMILY = {
  display: '"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif',
  sans: '"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif',
} as const;

export interface Box { x: number; y: number; w: number; h: number }

export interface TextStyle {
  size: number;
  min?: number;
  weight?: number;
  color: string;
  family?: keyof typeof FAMILY;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  maxLines?: number;
  lineHeight?: number;
  spacing?: number;
  alpha?: number;
}

/** What a render drew, and anything that did not fit. Used by tests and the UI. */
export interface RenderReport {
  width: number;
  height: number;
  texts: number;
  /** Text whose measured box exceeded its container or the canvas (must be empty). */
  overflows: string[];
  /** Text that had to be ellipsized even at the minimum font size. */
  truncated: string[];
  /** Pairs of text blocks whose drawn areas intersect (must be empty). */
  overlaps: string[];
}

export class Painter {
  readonly report: RenderReport;
  /** When set, any box drawn below this y is reported as an overflow (keeps content out of the footer). */
  guardBottom: number | null = null;
  private drawn: { label: string; x0: number; x1: number; y0: number; y1: number }[] = [];
  constructor(readonly ctx: CanvasRenderingContext2D, readonly W: number, readonly H: number) {
    this.report = { width: W, height: H, texts: 0, overflows: [], truncated: [], overlaps: [] };
  }

  /** Measures how `str` will be fitted into `box` without drawing it. */
  layout(str: string, box: Box, s: TextStyle): { size: number; lines: string[]; blockH: number; truncated: boolean } {
    const { ctx } = this;
    const weight = s.weight ?? 500;
    const family = FAMILY[s.family ?? "sans"];
    const lh = s.lineHeight ?? 1.22;
    ctx.save();
    ctx.letterSpacing = `${s.spacing ?? 0}px`;
    const measure = (t: string, font: string) => { ctx.font = font; return ctx.measureText(t).width; };
    const fit = fitText(str, {
      maxW: box.w, maxH: box.h, startSize: s.size, minSize: s.min ?? Math.max(14, Math.round(s.size * 0.5)),
      maxLines: s.maxLines ?? 1, lineHeight: lh, fontFor: (z) => `${weight} ${z}px ${family}`, measure,
    });
    ctx.restore();
    return { ...fit, blockH: fit.lines.length * fit.size * lh };
  }

  /** Draws fitted text inside `box`. Returns the height actually used. */
  text(str: string, box: Box, s: TextStyle): number {
    const { ctx } = this;
    const weight = s.weight ?? 500;
    const family = FAMILY[s.family ?? "sans"];
    const lh = s.lineHeight ?? 1.22;
    const fit = this.layout(str, box, s);
    ctx.save();
    ctx.letterSpacing = `${s.spacing ?? 0}px`;
    ctx.font = `${weight} ${fit.size}px ${family}`;
    ctx.fillStyle = s.color;
    ctx.globalAlpha = s.alpha ?? 1;
    ctx.textBaseline = "top";
    const align = s.align ?? "left";
    ctx.textAlign = align;
    const lineH = fit.size * lh;
    const blockH = fit.blockH;
    const startY = s.valign === "middle" ? box.y + (box.h - blockH) / 2 : s.valign === "bottom" ? box.y + box.h - blockH : box.y;
    const x = align === "left" ? box.x : align === "center" ? box.x + box.w / 2 : box.x + box.w;
    let widest = 0;
    fit.lines.forEach((line, i) => {
      ctx.fillText(line, x, startY + i * lineH);
      widest = Math.max(widest, ctx.measureText(line).width);
    });
    ctx.restore();

    this.report.texts++;
    const left = align === "left" ? x : align === "center" ? x - widest / 2 : x - widest;
    const outOfBox = widest > box.w + 0.5 || blockH > box.h + 0.5;
    const outOfCanvas = left < -0.5 || left + widest > this.W + 0.5 || startY < -0.5 || startY + blockH > this.H + 0.5;
    if (outOfBox || outOfCanvas) this.report.overflows.push(`"${str.slice(0, 40)}" (${Math.round(widest)}x${Math.round(blockH)} in ${box.w}x${box.h})`);
    if (fit.truncated) this.report.truncated.push(str.slice(0, 40));

    // Overlap audit. Decorative (semi-transparent) text is exempt; rectangles are shrunk
    // vertically by the line's internal leading so tightly-set lines do not false-positive.
    if ((s.alpha ?? 1) >= 1) {
      const trim = fit.size * 0.14;
      const rect = { label: str.slice(0, 30), x0: left, x1: left + widest, y0: startY + trim, y1: startY + blockH - trim };
      for (const o of this.drawn) {
        if (Math.min(rect.x1, o.x1) - Math.max(rect.x0, o.x0) > 3 && Math.min(rect.y1, o.y1) - Math.max(rect.y0, o.y0) > 3) {
          this.report.overlaps.push(`"${rect.label}" overlaps "${o.label}"`);
        }
      }
      this.drawn.push(rect);
    }
    return blockH;
  }

  roundRect(b: Box, r: number, fill?: string, stroke?: string, lineWidth = 2) {
    const { ctx } = this;
    if (this.guardBottom !== null && b.y + b.h > this.guardBottom + 0.5) {
      this.report.overflows.push(`box at y=${Math.round(b.y)} h=${Math.round(b.h)} extends past content bottom ${Math.round(this.guardBottom)}`);
    }
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  /** Pill sized to its text. Returns the pill width. */
  pill(text: string, x: number, y: number, h: number, color: string, maxW: number, align: "left" | "right" = "left"): number {
    const { ctx } = this;
    const size = Math.round(h * 0.46);
    ctx.save();
    ctx.font = `600 ${size}px ${FAMILY.sans}`;
    const w = Math.min(maxW, ctx.measureText(text).width + h * 0.9);
    ctx.restore();
    const px = align === "right" ? x - w : x;
    this.roundRect({ x: px, y, w, h }, h / 2, `${color}22`, `${color}88`, 2);
    this.text(text, { x: px + h * 0.45, y: y + (h - size * 1.22) / 2, w: w - h * 0.9, h: size * 1.3 }, { size, weight: 600, color, min: 14 });
    return w;
  }

  ring(cx: number, cy: number, r: number, score: number | null, thickness: number, label?: { big: number; small: number }) {
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = thickness;
    ctx.lineCap = "round";
    ctx.strokeStyle = C.surface2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (score !== null) {
      const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      g.addColorStop(0, C.soft); g.addColorStop(1, C.accent);
      ctx.strokeStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * score) / 100); ctx.stroke();
    }
    ctx.restore();
    if (label) {
      const inner = r * 1.5;
      this.text(score === null ? "—" : String(score), { x: cx - inner / 2, y: cy - label.big * 0.62, w: inner, h: label.big * 1.2 }, { size: label.big, weight: 800, family: "display", color: C.ink, align: "center" });
      // small === 0 hides the caption (compact rings, where the context already says it is a score)
      if (label.small > 0) this.text("OUT OF 100", { x: cx - inner / 2, y: cy + label.big * 0.55, w: inner, h: label.small * 1.4 }, { size: label.small, weight: 600, color: C.muted, align: "center", spacing: 3 });
    }
  }
}
