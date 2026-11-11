import { NAV } from "@/app/nav";
import { useApp } from "@/app/state";
import { useI18n } from "@/i18n";

export function Sidebar() {
  const { screen, go } = useApp();
  const { t } = useI18n();
  return (
    <nav aria-label={t("nav.label")} className="flex w-60 shrink-0 flex-col gap-0.5 border-e border-border/60 bg-bg p-3">
      {NAV.map(({ id, labelKey, icon: Icon }) => {
        const active = screen === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => go(id)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-start text-sm font-medium transition-colors ${
              active ? "bg-surface text-accent-soft shadow-glow" : "text-muted hover:bg-surface/60 hover:text-ink"
            }`}
          >
            <Icon size={18} aria-hidden />
            {t(labelKey)}
          </button>
        );
      })}
      <div className="mt-auto rounded-xl border border-border/60 p-3 text-xs leading-relaxed text-muted [@media(max-height:720px)]:hidden">
        {t("shell.localNote")}
      </div>
    </nav>
  );
}
