import { getCurrentWindow } from "@tauri-apps/api/window";
import { inTauri } from "@/lib/tauri";
import { useI18n, type MessageKey } from "@/i18n";

const dots: { id: string; key: MessageKey; color: string; act: () => Promise<void> }[] = [
  { id: "close", key: "window.close", color: "#ff5f57", act: () => getCurrentWindow().close() },
  { id: "minimize", key: "window.minimize", color: "#febc2e", act: () => getCurrentWindow().minimize() },
  { id: "maximize", key: "window.maximize", color: "#28c840", act: () => getCurrentWindow().toggleMaximize() },
];

/**
 * Custom title bar. Uses Tauri's native drag region and window APIs, so Windows
 * snapping and double-click-to-maximize keep working. The three controls keep
 * macOS-style placement in every language (they are window chrome, not content),
 * and each has a 24px hit target around its 12px dot.
 */
export function TitleBar() {
  const native = inTauri();
  const { t } = useI18n();
  return (
    <header
      data-tauri-drag-region
      dir="ltr"
      className="relative flex h-11 shrink-0 items-center border-b border-border/60 bg-bg px-2.5"
    >
      <div className="flex items-center">
        {dots.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-label={t(d.key)}
            title={t(d.key)}
            disabled={!native}
            onClick={() => void d.act()}
            className="group grid size-6 place-items-center rounded-full disabled:opacity-40"
          >
            <span className="size-3 rounded-full transition-transform group-hover:scale-125" style={{ background: d.color }} />
          </button>
        ))}
      </div>
      <div
        data-tauri-drag-region
        className="pointer-events-none absolute inset-x-0 text-center text-xs font-semibold tracking-[0.3em] text-muted"
      >
        PC EXPOSED
      </div>
    </header>
  );
}
