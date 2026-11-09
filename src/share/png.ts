import type { Format, TemplateId } from "./templates";

/** Lightweight PNG helpers (kept apart from render.ts, which pulls in the icon rasterizer). */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png"),
  );
}

export function suggestedFileName(template: TemplateId, format: Format): string {
  return `pc-exposed-${template}-${format}.png`;
}
