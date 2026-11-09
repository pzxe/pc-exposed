import { useApp } from "@/app/state";
import { NeedsScan, Panel, ScreenHeader } from "@/components/ui";
import { PERSONALITIES } from "@/engine/personality";
import { iconFor } from "@/lib/icons";

export function Personality() {
  const { analysis } = useApp();
  if (!analysis) {
    return (
      <div className="animate-rise">
        <ScreenHeader title="PC Personality" subtitle="What your machine says about you." />
        <NeedsScan title="No personality yet" />
      </div>
    );
  }
  const { primary, runnersUp } = analysis.personality;
  const d = primary.def;
  const Icon = iconFor(d.icon);

  return (
    <div className="animate-rise space-y-4">
      <ScreenHeader title="PC Personality" subtitle="Assigned from your real scan findings, never at random." />
      <Panel className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -end-24 size-72 rounded-full blur-3xl" style={{ background: `${d.color}33` }} aria-hidden />
        <div className="relative flex items-start gap-6">
          <span className="rounded-2xl p-5" style={{ background: `${d.color}22`, color: d.color }}><Icon size={52} aria-hidden /></span>
          <div>
            <p className="text-xs tracking-widest text-muted">YOUR PC IS</p>
            <h2 className="font-display text-4xl font-bold" style={{ color: d.color }}>{d.title}</h2>
            <p className="mt-2 max-w-xl text-muted">{d.description}</p>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-4">
          <div>
            <h3 className="mb-1 text-sm font-semibold">Why this one</h3>
            <ul className="list-disc space-y-1 ps-5 text-sm text-muted">{primary.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Assignment rule</h3>
            <p className="text-sm text-muted">{d.conditions}</p>
            {runnersUp.length > 0 && <p className="mt-3 text-sm text-muted">Also close: {runnersUp.map((r) => r.def.title).join(", ")}.</p>}
          </div>
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-3 font-semibold">All {PERSONALITIES.length} personalities</h2>
        <ul className="grid grid-cols-3 gap-3">
          {PERSONALITIES.map((p) => {
            const I = iconFor(p.icon);
            const mine = p.id === d.id;
            return (
              <li key={p.id} className={`rounded-xl border p-3 text-sm ${mine ? "border-accent bg-surface-2" : "border-border/50"}`} aria-current={mine ? "true" : undefined}>
                <div className="mb-1 flex items-center gap-2 font-semibold" style={{ color: p.color }}><I size={16} aria-hidden /> {p.title}</div>
                <p className="text-xs text-muted">{p.conditions}</p>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
