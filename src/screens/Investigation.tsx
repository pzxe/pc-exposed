import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleSlash, ScanSearch } from "lucide-react";
import { useApp } from "@/app/state";
import { Button, Panel, ScreenHeader } from "@/components/ui";
import { buildDiscoveries } from "@/lib/discoveries";

const STEP_MS = 420;

/** Reduced motion if the user setting says so, or the OS does and the setting follows the system. */
function useReducedMotion(pref: "system" | "on" | "off"): boolean {
  if (pref === "off") return true;
  if (pref === "on") return false;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Remember which scan has already been "played", so revisiting the tab doesn't replay it.
let lastPlayedScan: number | null = null;

export function Investigation() {
  const { scan, scanning, scanError, startScan, go, settings, demo } = useApp();
  const reduced = useReducedMotion(settings.motion);
  const items = useMemo(() => (scan ? buildDiscoveries(scan) : []), [scan]);
  const alreadyPlayed = scan !== null && lastPlayedScan === scan.scannedAtMs;
  const [shown, setShown] = useState(alreadyPlayed || reduced ? items.length : 0);
  const done = scan !== null && shown >= items.length;
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!scan) return;
    if (lastPlayedScan === scan.scannedAtMs || reduced) {
      setShown(items.length);
      lastPlayedScan = scan.scannedAtMs;
      return;
    }
    setShown(0);
    timer.current = window.setInterval(() => {
      setShown((n) => {
        if (n + 1 >= items.length) window.clearInterval(timer.current);
        return Math.min(n + 1, items.length);
      });
    }, STEP_MS);
    return () => window.clearInterval(timer.current);
  }, [scan, items.length, reduced]);

  useEffect(() => {
    if (done && scan) lastPlayedScan = scan.scannedAtMs;
  }, [done, scan]);

  const skip = () => {
    window.clearInterval(timer.current);
    setShown(items.length);
  };

  return (
    <div className="animate-rise">
      <ScreenHeader title="Investigation" subtitle="Your PC, examined locally and read-only." />

      {!scan && !scanning && !scanError && (
        <Panel className="flex flex-col items-center gap-4 py-16 text-center">
          <ScanSearch size={36} className="text-accent" aria-hidden />
          <p className="max-w-md text-sm text-muted">No scan has been run yet. The investigation reads hardware and system settings only: no documents, passwords or browser data.</p>
          <Button onClick={() => void startScan()}>EXPOSE MY PC</Button>
        </Panel>
      )}

      {scanning && (
        <Panel className="flex flex-col items-center gap-4 py-16 text-center" aria-live="polite">
          <div className="animate-pulse-ring rounded-full bg-accent/15 p-5"><ScanSearch size={40} className="text-accent" aria-hidden /></div>
          <p className="font-display text-lg">Investigating your PC…</p>
        </Panel>
      )}

      {scanError && !scanning && (
        <Panel className="border-bad/40">
          <p role="alert" className="flex items-center gap-2 text-sm text-bad"><AlertTriangle size={16} aria-hidden /> {scanError}</p>
          <Button variant="ghost" className="mt-4" onClick={() => void startScan()}>Try again</Button>
        </Panel>
      )}

      {scan && !scanning && (
        <Panel>
          <p className="mb-4 text-xs text-muted">
            {demo ? "DEMO DATA (synthetic, not your PC). " : ""}
            Scan finished in {scan.scanDurationMs} ms. The findings below are replayed one at a time so you can follow along.
          </p>
          <ol className="space-y-2" aria-live="polite">
            {items.slice(0, shown).map((d) => (
              <li key={d.id} className="animate-rise flex items-start gap-3 rounded-xl bg-surface-2/60 px-4 py-3">
                {d.status === "found"
                  ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-good" aria-label="found" />
                  : <CircleSlash size={18} className="mt-0.5 shrink-0 text-muted" aria-label="unavailable" />}
                <div className="min-w-0">
                  <div className="text-xs tracking-wide text-muted uppercase">{d.label}</div>
                  <div className={`text-sm ${d.status === "unavailable" ? "italic text-muted" : ""}`}>
                    {d.status === "unavailable" ? `Unavailable: ${d.text}` : d.text}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {scan.issues.length > 0 && done && (
            <p className="mt-4 text-xs text-warn">{scan.issues.length} collection issue{scan.issues.length === 1 ? "" : "s"} were reported. See Hardware for details.</p>
          )}
          <div className="mt-6 flex gap-3">
            {done
              ? <Button onClick={() => go("results")}>SEE MY RESULTS</Button>
              : <Button variant="ghost" onClick={skip}>Skip animation</Button>}
            {done && <Button variant="ghost" onClick={() => void startScan()}>Scan again</Button>}
          </div>
        </Panel>
      )}
    </div>
  );
}
