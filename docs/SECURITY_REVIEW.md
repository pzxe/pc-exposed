# Security & privacy review: v0.1.0-beta.1 (Checkpoint G)

Scope: the desktop app (Tauri 2 shell, Rust native core, React frontend). This is a
self-review with automated evidence, not an independent audit.

## Threat model

| Asset | Threat | Mitigation |
|---|---|---|
| User's system data | Exfiltration (telemetry, uploads, remote calls) | No network code; CSP blocks all external origins |
| User's files | Read or write by a compromised webview | Webview has no filesystem, shell or dialog permission |
| App integrity | Malicious imported report (XSS, prototype pollution, DoS) | Whitelist validator, size/range limits, plain-text rendering |
| Local storage | Tampered saved reports | Every read re-validates; bad entries are dropped |
| Exported images/files | Writing arbitrary data to disk | Native commands validate content, force extension, require a user-chosen path |

## Findings and evidence

### 1. No network access: verified three ways
- **Dependency graph:** `cargo tree -i reqwest` and `-i hyper` find nothing in the Windows build graph; no HTTP client crate is compiled in.
- **Source scan:** a unit test (`quality.test.tsx`) fails if app code contains `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`, analytics SDK names, or remote absolute URLs. The detector is itself tested against known-bad samples.
- **Runtime:** in the real app, an attempted `fetch("https://example.com")` is blocked with a `connect-src` CSP violation, and an injected inline `<script>` is blocked with `script-src-elem`.

### 2. Content Security Policy (tightened in this checkpoint)
```
default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline';
img-src 'self' data:; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost;
object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none';
frame-ancestors 'none'; worker-src 'none'; manifest-src 'none'
```
- Removed `'unsafe-inline'` from `style-src` (kept only for style *attributes*, which React's `style={}` needs). Removed `blob:` from `img-src`.
- Added `form-action`, `frame-src`, `worker-src`, `manifest-src`.
- Verified in the running app: no CSP violations from normal use across all screens.

### 3. Capability policy
`src-tauri/capabilities/default.json` grants only: `core:window` minimize, toggle-maximize,
close, start-dragging, is-maximized, and `core:event` listen/unlisten. Verified at runtime:
`plugin:fs|write_file` and `plugin:shell|execute` are "not allowed. Plugin not found", and
`plugin:dialog|save` is denied to the webview. Saving works only through the app's own
`save_share_image` / `save_report_file` commands, which:
1. require raw bytes (JSON bodies are rejected),
2. validate content (PNG signature and 16 MB limit, or JSON tagged `pc-exposed-report` and 1 MB limit),
3. open the OS Save dialog themselves, and
4. write only to the path the user chose, with the extension forced.

### 4. Imported report handling
Documented in `docs/report-format.md`. Tested with: wrong types, out-of-range values,
oversize files, bad versions, duplicate categories, `__proto__`/`constructor` payloads,
HTML/script strings in labels, bidi-override characters, and 1500 random mutations of a
valid report (no crash; anything accepted is within bounds). A static test forbids
`dangerouslySetInnerHTML`, `innerHTML =`, `eval(` and `new Function(` in app code.

### 5. Native collectors
Read-only; no administrator rights; no writes. Registry access uses read-only opens.
Deliberately not collected: MAC/IP addresses, startup command lines, process command
lines/paths, window titles, file contents, the full installed-app list (only a fixed
allowlist of well-known RGB and launcher names is exported, as canonical names).

### 6. Dependencies and licenses
- `npm audit`: 0 vulnerabilities (46 production packages: MIT, ISC, BSD-3-Clause, Apache-2.0).
- Rust: 267 crates in the Windows build graph. No GPL/AGPL/unknown licenses. Five MPL-2.0
  crates (`cssparser`, `cssparser-macros`, `selectors`, `dtoa-short`, `option-ext`) are
  file-level copyleft, used unmodified, and compatible with MIT distribution.

## Decision recorded: `freezePrototype` is NOT enabled
Tauri's `freezePrototype` option was tried and **broke the Results screen in the real app**
(Recharts assigns `valueOf` on plain objects, which fails once `Object.prototype` is
frozen). It was removed. Prototype pollution is instead addressed at the data boundary
(whitelist validator, tested) and by never merging untrusted objects.

## Known gaps and open items
- **`cargo audit` was not run.** Installing it requires `cargo install` of a third-party tool, which was not approved in this session. Run `cargo install cargo-audit && cargo audit` (or enable `cargo-deny`/Dependabot in CI) before release.
- **`eval` under CSP was not proven at runtime.** Code evaluated through DevTools is exempt from CSP, so that probe is inconclusive. The policy has no `unsafe-eval` (so the browser blocks it per spec), and source is statically scanned for `eval`/`new Function`.
- **Not independently audited**; no fuzzing of the Rust collectors beyond unit/integration tests.
- **Installers are unsigned** until Checkpoint H/release; Windows SmartScreen will warn.
- **WebView2 runtime** is a system component; its own security updates come from Windows/Edge.

## v0.2.0-beta.1 delta review

What changed in the attack surface, and why it is acceptable:

- **No new permissions, commands or network code.** The CSP, `capabilities/default.json` and the Rust command
  list are unchanged (guarded by `src/app/release.test.ts`); the static no-network scan covers the new files.
- **New stored data: scan history** (`pc-exposed.history.v1`). Opt-in, off by default. It stores the same
  `ReportV1` summary as a saved report (no process, startup-app or installed-app names; asserted by
  `src/reports/history.test.ts`), capped at 60, and every entry is re-validated on read with the import
  validator, so tampered storage is dropped rather than trusted. "Reset all local data" deletes it.
- **Clipboard write (Copy specs).** User-initiated only; contains hardware facts and drive letters, no names
  of apps, processes or adapters' addresses.
- **Webview hardening.** In the installed app, reload shortcuts and the browser context menu are suppressed
  (they could discard state and expose browser-only actions such as Print). Text fields keep their menu.
- **Dependencies:** none added. `npm audit --omit=dev` and `cargo audit` results are recorded in the release PR.
