import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, FileUp, Save, Trash2 } from "lucide-react";
import { useApp } from "@/app/state";
import { Button, Panel, ScreenHeader } from "@/components/ui";
import { RadioGroup } from "@/components/RadioGroup";
import { anonymizeReport, buildReport, MAX_REPORT_BYTES, newReportId, parseReportFile, serializeReport, type ReportV1 } from "@/reports/format";
import { compareReports } from "@/reports/compare";
import { reportStore, useReports } from "@/reports/store";
import { drawCompareCard } from "@/share/compareCard";
import { SIZES, type Format } from "@/share/templates";
import { canvasToPng } from "@/share/png";
import { saveReportJson, savePng } from "@/lib/tauri";

const CURRENT_ID = "current-scan";
type Status = { kind: "ok" | "error"; text: string[] } | null;

export function Compare() {
  const { analysis, demo, go } = useApp();
  const stored = useReports();
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [privacy, setPrivacy] = useState(false);
  const [format, setFormat] = useState<Format>("landscape");
  const [warnings, setWarnings] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // The current scan is offered as a virtual entry; it is not stored until you save it.
  const current = useMemo<ReportV1 | null>(() => (analysis ? { ...buildReport(analysis, { label: "Current scan" }), id: CURRENT_ID } : null), [analysis]);
  const entries = useMemo(
    () => [...(current ? [{ report: current, source: "current" as const }] : []), ...stored.map((s) => ({ report: s.report, source: s.source }))],
    [current, stored],
  );
  const byId = (id: string | null) => entries.find((e) => e.report.id === id)?.report;
  const ra = byId(a), rb = byId(b);
  const cmp = useMemo(() => (ra && rb ? compareReports(ra, rb) : null), [ra, rb]);

  useEffect(() => {
    if (!ra || !rb || !canvas.current) return;
    try {
      const r = drawCompareCard(canvas.current, format, ra, rb, { privacy, watermark: true, demo });
      setWarnings(r.report.overflows.length + r.report.truncated.length);
    } catch (e) {
      setStatus({ kind: "error", text: [String(e)] });
    }
  }, [ra, rb, format, privacy, demo]);

  const pick = (id: string, side: "a" | "b") => {
    if (side === "a") { setA(id === a ? null : id); if (id === b) setB(null); }
    else { setB(id === b ? null : id); if (id === a) setA(null); }
  };

  const saveCurrent = () => {
    if (!analysis) return;
    const r = buildReport(analysis, { label: undefined });
    const res = reportStore.save(r, "local");
    setStatus(res.ok ? { kind: "ok", text: [`Saved “${r.label}” on this device.`] } : { kind: "error", text: [res.error] });
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_REPORT_BYTES) return setStatus({ kind: "error", text: ["That file is larger than 1 MB, so it is not a PC EXPOSED report."] });
    const parsed = parseReportFile(await file.text());
    if (!parsed.ok) return setStatus({ kind: "error", text: ["Import rejected:", ...parsed.errors] });
    // Always assign a fresh id so an import can never overwrite an existing report.
    const res = reportStore.save({ ...parsed.report, id: newReportId() }, "imported");
    setStatus(res.ok ? { kind: "ok", text: [`Imported “${parsed.report.label}”. It was validated and rebuilt from known fields only.`] } : { kind: "error", text: [res.error] });
    if (fileInput.current) fileInput.current.value = "";
  };

  const exportReport = async (r: ReportV1) => {
    try {
      const out = privacy ? anonymizeReport(r) : r;
      const path = await saveReportJson(serializeReport({ ...out, id: out.id === CURRENT_ID ? newReportId() : out.id }), `pc-exposed-report-${r.label}.json`);
      setStatus({ kind: "ok", text: [path ? `Exported to ${path}` : "Export cancelled."] });
    } catch (e) {
      setStatus({ kind: "error", text: [`Could not export: ${e instanceof Error ? e.message : String(e)}`] });
    }
  };

  const remove = (id: string) => {
    reportStore.remove(id);
    if (a === id) setA(null);
    if (b === id) setB(null);
  };

  const saveCard = async () => {
    if (!canvas.current) return;
    try {
      const path = await savePng(await canvasToPng(canvas.current), `pc-exposed-compare-${format}.png`);
      setStatus({ kind: "ok", text: [path ? `Saved ${path}` : "Save cancelled."] });
    } catch (e) {
      setStatus({ kind: "error", text: [`Could not save: ${e instanceof Error ? e.message : String(e)}`] });
    }
  };

  return (
    <div className="animate-rise space-y-4">
      <ScreenHeader title="Compare PCs" subtitle="Save scans on this device, import a friend's exported report, and compare two systems." />

      <div className="grid grid-cols-[22rem_1fr] gap-4">
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveCurrent} disabled={!analysis} className="px-3 py-2 text-xs"><Save size={14} aria-hidden /> Save current scan</Button>
              <Button variant="ghost" onClick={() => fileInput.current?.click()} className="px-3 py-2 text-xs"><FileUp size={14} aria-hidden /> Import report</Button>
              <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label="Import report file" data-testid="import-input"
                onChange={(e) => void importFile(e.target.files?.[0])} />
            </div>
            {!analysis && <p className="mt-2 text-xs text-muted">Run a scan to save it or compare it. <button type="button" className="text-accent underline" onClick={() => go("home")}>Go to Dashboard</button></p>}
            <label className="mt-3 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="accent-[#a879ff]" />
              Hide exact CPU/GPU models in exports and cards
            </label>
          </Panel>

          <Panel className="p-4">
            <h2 className="mb-2 text-sm font-semibold">Systems ({entries.length})</h2>
            {entries.length === 0 && <p className="text-xs text-muted">Nothing saved yet. Reports are stored only on this device.</p>}
            <ul className="space-y-2" data-testid="report-list">
              {entries.map(({ report: r, source }) => (
                <li key={r.id} className="rounded-xl border border-border/60 p-2.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium" title={r.label}>{r.label}</div>
                      <div className="text-xs text-muted">
                        {r.scores.overall === null ? "No score" : `${r.scores.overall}/100`} · {new Date(r.createdAt).toLocaleDateString()}
                        {source === "imported" && <span className="ms-1 rounded bg-surface-3 px-1.5 py-0.5">imported</span>}
                        {source === "current" && <span className="ms-1 rounded bg-surface-3 px-1.5 py-0.5">not saved</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {source !== "current" && <button type="button" aria-label={`Delete ${r.label}`} onClick={() => remove(r.id)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-bad"><Trash2 size={14} /></button>}
                      <button type="button" aria-label={`Export ${r.label}`} onClick={() => void exportReport(r)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink"><Download size={14} /></button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["a", "b"] as const).map((side) => {
                      const on = (side === "a" ? a : b) === r.id;
                      return (
                        <button key={side} type="button" aria-pressed={on} aria-label={`Use ${r.label} as PC ${side.toUpperCase()}`} onClick={() => pick(r.id, side)}
                          className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1 text-xs ${on ? "border-accent bg-surface-2 text-accent-soft" : "border-border/60 text-muted"}`}>
                          {on && <Check size={12} aria-hidden />} PC {side.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
          {status && (
            <div role="status" className={`rounded-xl border p-3 text-xs break-words ${status.kind === "error" ? "border-bad/50 text-bad" : "border-good/40 text-good"}`}>
              {status.text.map((t, i) => <p key={i}>{t}</p>)}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {!cmp || !ra || !rb ? (
            <Panel className="py-16 text-center text-sm text-muted">Choose a PC A and a PC B from the list to compare them.</Panel>
          ) : (
            <>
              <Panel>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-display text-xl font-semibold" data-testid="compare-summary">{cmp.summary}</h2>
                  <span className="text-xs text-muted">{cmp.aWins} – {cmp.bWins}{cmp.ties ? ` · ${cmp.ties} tied` : ""}</span>
                </div>
                <table className="w-full text-sm" data-testid="compare-table">
                  <thead>
                    <tr className="text-start text-xs text-muted">
                      <th className="pb-2 font-normal"> </th>
                      <th className="pb-2 font-normal">A · {ra.label}</th>
                      <th className="pb-2 font-normal">B · {rb.label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cmp.rows.map((r) => (
                      <tr key={r.id} className="border-t border-border/40" title={r.basis}>
                        <th scope="row" className="py-2 pe-3 text-start font-medium">{r.label}</th>
                        <td className={`py-2 pe-3 ${r.winner === "a" ? "font-semibold text-accent-soft" : "text-muted"}`}>{r.winner === "a" && "✓ "}{r.a}</td>
                        <td className={`py-2 ${r.winner === "b" ? "font-semibold text-accent-soft" : "text-muted"}`}>{r.winner === "b" && "✓ "}{r.b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-muted">Hover a row to see how the winner was decided. CPU and GPU rows are estimates from specs, not benchmarks.</p>
              </Panel>

              <Panel className="flex flex-col items-center gap-3">
                <div className="flex w-full items-center justify-between">
                  <RadioGroup<Format> label="Comparison card format" value={format} onChange={setFormat} className="flex gap-2"
                    options={(["landscape", "portrait"] as const).map((f) => ({
                      value: f,
                      className: (on) => `rounded-xl border px-3 py-1.5 text-xs ${on ? "border-accent bg-surface-2" : "border-border/50 text-muted"}`,
                      content: <><span className="capitalize">{f}</span> {SIZES[f].w}×{SIZES[f].h}</>,
                    }))} />
                  <Button onClick={() => void saveCard()} className="px-4 py-2 text-xs"><Download size={14} aria-hidden /> Save comparison PNG</Button>
                </div>
                <canvas ref={canvas} data-testid="compare-canvas" aria-label="Comparison card preview"
                  className="max-w-full rounded-2xl border border-border/60"
                  style={{ aspectRatio: `${SIZES[format].w} / ${SIZES[format].h}`, width: format === "portrait" ? "auto" : "100%", height: format === "portrait" ? "60vh" : "auto" }} />
                <p className="text-xs text-muted" data-testid="compare-render-info">{SIZES[format].w}×{SIZES[format].h} PNG{warnings ? ` · ${warnings} text-fit warning${warnings === 1 ? "" : "s"}` : " · all text fits"}</p>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
