# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0-beta.1]: unreleased

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
