# Contributing to PC EXPOSED

Thanks for wanting to help! Bug reports, hardware-detection feedback (especially laptops, HDD
systems and Windows 10), roast lines, translations and code are all welcome.

By contributing you agree your work is released under the project's MIT License.

## Ground rules (these are the product)

1. **Never fabricate data.** A value that could not be read is `Unavailable` (with a reason), never
   `0`, never a guess. This holds from the Rust collectors to the UI.
2. **Local only.** No network access, telemetry, analytics or auto-updates. A PR that adds any must
   explain exactly why, and will almost certainly be declined.
3. **Read-only, no admin.** Collectors must not write to the system or need elevation.
4. **Explainable.** Every score has reasons and a caveat. Estimates are labelled as estimates; never
   claim a benchmark was run.
5. **Roast the PC, not the person.** Lines are short, original and tied to something the scan found.

## Getting set up

Requirements: Windows 10/11 x64, Node 22+, Rust (stable, MSVC toolchain), Visual Studio Build Tools
with the C++ workload, and the WebView2 runtime (preinstalled on Windows 11).

```powershell
npm ci
npm run tauri dev          # desktop app with hot reload
npm run dev                # browser-only UI preview at http://127.0.0.1:1420
```

In the browser preview, add `?demo=1` to the URL to load **clearly labelled synthetic data** (the
real scan only works in the desktop app). Demo code is compiled out of production builds.

## Before you open a PR

```powershell
npm run typecheck
npm test                   # unit tests (Vitest)
npm run test:e2e           # UI tests (Playwright + axe accessibility audit)
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test                 # includes a real scan of your machine
```

CI runs the same checks. See `.github/PULL_REQUEST_TEMPLATE.md`.

## Where things live

See `docs/ARCHITECTURE.md`. Quick map: collectors in `src-tauri/src/collect/`, analysis in
`src/engine/`, share cards in `src/share/`, reports in `src/reports/`, text in `src/i18n/`.

## Common contributions

- **A new roast line:** add an entry to `src/engine/roastLibrary.ts` with a `when` condition based on
  real facts. Tests check length (≤ 130 chars), no template leftovers, and that fact-specific lines
  only appear when the fact is true.
- **A hardware mis-classification:** GPU classes are parsed from model names in
  `src/engine/hardwareClass.ts`. Add the model and a test case. Don't use age or price.
- **A personality or rule change:** edit `src/engine/personality.ts`; every personality must stay
  reachable (a test enforces this) and every assignment needs a human-readable condition.
- **A translation:** see `docs/localization.md`. Use logical CSS classes (`ms-`, `text-start`, …); a test
  rejects `ml-`/`text-left`.
- **UI changes:** must pass the axe audit and keep text from clipping. The share-card renderer
  reports overflow, truncation and overlap, and tests fail if any occur.

## Tests are expected

New behaviour needs a test. Prefer testing real behaviour over mocks; the integration test runs the
actual collectors. If you change the scan model, update `src/lib/scanTypes.ts` (mirror of the Rust
model) and the privacy disclosure in `src/lib/privacyInfo.ts` (a test fails if they drift).

## Reporting security problems

Please don't open a public issue. See `SECURITY.md`.

## Conduct

Be kind and constructive. We follow the spirit of the Contributor Covenant: harassment and personal
attacks are not tolerated, and maintainers may remove content or contributors who engage in them.
