import { lazy, Suspense, useState } from "react";
import { History as HistoryIcon, Trash2 } from "lucide-react";
import { useApp } from "@/app/state";
import { Button, EmptyState, Panel, ScreenHeader } from "@/components/ui";
import { historyStore, useHistory } from "@/reports/history";
import type { ReportV1 } from "@/reports/format";
import { useI18n } from "@/i18n";

const HistoryChart = lazy(() => import("@/components/HistoryChart"));

interface Delta { label: string; text: string; tone: "good" | "bad" | "muted" }

/** What changed between two scans, in the direction that matters for each metric. */
export function deltasBetween(prev: ReportV1, cur: ReportV1): Delta[] {
  const out: Delta[] = [];
  const add = (label: string, a: number | undefined | null, b: number | undefined | null, unit: string, higherIsBetter: boolean, digits = 0) => {
    if (a === undefined || a === null || b === undefined || b === null) return;
    const d = Number((b - a).toFixed(digits));
    if (d === 0) return;
    const good = higherIsBetter ? d > 0 : d < 0;
    out.push({ label, text: `${d > 0 ? "+" : ""}${d}${unit}`, tone: good ? "good" : "bad" });
  };
  add("Score", prev.scores.overall, cur.scores.overall, "", true);
  add("Startup apps", prev.system.startupEnabled, cur.system.startupEnabled, "", false);
  add("System drive free", prev.system.storage?.systemFreePercent, cur.system.storage?.systemFreePercent, " pts", true);
  add("RAM", prev.system.ramGb, cur.system.ramGb, " GB", true);
  add("Installed apps", prev.system.appCount, cur.system.appCount, "", false);
  if (prev.personality?.id && cur.personality?.id && prev.personality.id !== cur.personality.id) {
    out.push({ label: "Personality", text: `${prev.personality.title} → ${cur.personality.title}`, tone: "muted" });
  }
  return out;
}

export function HistoryScreen() {
  const { settings, updateSettings } = useApp();
  const { formatDate } = useI18n();
  const entries = useHistory();
  const [confirm, setConfirm] = useState(false);
  const fmtShort = (ms: number) => formatDate(ms, { month: "short", day: "numeric" });
  const fmtLong = (ms: number) => formatDate(ms, { dateStyle: "medium", timeStyle: "short" });

  const header = <ScreenHeader title="History" subtitle="Your PC over time. Kept only on this device, and only if you turn it on." />;

  if (!settings.keepHistory && entries.length === 0) {
    return (
      <div className="animate-rise">
        {header}
        <EmptyState icon={HistoryIcon} title="Scan history is off"
          body="Turn it on to keep a small summary of each scan here (hardware classes and scores; no app or process names), so you can see whether your fixes worked.">
          <Button onClick={() => updateSettings({ keepHistory: true })}>Turn on history</Button>
        </EmptyState>
      </div>
    );
  }

  const newestFirst = [...entries].reverse();
  const scored = entries.filter((e) => e.scores.overall !== null);
  const first = scored[0], last = scored[scored.length - 1];

  return (
    <div className="animate-rise space-y-4">
      <div className="flex items-start justify-between gap-4">
        {header}
        <label className="mt-2 flex shrink-0 items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.keepHistory} onChange={(e) => updateSettings({ keepHistory: e.target.checked })} className="accent-[#a879ff]" />
          Record new scans
        </label>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="No scans recorded yet" body="History is on. Your next scan will appear here." />
      ) : (
        <>
          <Panel>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-semibold">Overall score</h2>
              {first && last && first !== last && (
                <span className="text-sm text-muted" data-testid="history-trend">
                  {last.scores.overall! - first.scores.overall! === 0 ? "Unchanged" : `${last.scores.overall! > first.scores.overall! ? "+" : ""}${last.scores.overall! - first.scores.overall!}`} since {fmtShort(first.createdAt)}
                </span>
              )}
            </div>
            {scored.length >= 2
              ? <Suspense fallback={<div className="h-56" />}><HistoryChart entries={entries} formatDate={fmtShort} /></Suspense>
              : <p className="py-6 text-center text-sm text-muted">The chart appears after your second scan.</p>}
          </Panel>

          <Panel>
            <h2 className="mb-3 font-semibold">Scans ({entries.length})</h2>
            <ol className="divide-y divide-border/40" data-testid="history-list">
              {newestFirst.map((r, i) => {
                const prev = newestFirst[i + 1];
                const deltas = prev ? deltasBetween(prev, r) : [];
                return (
                  <li key={r.id} className="flex items-start gap-4 py-3">
                    <span className="w-12 shrink-0 font-display text-2xl font-bold tabular-nums">{r.scores.overall ?? "—"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{fmtLong(r.createdAt)}{r.personality && <span className="text-muted"> · {r.personality.title}</span>}</div>
                      {deltas.length > 0 ? (
                        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {deltas.map((d) => (
                            <li key={d.label} className={d.tone === "good" ? "text-good" : d.tone === "bad" ? "text-bad" : "text-muted"}>{d.label} {d.text}</li>
                          ))}
                        </ul>
                      ) : <p className="mt-1 text-xs text-muted">{prev ? "No change from the scan before." : "First recorded scan."}</p>}
                    </div>
                    <button type="button" aria-label={`Delete the scan from ${fmtLong(r.createdAt)}`} onClick={() => historyStore.remove(r.id)}
                      className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-bad"><Trash2 size={14} /></button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex items-center gap-2">
              {!confirm
                ? <Button variant="ghost" onClick={() => setConfirm(true)}>Delete all history</Button>
                : <>
                    <span className="text-sm text-warn">Delete all {entries.length} recorded scans?</span>
                    <Button onClick={() => { historyStore.clear(); setConfirm(false); }}>Yes, delete</Button>
                    <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
                  </>}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
