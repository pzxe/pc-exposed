import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { iconFor } from "@/lib/icons";
import { Painter, type RenderReport } from "./painter";
import { drawTemplate, SIZES, type Format, type TemplateId } from "./templates";
import type { CardData } from "./cardData";

/** Rasterizes a lucide icon (by name) to an image, tinted with `color`. */
async function loadIcon(name: string, color: string): Promise<HTMLImageElement | null> {
  try {
    const svg = renderToStaticMarkup(createElement(iconFor(name), { size: 256, color, strokeWidth: 2 }));
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    return img;
  } catch {
    return null; // icon is decorative; the card still renders without it
  }
}

/**
 * Draws a card onto `canvas` at its full export resolution.
 * The returned report lists any text that did not fit (must be empty).
 */
export async function renderCard(
  canvas: HTMLCanvasElement, template: TemplateId, format: Format, data: CardData,
  /** Checked after the async preparation. When it returns false the canvas is left untouched, so a slow,
   *  superseded render can never paint over a newer one (fast template switching). */
  isCurrent: () => boolean = () => true,
): Promise<RenderReport | null> {
  const { w, h } = SIZES[format];
  try { await document.fonts.ready; } catch { /* fonts API unavailable: system fallback is used */ }
  const icon = await loadIcon(data.personality.icon, data.personality.color);
  if (!isCurrent()) return null;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  const P = new Painter(ctx, w, h);
  drawTemplate(P, template, data, icon);
  return P.report;
}

export { canvasToPng, suggestedFileName } from "./png";
