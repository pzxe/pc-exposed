import { useState } from "react";
import { Copy, Flame, RefreshCw } from "lucide-react";
import { useApp } from "@/app/state";
import { Button, NeedsScan, Panel, ScreenHeader } from "@/components/ui";
import { ROAST_CATEGORIES } from "@/engine/roast";

const LABEL = { hardware: "Hardware", startup: "Startup", storage: "Storage", gaming: "Gaming", overall: "Overall" } as const;

export function RoastScreen() {
  const { analysis, reroll } = useApp();
  const [copied, setCopied] = useState(false);

  if (!analysis) {
    return (
      <div className="animate-rise">
        <ScreenHeader title="PC Roast" subtitle="Context-aware, hopefully funny." />
        <NeedsScan title="Nothing to roast yet" />
      </div>
    );
  }
  const { best, byCategory } = analysis.roasts;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${best.text}\n\n— PC EXPOSED`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="animate-rise space-y-4">
      <div className="flex items-start justify-between">
        <ScreenHeader title="PC Roast" subtitle="Every line is based on something found in your scan." />
        <Button variant="ghost" onClick={reroll}><RefreshCw size={16} aria-hidden /> Roast me again</Button>
      </div>

      <Panel className="relative overflow-hidden text-center">
        <Flame size={28} className="mx-auto mb-3 text-accent" aria-hidden />
        <p className="text-xs tracking-widest text-muted">BEST ROAST</p>
        <blockquote data-testid="best-roast" className="mx-auto mt-2 max-w-2xl font-display text-2xl leading-snug font-semibold text-accent-soft">“{best.text}”</blockquote>
        <Button variant="ghost" className="mt-5" onClick={copy}><Copy size={14} aria-hidden /> {copied ? "Copied" : "Copy text"}</Button>
      </Panel>

      <div className="grid grid-cols-2 gap-4">
        {ROAST_CATEGORIES.map((cat) => {
          const r = byCategory[cat];
          if (!r) return null;
          return (
            <Panel key={cat} className="p-5">
              <h2 className="mb-1 text-xs tracking-widest text-accent">{LABEL[cat].toUpperCase()} ROAST</h2>
              <p className="text-sm">{r.text}</p>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
