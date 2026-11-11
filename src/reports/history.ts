/**
 * Scan history (opt-in, off by default). When the user turns it on, each real scan is
 * kept as a ReportV1 SUMMARY (hardware classes and scores; no process, startup-app or
 * installed-app names) in this app's own WebView storage. Nothing is transmitted.
 * Every read re-validates, so a corrupt or tampered entry is dropped instead of trusted.
 */
import { useSyncExternalStore } from "react";
import { validateReport, type ReportV1 } from "./format";

export const HISTORY_KEY = "pc-exposed.history.v1";
export const MAX_HISTORY = 60;

let cache: ReportV1[] | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): ReportV1[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: ReportV1[] = [];
    for (const item of arr.slice(-MAX_HISTORY * 2)) {
      const v = validateReport(item);
      if (v.ok) out.push(v.report);
    }
    return normalize(out);
  } catch {
    return [];
  }
}

/** Oldest first, one entry per scan time, capped (the oldest are dropped). */
function normalize(list: ReportV1[]): ReportV1[] {
  const byTime = new Map<number, ReportV1>();
  for (const r of list) byTime.set(r.createdAt, r);
  return [...byTime.values()].sort((a, b) => a.createdAt - b.createdAt).slice(-MAX_HISTORY);
}

function write(list: ReportV1[]): boolean {
  const next = normalize(list);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    return false; // storage full or unavailable: keep the in-memory state unchanged
  }
  cache = next;
  emit();
  return true;
}

export const historyStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  getSnapshot(): ReportV1[] { return (cache ??= read()); },
  list(): ReportV1[] { return this.getSnapshot(); },
  has(createdAt: number): boolean { return this.getSnapshot().some((r) => r.createdAt === createdAt); },
  /** Records a scan summary. A second record for the same scan time replaces the first. */
  add(report: ReportV1): boolean {
    return write([...this.getSnapshot().filter((r) => r.createdAt !== report.createdAt), report]);
  },
  remove(id: string): boolean { return write(this.getSnapshot().filter((r) => r.id !== id)); },
  clear(): void {
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* unavailable */ }
    cache = [];
    emit();
  },
  invalidate() { cache = null; emit(); },
};

export function useHistory(): ReportV1[] {
  return useSyncExternalStore(historyStore.subscribe, () => historyStore.getSnapshot());
}

/** The entry recorded before the given scan time (for "since last scan" deltas). */
export function entryBefore(list: ReportV1[], createdAt: number): ReportV1 | undefined {
  return [...list].reverse().find((r) => r.createdAt < createdAt);
}
