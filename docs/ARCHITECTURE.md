# Architecture

PC EXPOSED is a Tauri 2 desktop app: a small Rust core that *collects*, and a TypeScript
frontend that *analyzes and presents*. Business logic is independent of React.

```
src-tauri/                     Rust
  src/collect/                 read-only collectors (cpu, gpu, memory, storage, os,
                               startup, apps, battery, network, processes) + typed model
  src/export.rs                validated, user-confirmed saving of PNG and report JSON
  src/app_info.rs              build metadata
  capabilities/default.json    minimal window-only permissions
src/
  engine/                      pure, deterministic analysis (no React/Tauri/network)
    facts.ts                   ScanReport -> normalized Facts (missing data stays undefined)
    scoring.ts                 six explainable 0-100 category scores + overall
    bottleneck.ts              measured / potential / pairing / insufficient evidence
    personality.ts             12 personalities with explicit rules
    roast*.ts                  101 conditional roast lines + seeded selection
    wrapped.ts                 PC Wrapped data
    advice.ts                  Glow-Up Plan: what-if actions re-scored with scoreFacts()
  reports/                     report format v1, validator, local store, comparison,
                               opt-in scan history (history.ts)
  share/                       canvas card renderer (painter, templates, compare card)
  i18n/                        message catalog, locale registry, plurals, RTL
  lib/                         typed Tauri bridge, settings, formatting, updates, contrast
  screens/ components/ app/    UI and application state
docs/                          report format, security review, localization, accessibility
```

## Data flow

`run_scan` (Rust, background thread per collector) → `ScanReport` JSON (typed, versioned,
every metric a `Reading<T>` = available | unavailable-with-reason) → `analyze()` →
`Analysis` → screens, share cards, Wrapped, saved/exported `ReportV1` summaries.

Glow-Up Plan: `buildPlan(facts)` builds candidate actions, each a pure `Facts → Facts` change, and re-runs
`scoreFacts()` (the same function `analyze()` uses) on the changed facts. A projection therefore cannot drift
from the real scoring rules; a test asserts it for every action.

Scan history (opt-in, `Settings.keepHistory`): after a real (non-demo) scan, `state.tsx` stores
`buildReport(analysis, { now: scannedAtMs })` in `historyStore`, one entry per scan time, re-validated on
every read with the same validator as imported files.

The app version has one source: `package.json`, injected by Vite as `__APP_VERSION__` (`src/lib/version.ts`).

## Principles

1. **Never fabricate.** Unavailable is a distinct state from zero, end to end.
2. **Local only.** No network code. Results leave the device only through a user-chosen file.
3. **Least privilege.** The webview can do nothing but window controls; file writes go through
   validated native commands.
4. **Explainable.** Every score has reasons, confidence and a caveat; estimates are labelled.
5. **Testable.** The engine, validators and renderers are pure and covered by unit tests;
   the renderer audits itself for overflow, truncation and overlap.

## Update checks (architecture only)

`src/lib/updates.ts` defines an `UpdateProvider` seam and semver comparison. No provider is
configured, so the app never contacts a server. A release build may add one that runs only on
an explicit click; the CSP `connect-src` would then need that single host.

## Performance notes (debug build, this machine)

- Scan: ~320 ms. Startup to first content: ~620 ms.
- Bundles: main 389 kB (122 kB gzip); lazy chunks: radar chart 288 kB, share renderer 208 kB.
- Memory after a full tour: ~37 MB for the app process, ~540 MB across the 7-process
  WebView2 tree (WebView2's baseline dominates).
- Budgets enforced in tests: card render < 250 ms warm; analysis < 15 ms.
