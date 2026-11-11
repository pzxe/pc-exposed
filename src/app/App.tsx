import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { AppProvider, useApp } from "./state";
import { NAV, type ScreenId } from "./nav";
import { TitleBar } from "@/components/TitleBar";
import { Sidebar } from "@/components/Sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScreenHeader } from "@/components/ui";
import { I18nProvider, useI18n } from "@/i18n";
import { inTauri } from "@/lib/tauri";
import { Home } from "@/screens/Home";
import { Hardware } from "@/screens/Hardware";
import { SettingsScreen } from "@/screens/Settings";
import { Investigation } from "@/screens/Investigation";
import { Results } from "@/screens/Results";
import { Personality } from "@/screens/Personality";
import { Analysis } from "@/screens/Analysis";
import { RoastScreen } from "@/screens/Roast";
import { Wrapped } from "@/screens/Wrapped";
import { Compare } from "@/screens/Compare";
import { Plan } from "@/screens/Plan";
import { HistoryScreen } from "@/screens/History";

// The Studio pulls in the canvas/icon renderer, so it loads on demand.
const ShareStudio = lazy(() => import("@/screens/ShareStudio").then((m) => ({ default: m.ShareStudio })));

const SCREENS: Record<ScreenId, () => ReactNode> = {
  home: () => <Home />,
  investigation: () => <Investigation />,
  results: () => <Results />,
  personality: () => <Personality />,
  hardware: () => <Hardware />,
  analysis: () => <Analysis />,
  plan: () => <Plan />,
  roast: () => <RoastScreen />,
  share: () => (
    <Suspense fallback={<ScreenHeader title="Share Card Studio" subtitle="Loading…" />}>
      <ShareStudio />
    </Suspense>
  ),
  compare: () => <Compare />,
  history: () => <HistoryScreen />,
  settings: () => <SettingsScreen />,
};

function Shell() {
  const { screen } = useApp();
  const { t } = useI18n();
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);

  // On navigation: update the window title and move focus to the new screen's heading so
  // keyboard and screen-reader users land at the top of the new content.
  // In the installed app, a webview reload (F5, Ctrl+R) would silently discard the scan, and the default
  // browser context menu (Back, Refresh, Print…) is meaningless here. Text fields keep their own menu.
  useEffect(() => {
    if (!inTauri() || import.meta.env.DEV) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && (k === "r" || k === "p"))) e.preventDefault();
    };
    const onMenu = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable='true']"))) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("contextmenu", onMenu);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("contextmenu", onMenu); };
  }, []);

  useEffect(() => {
    const label = t(NAV.find((n) => n.id === screen)!.labelKey);
    document.title = `${label} · PC EXPOSED`;
    if (first.current) { first.current = false; return; }
    const id = requestAnimationFrame(() => main.current?.querySelector<HTMLElement>("[data-screen-title]")?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [screen, t]);

  return (
    <div className="flex h-full flex-col bg-bg">
      <a href="#main" onClick={(e) => { e.preventDefault(); main.current?.focus(); }}
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-[60] focus:rounded-xl focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-bg">
        {t("shell.skipToContent")}
      </a>
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        {/* tabIndex 0: the scrollable region must be keyboard reachable (WCAG 2.1.1) */}
        <main id="main" ref={main} tabIndex={0} aria-label={t("shell.content")} className="min-w-0 flex-1 overflow-y-auto p-8 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset">
          {SCREENS[screen]()}
        </main>
      </div>
      <Wrapped />
    </div>
  );
}

function Localized() {
  const { settings } = useApp();
  return (
    <I18nProvider locale={settings.language}>
      <ErrorBoundary locale={settings.language}>
        <Shell />
      </ErrorBoundary>
    </I18nProvider>
  );
}

export function App() {
  return (
    <AppProvider>
      <Localized />
    </AppProvider>
  );
}
