import { useEffect, useMemo, useRef, useState } from "react";
import { Clipboard, Download, ShieldCheck } from "lucide-react";
import { useApp } from "@/app/state";
import { Button, NeedsScan, Panel, ScreenHeader } from "@/components/ui";
import { RadioGroup } from "@/components/RadioGroup";
import { buildCardData, sanitizeUsername } from "@/share/cardData";
import { canvasToPng, renderCard, suggestedFileName } from "@/share/render";
import { SIZES, TEMPLATES, type Format, type TemplateId } from "@/share/templates";
import type { RenderReport } from "@/share/painter";
import { savePng } from "@/lib/tauri";

const PREF_KEY = "pc-exposed.studio.v1";

interface Prefs { username: string; privacy: boolean; watermark: boolean }
const DEFAULT_PREFS: Prefs = { username: "", privacy: false, watermark: true };

function loadPrefs(): Prefs {
  try {
    const v = JSON.parse(localStorage.getItem(PREF_KEY) ?? "null") as Partial<Prefs> | null;
    return {
      username: typeof v?.username === "string" ? sanitizeUsername(v.username) : "",
      privacy: v?.privacy === true,
      watermark: v?.watermark !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function ShareStudio() {
  const { analysis, demo } = useApp();
  const [template, setTemplate] = useState<TemplateId>("identity");
  const [format, setFormat] = useState<Format>("portrait");
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [report, setReport] = useState<RenderReport | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  }, [prefs]);

  const data = useMemo(() => (analysis ? buildCardData(analysis, prefs, demo) : null), [analysis, prefs, demo]);

  // Render the real, full-resolution card; CSS scales it for the preview.
  useEffect(() => {
    if (!data || !canvas.current) return;
    let cancelled = false;
    void renderCard(canvas.current, template, format, data, () => !cancelled)
      .then((r) => { if (r && !cancelled) setReport(r); })
      .catch((e) => { if (!cancelled) setStatus({ kind: "error", text: String(e) }); });
    return () => { cancelled = true; };
  }, [data, template, format]);

  if (!analysis || !data) {
    return (
      <div className="animate-rise">
        <ScreenHeader title="Share Card Studio" subtitle="Export PNG cards of your results." />
        <NeedsScan title="No results to share yet" />
      </div>
    );
  }

  const size = SIZES[format];
  const issues = (report?.overflows.length ?? 0) + (report?.truncated.length ?? 0);

  const save = async () => {
    if (!canvas.current) return;
    setStatus(null);
    try {
      const path = await savePng(await canvasToPng(canvas.current), suggestedFileName(template, format));
      setStatus(path ? { kind: "ok", text: `Saved ${path}` } : { kind: "ok", text: "Save cancelled." });
    } catch (e) {
      setStatus({ kind: "error", text: `Could not save: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  const copy = async () => {
    if (!canvas.current) return;
    setStatus(null);
    try {
      const blob = await canvasToPng(canvas.current);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus({ kind: "ok", text: "Image copied to the clipboard." });
    } catch {
      setStatus({ kind: "error", text: "Copying images is not available here. Use Save PNG instead." });
    }
  };

  return (
    <div className="animate-rise">
      <div className="flex items-start justify-between gap-4">
        <ScreenHeader title="Share Card Studio" subtitle="Preview exactly what you'll export. Nothing is uploaded; you choose where it goes." />
        <div className="flex shrink-0 gap-2">
          <Button onClick={() => void save()}><Download size={16} aria-hidden /> Save PNG</Button>
          <Button variant="ghost" onClick={() => void copy()} aria-label="Copy image"><Clipboard size={16} aria-hidden /></Button>
        </div>
      </div>
      {status && <p role="status" className={`-mt-3 mb-4 text-xs break-all ${status.kind === "error" ? "text-bad" : "text-good"}`}>{status.text}</p>}
      <div className="grid grid-cols-[18rem_1fr] gap-5">
        <div className="space-y-4">
          <Panel className="p-4">
            <h2 className="mb-2 text-sm font-semibold">Template</h2>
            <RadioGroup<TemplateId> label="Template" value={template} onChange={setTemplate} className="space-y-1.5"
              options={TEMPLATES.map((t) => ({
                value: t.id,
                className: (on) => `w-full rounded-xl border px-3 py-2 text-start text-sm ${on ? "border-accent bg-surface-2" : "border-border/50 hover:bg-surface-2/50"}`,
                content: <><span className="block font-medium">{t.label}</span><span className="block text-xs text-muted">{t.blurb}</span></>,
              }))} />
            <h2 className="mt-4 mb-2 text-sm font-semibold">Format</h2>
            <RadioGroup<Format> label="Format" value={format} onChange={setFormat} className="grid grid-cols-2 gap-2"
              options={(["portrait", "landscape"] as const).map((f) => ({
                value: f,
                className: (on) => `rounded-xl border px-2 py-2 text-xs ${on ? "border-accent bg-surface-2" : "border-border/50"}`,
                content: <><span className="block font-medium capitalize">{f}</span><span className="text-muted">{SIZES[f].w}×{SIZES[f].h}</span></>,
              }))} />
          </Panel>

          <Panel className="p-4">
            <h2 className="mb-2 text-sm font-semibold">Options</h2>
            <label htmlFor="uname" className="mb-1 block text-xs text-muted">Username (optional)</label>
            <input id="uname" value={prefs.username} maxLength={40} placeholder="e.g. @yourname"
              onChange={(e) => setPrefs({ ...prefs, username: sanitizeUsername(e.target.value) })}
              className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm select-text disabled:opacity-50" disabled={prefs.privacy} />
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={prefs.privacy} onChange={(e) => setPrefs({ ...prefs, privacy: e.target.checked })} className="mt-1 accent-[#a879ff]" />
              <span>
                <span className="flex items-center gap-1 font-medium"><ShieldCheck size={14} aria-hidden /> Privacy mode</span>
                <span className="block text-xs text-muted">Hides the username, exact CPU/GPU models, app names and drive letters. Specs show as classes instead.</span>
              </span>
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={prefs.watermark} onChange={(e) => setPrefs({ ...prefs, watermark: e.target.checked })} className="accent-[#a879ff]" />
              Show “Made with PC EXPOSED”
            </label>
          </Panel>

        </div>

        <Panel className="flex min-w-0 flex-col items-center gap-3 p-4">
          <canvas ref={canvas} data-testid="card-canvas" aria-label={`${template} card preview, ${size.w} by ${size.h} pixels`}
            className="max-h-[68vh] max-w-full rounded-2xl border border-border/60 object-contain shadow-glow"
            style={{ aspectRatio: `${size.w} / ${size.h}`, width: format === "portrait" ? "auto" : "100%", height: format === "portrait" ? "68vh" : "auto" }} />
          <p className="text-xs text-muted" data-testid="render-info">
            {size.w}×{size.h} PNG{issues > 0 ? ` · ${issues} text-fit warning${issues === 1 ? "" : "s"}` : " · all text fits"}
          </p>
        </Panel>
      </div>
    </div>
  );
}
