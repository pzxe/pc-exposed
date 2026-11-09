import type { Reading } from "./scanTypes";

const UNITS = ["B", "KB", "MB", "GB", "TB"];

/** Binary-scaled size, e.g. 17179869184 -> "16 GB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : Math.round(v * 10) / 10} ${UNITS[i]}`;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Renders a reading, making "unavailable" visibly different from a real value. */
export function show<T>(r: Reading<T>, fmt: (v: T) => string = String): string {
  return r.status === "available" ? fmt(r.value) : "Unavailable";
}

export function reasonOf<T>(r: Reading<T>): string | undefined {
  return r.status === "unavailable" ? r.reason : undefined;
}
