import { useMemo } from "react";
import { ArrowRight, PartyPopper, ShoppingBag, Wrench } from "lucide-react";
import { useApp } from "@/app/state";
import { NeedsScan, Panel, ScreenHeader } from "@/components/ui";
import { buildPlan, type AdviceAction, type Effort } from "@/engine/advice";

const EFFORT: Record<Effort, { title: string; blurb: string; icon: typeof Wrench; chip: string }> = {
  free: { title: "Free fixes", blurb: "Settings and habits. No money, minutes of time.", icon: Wrench, chip: "border-good/50 text-good" },
  upgrade: { title: "Upgrades", blurb: "Hardware or software you would buy or install.", icon: ShoppingBag, chip: "border-warn/50 text-warn" },
};

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-accent/60 bg-surface-2" : "border-border/60"}`}>
      <div className="text-xs tracking-widest text-muted uppercase">{label}</div>
      <div className={`mt-1 font-display text-4xl font-bold tabular-nums ${accent ? "text-accent-soft" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-sm text-good">{sub}</div>}
    </div>
  );
}

function ActionCard({ a }: { a: AdviceAction }) {
  return (
    <li className="rounded-2xl border border-border/60 bg-surface-2/50 p-5" data-testid="plan-action">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-lg font-semibold">{a.title}</h3>
        <span className="shrink-0 rounded-full bg-good/15 px-3 py-1 text-sm font-semibold text-good tabular-nums" aria-label={`plus ${a.gain} points overall`}>
          +{a.gain}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">{a.why}</p>
      <p className="mt-3 text-sm"><span className="font-semibold">How: </span>{a.how}</p>
      {a.details.map((d, i) => <p key={i} className="mt-2 text-xs break-words text-muted">{d}</p>)}
      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Score changes">
        <li className="rounded-full border border-accent/50 px-2.5 py-0.5 text-xs text-accent-soft tabular-nums">Overall {a.before} → {a.after}</li>
        {a.changes.map((c) => (
          <li key={c.id} className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted tabular-nums">
            {c.label} {c.before ?? "—"} → {c.after ?? "—"}
          </li>
        ))}
      </ul>
      {a.caveat && <p className="mt-2 text-xs text-muted italic">{a.caveat}</p>}
    </li>
  );
}

export function Plan() {
  const { analysis, demo, go } = useApp();
  const plan = useMemo(() => (analysis ? buildPlan(analysis.facts) : null), [analysis]);

  if (!analysis || !plan) {
    return (
      <div className="animate-rise">
        <ScreenHeader title="Glow-Up Plan" subtitle="What would raise your score, and by how much." />
        <NeedsScan title="No plan yet" />
      </div>
    );
  }

  const header = <ScreenHeader title="Glow-Up Plan" subtitle="Concrete changes ranked by how much they would raise your score, using the same rules as the score itself." />;

  if (plan.current === null) {
    return (
      <div className="animate-rise">
        {header}
        <Panel className="py-12 text-center text-sm text-muted">This scan did not have enough data to score, so there is nothing to project.</Panel>
      </div>
    );
  }

  if (plan.actions.length === 0) {
    return (
      <div className="animate-rise space-y-4">
        {header}
        <Panel className="flex flex-col items-center gap-3 py-14 text-center">
          <PartyPopper size={36} className="text-accent" aria-hidden />
          <h2 className="font-display text-xl font-semibold">Nothing left to fix</h2>
          <p className="max-w-md text-sm text-muted">None of the changes this app knows about would raise your {plan.current}/100. Whatever is left is beyond what a read-only scan can judge.</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-4">
      {demo && <p className="rounded-xl border border-warn/50 p-2 text-center text-xs text-warn">DEMO DATA (synthetic): not your PC.</p>}
      {header}

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Score now" value={String(plan.current)} />
        <Stat label="With all free fixes" value={plan.allFree ? String(plan.allFree.after) : String(plan.current)} sub={plan.allFree ? `+${plan.allFree.gain} for free` : "No free fixes apply"} accent />
        <Stat label="With everything" value={plan.everything ? String(plan.everything.after) : String(plan.current)} sub={plan.everything ? `+${plan.everything.gain}` : undefined} />
      </div>

      {(["free", "upgrade"] as const).map((effort) => {
        const items = plan.actions.filter((a) => a.effort === effort);
        if (items.length === 0) return null;
        const E = EFFORT[effort];
        return (
          <Panel key={effort}>
            <div className="mb-4 flex items-center gap-3">
              <span className={`rounded-xl border p-2 ${E.chip}`}><E.icon size={18} aria-hidden /></span>
              <div>
                <h2 className="font-semibold">{E.title}</h2>
                <p className="text-xs text-muted">{E.blurb}</p>
              </div>
            </div>
            <ol className="space-y-3">{items.map((a) => <ActionCard key={a.id} a={a} />)}</ol>
          </Panel>
        );
      })}

      <p className="text-xs text-muted">
        Projections re-run the PC EXPOSED scoring rules on the changed numbers. They show how the score would move, not how
        fast games or apps would run. Combined gains are calculated together, so they are less than the individual gains added up.{" "}
        <button type="button" className="inline-flex items-center gap-1 text-accent underline" onClick={() => go("analysis")}>
          See the full analysis <ArrowRight size={12} className="rtl:rotate-180" aria-hidden />
        </button>
      </p>
    </div>
  );
}
