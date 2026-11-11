# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/).

## [0.2.0-beta.1]: 2026-11-11

PC EXPOSED now tells you what to do about what it finds, and can show your PC improving over time.
Release notes: [docs/releases/v0.2.0-beta.1.md](docs/releases/v0.2.0-beta.1.md).

### Added
- **Glow-Up Plan** (new screen): concrete changes ranked by how much they would raise your score, split into
  *free fixes* (trim startup apps, free system-drive space, restart, close memory-heavy apps, uninstall unused
  apps) and *upgrades* (RAM, SSD, Windows 11, a GPU one class up). Each shows the projected overall and
  per-category scores, how to do it, and its limits. Projections re-run the real scoring rules on the changed
  numbers, so they can never disagree with the score. Shows combined "all free fixes" and "everything" totals.
  PC Exposure links to it when free fixes would help.
- **Scan history** (new screen, opt-in, off by default): keeps a summary of each real scan on this device
  (up to 60) with a score-over-time chart and what changed between scans (score, startup apps, free space,
  RAM, apps, personality). Delete one scan or all of it. The Dashboard shows "Up N since your scan on …" and,
  after a restart, your last recorded scan.
- **Copy specs** on the Hardware screen: a plain-text spec sheet (CPU, GPU, RAM, storage, Windows, form factor)
  ready to paste into a forum or chat. No app, process or network names.
- New app icon (the PC EXPOSED eye), replacing the placeholder.

### Fixed
- Exported and saved reports recorded the version as `0.1.0-beta.1` forever; the version now comes from
  `package.json` at build time.
- Saved reports were dated by when you clicked *Save*, not when the scan ran, and saving the same scan twice
  created duplicates.
- PC Wrapped: pressing Space on a focused button both activated it and advanced the slide.
- Compare PCs: after a rejected import, choosing the same (fixed) file again did nothing.
- Share Studio: switching templates quickly could leave an older template painted on the preview.
- Laptop integrated GPUs such as *AMD Radeon(TM) 890M Graphics* and *Intel(R) Arc(TM) 140V GPU* were
  "not recognized", so Hardware Power and Gaming Readiness went unscored on those machines.
- Duplicate list keys when two adapters or processes shared a name.
- Every screen title showed a stray focus box after navigation.
- In the installed app, F5 / Ctrl+R reloaded the window and silently discarded the scan, and the browser's
  context menu (Back, Refresh, Print) appeared on right-click. Text fields keep their menu.

### Changed
- The sidebar is slightly more compact to fit 12 screens at the 1000×680 minimum window size; its privacy note
  hides on very short windows (the same promise is on the Dashboard and in Settings).
- Settings → Local data has the scan-history switch, and "Reset all local data" also deletes scan history.

### Security & privacy
- Scan history is opt-in and stores only the documented report summary (no startup-app, process or
  installed-app names); every entry is re-validated on read. Still no network code, and the CSP and webview
  permissions are unchanged.

### Known limitations
- Unchanged from 0.1.0-beta.1 (see below). Glow-Up Plan projections are score projections, not performance
  predictions, and the Windows 11 suggestion does not check eligibility.

## [0.1.0-beta.1]: 2026-11-09 (tagged; its GitHub release was left as a draft)

First public beta.

### Added
- **Local investigation** (Rust, read-only, no administrator rights): CPU, GPU (DXGI), RAM, storage,
  OS, startup apps, installed-app count, battery, network adapters and top processes. Missing data is
  reported as *Unavailable* with a reason, never as zero.
- **Deterministic analysis engine**: six explainable 0–100 scores with confidence and caveats;
  bottleneck findings kept apart as measured / potential / pairing / insufficient evidence.
- **12 PC personalities** assigned from real findings, and **101 conditional roast lines** with
  no-repeat selection.
- **PC Wrapped** story experience with keyboard navigation.
- **Share Card Studio**: five templates (Identity, Roast, Hardware Flex, Score, Wrapped) at 1080×1350 and
  1920×1080, optional username and watermark, Privacy mode, live preview, save via native dialog, copy to clipboard.
- **Compare PCs**: save scans locally, import/export a documented JSON report format with strict validation,
  compare two systems, and generate a comparison card.
- **Settings**: animation preference, language architecture (English; RTL-ready), "what is read" disclosure,
  local-data deletion, license information.
- Accessibility: skip link, focus management, focus-trapped dialog, accessible radio groups, WCAG 2.1 AA
  contrast, automated axe audit in CI.
- Windows x64 per-user installer (NSIS, no administrator rights needed), CI, and draft-release automation.

### Security & privacy
- No network code; restrictive CSP; webview has no filesystem, shell or dialog permission.
- Saving goes through validated native commands that require a user-chosen path.
- Imported reports are validated against a whitelist and never trusted or executed.

### Known limitations
- GPU utilization and temperature are not read (need vendor APIs); they show as *Unavailable*.
- Installers are not code-signed; Windows SmartScreen may warn.
- No MSI yet: the MSI format (WiX) rejects pre-release versions such as `beta.1`, so it is added with the first stable release.
- Only the English UI ships; some screens and all engine text (roasts, reasons) are English-only.
- Laptops, HDD systems and Windows 10 are covered by tests and fixtures but have had little real-hardware testing.
- The placeholder app icon is temporary.
- Not yet tested with a real screen reader (NVDA/Narrator) or Windows High Contrast mode.
