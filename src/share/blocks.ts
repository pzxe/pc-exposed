import { C, type Box, type Painter } from "./painter";

/** What the shared chrome (background, header, footer) needs from any card. */
export interface Brand {
  /** Accent tint for the background glow. */
  color: string;
  username?: string;
  demo: boolean;
  watermark: boolean;
  privacy: boolean;
}

export interface Layout {
  W: number;
  H: number;
  landscape: boolean;
  pad: number;
  /** Content area between the header and the footer. */
  top: number;
  bottom: number;
}

export function layoutFor(W: number, H: number): Layout {
  const landscape = W > H;
  const pad = landscape ? 88 : 72;
  return { W, H, landscape, pad, top: pad + (landscape ? 100 : 108), bottom: H - pad - (landscape ? 44 : 52) };
}

export function background(P: Painter, d: Brand) {
  const { ctx, W, H } = P;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, color: string, a: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `${color}${a}`); g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };
  glow(W * 0.85, H * 0.08, Math.max(W, H) * 0.55, d.color, "38");
  glow(W * 0.05, H * 0.95, Math.max(W, H) * 0.5, C.accent, "26");
  P.roundRect({ x: 20, y: 20, w: W - 40, h: H - 40 }, 36, undefined, C.border, 2);
}

export function header(P: Painter, L: Layout, d: Brand) {
  const { ctx } = P;
  const y = L.pad;
  const s = L.landscape ? 64 : 60;
  P.roundRect({ x: L.pad, y, w: s, h: s }, 18, C.accent);
  P.text("!", { x: L.pad, y: y + 2, w: s, h: s }, { size: s * 0.8, weight: 800, family: "display", color: C.bg, align: "center", valign: "middle" });
  P.text("PC EXPOSED", { x: L.pad + s + 20, y: y + (s - 32) / 2, w: 420, h: 36 }, { size: 30, weight: 700, color: C.soft, spacing: 7 });
  if (d.username) {
    const maxW = L.landscape ? 520 : 420;
    P.pill(d.username, L.W - L.pad, y + 4, 52, C.accent, maxW, "right");
  }
  ctx.globalAlpha = 1;
}

export function footer(P: Painter, L: Layout, d: Brand) {
  const y = L.H - L.pad - 30;
  const left = d.demo ? "DEMO DATA (synthetic), not a real PC" : d.watermark ? "Made with PC EXPOSED" : "";
  if (left) P.text(left, { x: L.pad, y, w: L.W / 2 - L.pad, h: 32 }, { size: 24, weight: 600, color: d.demo ? C.warn : C.muted, spacing: 1 });
  P.text(d.privacy ? "Privacy mode · scanned locally" : "Scanned locally on this PC", { x: L.W / 2, y, w: L.W / 2 - L.pad, h: 32 }, { size: 22, color: C.muted, align: "right" });
}

export function tile(P: Painter, b: Box, label: string, value: string, o: { size: number; lines?: number; color?: string; sub?: string } = { size: 40 }) {
  P.roundRect(b, 28, C.surface, C.border, 2);
  const p = 28;
  P.text(label.toUpperCase(), { x: b.x + p, y: b.y + p - 4, w: b.w - 2 * p, h: 28 }, { size: 20, weight: 700, color: C.muted, spacing: 3 });
  const subH = o.sub ? 34 : 0;
  const top = b.y + p + 34;
  P.text(value, { x: b.x + p, y: top, w: b.w - 2 * p, h: b.h - (top - b.y) - p - subH }, {
    size: o.size, weight: 700, family: "display", color: o.color ?? C.ink, maxLines: o.lines ?? 2, valign: "middle", min: 18,
  });
  if (o.sub) P.text(o.sub, { x: b.x + p, y: b.y + b.h - p - 28, w: b.w - 2 * p, h: 30 }, { size: 22, color: C.muted });
}

export function icon(P: Painter, img: HTMLImageElement | null, b: Box, color: string) {
  P.roundRect(b, b.w * 0.24, `${color}22`, `${color}66`, 3);
  if (img) {
    const s = b.w * 0.56;
    P.ctx.drawImage(img, b.x + (b.w - s) / 2, b.y + (b.h - s) / 2, s, s);
  }
}

export function grid(area: Box, rowHeights: number[], colWidths: number[][], gap: number): Box[][] {
  const rows: Box[][] = [];
  let y = area.y;
  rowHeights.forEach((h, r) => {
    let x = area.x;
    rows.push(colWidths[r].map((w) => { const b = { x, y, w, h }; x += w + gap; return b; }));
    y += h + gap;
  });
  return rows;
}
