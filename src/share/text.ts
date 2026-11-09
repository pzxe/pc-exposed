/**
 * Text fitting. Pure (the measuring function is injected) so it is unit-testable
 * without a canvas. Guarantees: every returned line fits `maxW`, and the block
 * fits `maxH`/`maxLines`, shrinking the font first and only ellipsizing at the
 * minimum size.
 */
export type Measure = (text: string, font: string) => number;

export interface FitOptions {
  maxW: number;
  maxH: number;
  startSize: number;
  minSize: number;
  maxLines: number;
  lineHeight: number; // multiplier
  fontFor: (size: number) => string;
  measure: Measure;
}

export interface FitResult {
  lines: string[];
  size: number;
  truncated: boolean;
}

/** Greedy word wrap; words wider than the line are broken by character. */
export function wrapText(text: string, maxW: number, font: string, measure: Measure): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const trial = line ? `${line} ${word}` : word;
      if (measure(trial, font) <= maxW) { line = trial; continue; }
      if (line) { out.push(line); line = ""; }
      if (measure(word, font) <= maxW) { line = word; continue; }
      // break an over-long word by characters
      let chunk = "";
      for (const ch of Array.from(word)) {
        if (measure(chunk + ch, font) > maxW && chunk) { out.push(chunk); chunk = ch; } else chunk += ch;
      }
      line = chunk;
    }
    out.push(line);
  }
  return out.length ? out : [""];
}

export function ellipsize(line: string, maxW: number, font: string, measure: Measure): string {
  if (measure(line, font) <= maxW) return line;
  const chars = Array.from(line);
  while (chars.length > 0 && measure(chars.join("").trimEnd() + "…", font) > maxW) chars.pop();
  return chars.join("").trimEnd() + "…";
}

export function fitText(text: string, o: FitOptions): FitResult {
  for (let size = o.startSize; size >= o.minSize; size -= 2) {
    const font = o.fontFor(size);
    const lines = wrapText(text, o.maxW, font, o.measure);
    if (lines.length <= o.maxLines && lines.length * size * o.lineHeight <= o.maxH) return { lines, size, truncated: false };
  }
  const size = o.minSize;
  const font = o.fontFor(size);
  const lines = wrapText(text, o.maxW, font, o.measure);
  const allowed = Math.max(1, Math.min(o.maxLines, Math.floor(o.maxH / (size * o.lineHeight))));
  if (lines.length <= allowed) return { lines, size, truncated: false };
  const kept = lines.slice(0, allowed);
  kept[allowed - 1] = ellipsize(lines.slice(allowed - 1).join(" "), o.maxW, font, o.measure);
  return { lines: kept, size, truncated: true };
}
