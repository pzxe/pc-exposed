import { Eye, Lock, Cpu, Share2 } from "lucide-react";
import { useApp } from "@/app/state";
import { Button, Panel, ScreenHeader } from "@/components/ui";
import { ScoreRing } from "@/components/charts";
import { useI18n, type MessageKey } from "@/i18n";
import { iconFor } from "@/lib/icons";

const pillars: { icon: typeof Lock; title: MessageKey; text: MessageKey }[] = [
  { icon: Lock, title: "home.pillar.local.title", text: "home.pillar.local.text" },
  { icon: Cpu, title: "home.pillar.real.title", text: "home.pillar.real.text" },
  { icon: Share2, title: "home.pillar.share.title", text: "home.pillar.share.text" },
];

export function Home() {
  const { go, startScan, scanning, analysis, demo } = useApp();
  const { t } = useI18n();
  const last = analysis && analysis.overall.score !== null ? analysis : null;
  const p = last?.personality.primary.def;
  const PIcon = p ? iconFor(p.icon) : null;

  return (
    <div className="animate-rise">
      <ScreenHeader title={t("home.title")} subtitle={t("home.subtitle")} />
      <Panel className="flex flex-col items-center gap-5 py-14 text-center">
        <div className="animate-pulse-ring rounded-full bg-accent/15 p-6">
          <Eye size={48} className="text-accent" aria-hidden />
        </div>
        <Button className="px-10 py-4 text-base tracking-widest" disabled={scanning} onClick={() => { go("investigation"); void startScan(); }}>
          {t("common.exposeMyPc")}
        </Button>
        <p className="max-w-md text-sm text-muted">{t("home.scanNote")}</p>
      </Panel>

      {last && p && PIcon && (
        <Panel className="mt-6 flex items-center gap-6">
          <ScoreRing score={last.overall.score} size={112} label=" " />
          <div className="min-w-0 flex-1">
            <h2 className="text-xs tracking-widest text-muted uppercase">{t("home.last.title")}</h2>
            <div className="mt-1 flex items-center gap-2 font-display text-xl font-bold" style={{ color: p.color }}>
              <PIcon size={20} aria-hidden /> {p.title}
            </div>
            <p className="text-sm text-muted">{t("home.last.score", { score: last.overall.score as number, verdict: last.overall.verdict })}</p>
            {demo && <p className="mt-1 text-xs text-warn">{t("home.last.demo")}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onClick={() => go("results")}>{t("home.last.results")}</Button>
            <Button variant="ghost" onClick={() => go("share")}>{t("home.last.share")}</Button>
          </div>
        </Panel>
      )}

      <div className="mt-6 grid grid-cols-3 gap-4">
        {pillars.map(({ icon: Icon, title, text }) => (
          <Panel key={title} className="p-5">
            <Icon size={20} className="mb-3 text-accent" aria-hidden />
            <h3 className="font-semibold">{t(title)}</h3>
            <p className="mt-1 text-sm text-muted">{t(text)}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
