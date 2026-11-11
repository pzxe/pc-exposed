import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, PartyPopper, TrendingUp } from "lucide-react";
import { buildPlan } from "@/engine/advice";
import { useApp } from "@/app/state";
import { Button, NeedsScan, Panel, ScreenHeader } from "@/components/ui";
import { lazy, Suspense } from "react";
import { ScoreBar, ScoreRing } from "@/components/charts";

const CategoryRadar = lazy(() => import("@/components/CategoryRadar"));
import { iconFor } from "@/lib/icons";

export function Results() {
  const { analysis, demo, go, setWrappedOpen } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const plan = useMemo(() => (analysis ? buildPlan(analysis.facts) : null), [analysis]);

  if (!analysis) {
    return (
      <div className="animate-rise">
        <ScreenHeader title="PC Exposure" subtitle="Your score and verdict." />
        <NeedsScan title="No results yet" />
      </div>
    );
  }
  const { overall, categories, personality } = analysis;
  const p = personality.primary.def;
  const PIcon = iconFor(p.icon);

  return (
    <div className="animate-rise space-y-4">
      {demo && <p className="rounded-xl border border-warn/50 p-2 text-center text-xs text-warn">DEMO DATA (synthetic): not your PC.</p>}
      <div className="flex items-start justify-between">
        <ScreenHeader title="PC Exposure" subtitle="A transparent score: open any category to see exactly why." />
        <Button onClick={() => setWrappedOpen(true)}><PartyPopper size={16} aria-hidden /> Open PC Wrapped</Button>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-4">
        <Panel className="flex flex-col items-center gap-3">
          <ScoreRing score={overall.score} />
          <div className="font-display text-xl font-semibold">{overall.verdict}</div>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted" title="How much evidence backs this score">
            {overall.confidence} confidence
          </span>
        </Panel>
        <Panel>
          <button type="button" onClick={() => go("personality")} className="mb-3 flex items-center gap-3 text-start">
            <span className="rounded-xl p-2" style={{ background: `${p.color}22`, color: p.color }}><PIcon size={22} aria-hidden /></span>
            <span>
              <span className="block text-xs tracking-widest text-muted">YOUR PC IS</span>
              <span className="font-display text-lg font-bold" style={{ color: p.color }}>{p.title}</span>
            </span>
          </button>
          <Suspense fallback={<div className="h-64" />}>
            <CategoryRadar categories={categories} />
          </Suspense>
        </Panel>
      </div>

      <Panel>
        <h2 className="mb-3 font-semibold">Score breakdown</h2>
        <ul className="divide-y divide-border/40">
          {categories.map((c) => {
            const expanded = open === c.id;
            return (
              <li key={c.id} className="py-3">
                <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : c.id)} className="flex w-full items-center gap-4 text-start">
                  <span className="w-44 shrink-0 text-sm font-medium">{c.label}</span>
                  <span className="flex-1"><ScoreBar score={c.score} /></span>
                  <span className="w-16 text-end text-sm tabular-nums">{c.score === null ? "No score" : `${c.score}/100`}</span>
                  <ChevronDown size={16} aria-hidden className={`text-muted transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && (
                  <div className="animate-rise mt-3 ms-1 space-y-1.5 text-sm">
                    <p className="text-xs text-muted">Confidence: {c.confidence}</p>
                    {c.reasons.map((r, i) => (
                      <p key={i} className={r.impact === "negative" ? "text-bad" : r.impact === "positive" ? "text-good" : "text-muted"}>
                        {r.impact === "positive" ? "＋ " : r.impact === "negative" ? "－ " : "• "}{r.text}
                      </p>
                    ))}
                    {c.caveat && <p className="text-xs text-muted italic">{c.caveat}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {plan && plan.allFree && (
          <button type="button" onClick={() => go("plan")} data-testid="plan-teaser"
            className="mt-4 flex w-full items-center gap-3 rounded-xl border border-accent/50 bg-surface-2/60 px-4 py-3 text-start text-sm hover:bg-surface-2">
            <TrendingUp size={18} className="shrink-0 text-accent" aria-hidden />
            <span className="flex-1">Free fixes could take this to <strong className="text-accent-soft">{plan.allFree.after}/100</strong> (+{plan.allFree.gain}). See your Glow-Up Plan.</span>
            <ChevronRight size={16} className="text-muted rtl:rotate-180" aria-hidden />
          </button>
        )}
        {overall.reasons.some((r) => /excluded/.test(r.text)) && (
          <p className="mt-3 text-xs text-muted">{overall.reasons.find((r) => /excluded/.test(r.text))!.text}</p>
        )}
      </Panel>
    </div>
  );
}
