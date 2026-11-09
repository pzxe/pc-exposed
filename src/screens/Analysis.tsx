import { useApp } from "@/app/state";
import { NeedsScan, Panel, ScreenHeader } from "@/components/ui";
import type { BottleneckKind } from "@/engine/types";

const KIND: Record<BottleneckKind, { title: string; blurb: string; tone: string }> = {
  measured: { title: "Measured", blurb: "Observed during this scan.", tone: "text-bad" },
  potential: { title: "Potential", blurb: "Plausible from your specs. Not observed.", tone: "text-warn" },
  pairing: { title: "Hardware pairing", blurb: "How your CPU and GPU classes relate. Not a benchmark.", tone: "text-accent" },
  insufficient: { title: "Insufficient evidence", blurb: "Things this scan could not determine.", tone: "text-muted" },
};
const ORDER: BottleneckKind[] = ["measured", "potential", "pairing", "insufficient"];

export function Analysis() {
  const { analysis } = useApp();
  if (!analysis) {
    return (
      <div className="animate-rise">
        <ScreenHeader title="System Analysis" subtitle="Evidence-based findings." />
        <NeedsScan title="No analysis yet" />
      </div>
    );
  }
  return (
    <div className="animate-rise space-y-4">
      <ScreenHeader title="System Analysis" subtitle="Every finding is labelled by how much evidence stands behind it." />
      <p className="rounded-xl border border-border/60 p-3 text-xs text-muted">{analysis.benchmarkNotice}</p>

      <div className="grid grid-cols-2 gap-4">
        {analysis.categories.map((c) => (
          <Panel key={c.id} className="p-5">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-semibold">{c.label}</h2>
              <span className="text-sm tabular-nums text-muted">{c.score === null ? "No score" : `${c.score}/100`} · {c.confidence}</span>
            </div>
            <ul className="space-y-1 text-sm">
              {c.reasons.map((r, i) => (
                <li key={i} className={r.impact === "negative" ? "text-bad" : r.impact === "positive" ? "text-good" : "text-muted"}>{r.text}</li>
              ))}
            </ul>
            {c.caveat && <p className="mt-2 text-xs text-muted italic">{c.caveat}</p>}
          </Panel>
        ))}
      </div>

      <Panel>
        <h2 className="mb-1 font-semibold">Bottleneck analysis</h2>
        <p className="mb-4 text-sm text-muted">Four kinds of finding, kept strictly apart.</p>
        <div className="space-y-5">
          {ORDER.map((k) => {
            const items = analysis.bottlenecks.filter((b) => b.kind === k);
            return (
              <section key={k} aria-label={KIND[k].title}>
                <h3 className={`text-sm font-semibold ${KIND[k].tone}`}>{KIND[k].title} <span className="font-normal text-muted">· {KIND[k].blurb}</span></h3>
                {items.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">{k === "measured" ? "Nothing concerning was measured." : "None."}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {items.map((b, i) => (
                      <li key={i} className="rounded-xl bg-surface-2/60 p-3 text-sm">
                        <div className="font-medium">{b.title} <span className="text-xs text-muted">({b.confidence} confidence)</span></div>
                        <p className="text-muted">{b.detail}</p>
                        <p className="mt-1 text-xs text-muted">Evidence: {b.evidence.join(" · ")}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
