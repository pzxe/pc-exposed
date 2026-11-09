/**
 * Local report storage. Reports live in this app's own WebView storage
 * (localStorage under the app's data directory, e.g. %LOCALAPPDATA%\dev.pcexposed.desktop).
 * Nothing is transmitted. Every read re-validates, so a corrupted or tampered
 * entry is dropped instead of trusted.
 */
import { useSyncExternalStore } from "react";
import { validateReport, type ReportV1 } from "./format";

export type ReportSource = "local" | "imported";
export interface StoredReport { report: ReportV1; source: ReportSource; savedAt: number }

export const REPORTS_KEY = "pc-exposed.reports.v1";
export const MAX_REPORTS = 50;

/** All localStorage keys this app owns. "Reset all local data" clears exactly these. */
export const LOCAL_DATA_KEYS = [REPORTS_KEY, "pc-exposed.settings.v1", "pc-exposed.studio.v1", "pc-exposed.roasts.v1"] as const;

type Result = { ok: true } | { ok: false; error: string };

let cache: StoredReport[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): StoredReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: StoredReport[] = [];
    for (const item of arr) {
      if (typeof item !== "object" || item === null) continue;
      const rec = item as { report?: unknown; source?: unknown; savedAt?: unknown };
      const v = validateReport(rec.report);
      if (!v.ok) continue; // corrupt entry: dropped
      out.push({ report: v.report, source: rec.source === "imported" ? "imported" : "local", savedAt: typeof rec.savedAt === "number" ? rec.savedAt : v.report.createdAt });
    }
    return out;
  } catch {
    return [];
  }
}

function write(list: StoredReport[]): Result {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(list));
    cache = list;
    emit();
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save: local storage is full or unavailable." };
  }
}

export const reportStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  /** Referentially stable between changes (required by useSyncExternalStore). */
  getSnapshot(): StoredReport[] { return (cache ??= read()); },
  list(): StoredReport[] { return this.getSnapshot(); },

  save(report: ReportV1, source: ReportSource): Result {
    const list = this.getSnapshot();
    const without = list.filter((r) => r.report.id !== report.id);
    if (without.length >= MAX_REPORTS) return { ok: false, error: `You can keep up to ${MAX_REPORTS} saved reports. Delete some first.` };
    return write([{ report, source, savedAt: Date.now() }, ...without]);
  },
  remove(id: string): Result {
    return write(this.getSnapshot().filter((r) => r.report.id !== id));
  },
  /** Deletes every saved report. */
  clear(): Result {
    try { localStorage.removeItem(REPORTS_KEY); } catch { /* unavailable */ }
    cache = [];
    emit();
    return { ok: true };
  },
  /** Drops the in-memory cache (used after external storage changes and in tests). */
  invalidate() { cache = null; emit(); },
};

/** Removes every key this app owns from local storage. */
export function clearAllLocalData(): void {
  for (const k of LOCAL_DATA_KEYS) {
    try { localStorage.removeItem(k); } catch { /* unavailable */ }
  }
  reportStore.invalidate();
}

export function useReports(): StoredReport[] {
  return useSyncExternalStore(reportStore.subscribe, () => reportStore.getSnapshot());
}
