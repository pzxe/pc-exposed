import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useApp } from "@/app/state";
import { buildWrapped, type WrappedData } from "@/engine/wrapped";
import { iconFor } from "@/lib/icons";
import { ScoreRing } from "@/components/charts";

interface Slide { key: string; eyebrow: string; body: ReactNode; color?: string }

const Big = ({ children }: { children: ReactNode }) => <div className="font-display text-6xl leading-tight font-bold text-accent-soft">{children}</div>;
const Sub = ({ children }: { children: ReactNode }) => <p className="mx-auto mt-4 max-w-xl text-lg text-muted">{children}</p>;

/** Builds only the slides the scan can support (a missing RAM reading means no RAM slide). */
export function buildSlides(w: WrappedData): Slide[] {
  const PIcon = iconFor(w.personality.icon);
  const s: Slide[] = [
    { key: "intro", eyebrow: "PC WRAPPED", body: <><Big>Your PC, exposed.</Big><Sub>A recap of what this scan found. Everything stays on this device.</Sub></> },
    { key: "score", eyebrow: "YOUR PC SCORE", body: <><div className="flex justify-center"><ScoreRing score={w.score} size={240} /></div><Sub>{w.verdict} · {w.confidence} confidence</Sub></> },
    { key: "personality", eyebrow: "YOUR PC IS", color: w.personality.color, body: <>
      <div className="mb-4 flex justify-center" style={{ color: w.personality.color }}><PIcon size={72} aria-hidden /></div>
      <div className="font-display text-5xl font-bold" style={{ color: w.personality.color }}>{w.personality.title}</div><Sub>{w.personality.description}</Sub></> },
  ];
  if (w.strongest) s.push({ key: "strong", eyebrow: "STRONGEST AREA", body: <><Big>{w.strongest.label}</Big><Sub>{w.strongest.score}/100: the best part of this PC.</Sub></> });
  if (w.weakest) s.push({ key: "weak", eyebrow: "WEAKEST METRIC", body: <><Big>{w.weakest.label}</Big><Sub>{w.weakest.score}/100. {w.weakest.why}</Sub></> });
  if (w.startupEnabled !== undefined) s.push({ key: "startup", eyebrow: "STARTUP APPS", body: <><Big>{w.startupEnabled}</Big><Sub>{w.startupEnabled === 1 ? "app starts" : "apps start"} with Windows.</Sub></> });
  if (w.ramGb !== undefined) s.push({ key: "ram", eyebrow: "MEMORY", body: <><Big>{w.ramGb} GB</Big><Sub>of RAM installed.</Sub></> });
  if (w.cpu || w.gpu) s.push({ key: "chips", eyebrow: "THE ENGINE ROOM", body: <>
    {w.cpu && <div className="text-3xl font-semibold text-accent-soft">{w.cpu}</div>}{w.threads && <Sub>{w.threads} threads</Sub>}
    {w.gpu && <div className="mt-8 text-3xl font-semibold text-accent-soft">{w.gpu}</div>}{w.vramGb !== undefined && w.vramGb > 0 && <Sub>{Math.round(w.vramGb)} GB VRAM</Sub>}</> });
  if (w.storage?.drives !== undefined) s.push({ key: "storage", eyebrow: "STORAGE", body: <>
    <Big>{w.storage.drives} {w.storage.drives === 1 ? "drive" : "drives"}</Big>
    <Sub>{w.storage.totalTb ? `${w.storage.totalTb.toFixed(1)} TB in total` : ""}{w.storage.systemFreePercent !== undefined ? `${w.storage.totalTb ? " · " : ""}system drive ${Math.round(w.storage.systemFreePercent)}% free` : ""}</Sub></> });
  s.push({ key: "discovery", eyebrow: "MOST INTERESTING DISCOVERY", body: <><Big>{w.discovery.title}</Big><Sub>{w.discovery.text}</Sub></> });
  s.push({ key: "roast", eyebrow: "BEST ROAST", body: <div className="mx-auto max-w-2xl font-display text-4xl leading-snug font-semibold text-accent-soft">“{w.bestRoast}”</div> });
  s.push({ key: "verdict", eyebrow: "OVERALL VERDICT", body: <><Big>{w.verdict}</Big><Sub>{w.verdictLine}</Sub></> });
  return s;
}

