import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ScreenId } from "./nav";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "@/lib/settings";
import { clearAllLocalData } from "@/reports/store";
import { runScan } from "@/lib/tauri";
import type { ScanReport } from "@/lib/scanTypes";
import { analyze } from "@/engine/analyze";
import type { Facts } from "@/engine/facts";
import type { Analysis } from "@/engine/types";

export type FullAnalysis = Analysis & { facts: Facts };

interface AppState {
  screen: ScreenId;
  go: (s: ScreenId) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Latest real scan; null until one has run. Held in memory only. */
  scan: ScanReport | null;
  scanning: boolean;
  scanError: string | null;
  /** Runs a scan. Resolves when the scan finished (success or error). */
  startScan: () => Promise<void>;
  /** Analysis derived from `scan` (deterministic). */
  analysis: FullAnalysis | null;
  /** Picks a fresh set of roasts, avoiding ones already shown. */
  reroll: () => void;
  /** True only in the dev-only demo preview: the scan is synthetic. */
  demo: boolean;
  /** Deletes every locally stored item (reports, roast history, studio prefs, settings) and resets state. */
  resetAllLocalData: () => void;
  wrappedOpen: boolean;
  setWrappedOpen: (open: boolean) => void;
}

const Ctx = createContext<AppState | null>(null);
const RECENT_CAP = 40;
const ROASTS_KEY = "pc-exposed.roasts.v1";

/** Roast ids already shown, so re-rolls and later scans avoid repeats. Validated on read. */
function loadRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(ROASTS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,40}$/.test(x)).slice(-RECENT_CAP) : [];
  } catch {
    return [];
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, go] = useState<ScreenId>("home");
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [scan, setScan] = useState<ScanReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [round, setRound] = useState(0);
  const [recent, setRecent] = useState<string[]>(loadRecent);

  useEffect(() => {
    document.documentElement.dataset.motion = settings.motion;
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    try { localStorage.setItem(ROASTS_KEY, JSON.stringify(recent)); } catch { /* storage unavailable */ }
  }, [recent]);

  const resetAllLocalData = useCallback(() => {
    clearAllLocalData();
    setSettings(DEFAULT_SETTINGS);
    setRecent([]);
  }, []);

  const loadDemo = useCallback(async () => {
    // Dev-only: this branch is removed from production builds (import.meta.env.DEV is false there).
    if (import.meta.env.DEV) {
      const { makeScan } = await import("@/engine/testFixtures");
      setScan({
        ...makeScan({
          threads: 16, gpu: "NVIDIA GeForce RTX 4080", vramGb: 16, ramGb: 32, ramUsedPct: 52,
          startupEnabled: ["Discord", "Steam", "Spotify", "OneDrive", "Overwolf", "Updater", "Sync", "Helper", "Agent", "Tray", "Launcher", "Cloud", "Notifier", "Widget"], startupDisabled: 9,
          rgb: ["Corsair iCUE"], launchers: ["Steam", "Epic Games Launcher"], procs: ["chrome.exe", "Code.exe"],
          apps: 120, drives: [
            { mount: "C:\\", totalGb: 1000, freeGb: 420, kind: "ssd", system: true },
            { mount: "D:\\", totalGb: 2000, freeGb: 900, kind: "ssd" },
          ],
        }),
        scannedAtMs: Date.now(),
      });
      setDemo(true);
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo")) void loadDemo();
  }, [loadDemo]);

  const startScan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo")) {
        await loadDemo();
      } else {
        setScan(await runScan());
        setDemo(false);
      }
      setRound(0);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }, [loadDemo]);

  const analysis = useMemo<FullAnalysis | null>(
    () => (scan ? analyze(scan, { seed: scan.scannedAtMs + round * 7919, recentRoastIds: recent }) : null),
    // `recent` is intentionally read at reroll time only: changing it must come with a new round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scan, round],
  );

  const reroll = useCallback(() => {
    if (!analysis) return;
    const shown = [...Object.values(analysis.roasts.byCategory).map((r) => r!.id)];
    setRecent((r) => [...r, ...shown].slice(-RECENT_CAP));
    setRound((n) => n + 1);
  }, [analysis]);

  const value = useMemo<AppState>(
    () => ({
      screen, go, settings, updateSettings: (p) => setSettings((s) => ({ ...s, ...p })),
      scan, scanning, scanError, startScan, analysis, reroll, demo, wrappedOpen, setWrappedOpen, resetAllLocalData,
    }),
    [screen, settings, scan, scanning, scanError, startScan, analysis, reroll, demo, wrappedOpen, resetAllLocalData],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside <AppProvider>");
  return v;
}