export function Wrapped() {
  const { analysis, wrappedOpen, setWrappedOpen, demo } = useApp();
  const [i, setI] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const slides = useMemo(() => (analysis ? buildSlides(buildWrapped(analysis)) : []), [analysis]);

  // Focus management: remember what opened the dialog, move focus into it, and give it back on close.
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!wrappedOpen) return;
    opener.current = document.activeElement as HTMLElement | null;
    setI(0);
    dialog.current?.focus();
    return () => { opener.current?.focus?.(); };
  }, [wrappedOpen]);

  useEffect(() => {
    if (!wrappedOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const rtl = document.documentElement.dir === "rtl";
      const next = rtl ? "ArrowLeft" : "ArrowRight", prev = rtl ? "ArrowRight" : "ArrowLeft";
      // Space on a focused button already activates that button; advancing too would act twice.
      const onButton = e.target instanceof HTMLElement && e.target.closest("button") !== null;
      if (e.key === "Escape") setWrappedOpen(false);
      else if (e.key === next || (e.key === " " && !onButton)) { if (e.key === " ") e.preventDefault(); setI((n) => Math.min(n + 1, slides.length - 1)); }
      else if (e.key === prev) setI((n) => Math.max(n - 1, 0));
      else if (e.key === "Tab" && dialog.current) {
        // Trap Tab inside the dialog (WCAG 2.4.3): cycle through its enabled buttons.
        const items = Array.from(dialog.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
        if (items.length === 0) { e.preventDefault(); return; }
        const active = document.activeElement as HTMLElement | null;
        const idx = active ? items.indexOf(active) : -1;
        const nextIdx = e.shiftKey ? (idx <= 0 ? items.length - 1 : idx - 1) : (idx === items.length - 1 ? 0 : idx + 1);
        e.preventDefault();
        items[nextIdx].focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wrappedOpen, slides.length, setWrappedOpen]);

  if (!wrappedOpen || !analysis || slides.length === 0) return null;
  const slide = slides[Math.min(i, slides.length - 1)];

  return (
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="PC Wrapped"
      className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-md outline-none"
      style={{ backgroundImage: `radial-gradient(ellipse at 50% 20%, ${slide.color ?? "#a879ff"}26, transparent 60%)` }}>
      <div className="flex items-center gap-1.5 px-6 pt-5" aria-hidden>
        {slides.map((s, n) => <span key={s.key} className={`h-1 flex-1 rounded-full ${n <= i ? "bg-accent" : "bg-surface-3"}`} />)}
      </div>
      <button type="button" aria-label="Close PC Wrapped" onClick={() => setWrappedOpen(false)} className="absolute top-8 end-6 rounded-full p-2 text-muted hover:bg-surface hover:text-ink"><X size={20} /></button>
      {demo && <p className="mt-3 text-center text-xs text-warn">DEMO DATA (synthetic): not your PC</p>}

      <div key={slide.key} className="animate-rise flex flex-1 flex-col items-center justify-center px-12 text-center" aria-live="polite">
        <p className="mb-6 text-sm tracking-[0.35em] text-muted">{slide.eyebrow}</p>
        {slide.body}
      </div>

      <div className="flex items-center justify-between px-8 pb-8">
        <button type="button" aria-label="Previous slide" disabled={i === 0} onClick={() => setI(i - 1)} className="rounded-full border border-border p-3 text-muted hover:text-ink disabled:opacity-30"><ChevronLeft className="rtl:rotate-180" /></button>
        <span className="text-xs text-muted">{i + 1} / {slides.length}</span>
        <button type="button" aria-label="Next slide" disabled={i >= slides.length - 1} onClick={() => setI(i + 1)} className="rounded-full bg-accent p-3 text-bg hover:bg-accent-soft disabled:opacity-30"><ChevronRight className="rtl:rotate-180" /></button>
      </div>
    </div>
  );
}
