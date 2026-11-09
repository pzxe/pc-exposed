# Releasing PC EXPOSED

Releases are **drafted by automation and published by a human**. Nothing is published, tagged,
or pushed by any script or by an AI assistant without explicit maintainer action.

Versioning: [Semantic Versioning](https://semver.org/). The first release is `0.1.0-beta.1`.
Pre-release versions (anything with a `-`) are marked *pre-release* on GitHub automatically.

## One-time setup (maintainer)

1. Create the GitHub repository (suggested name: `pc-exposed`; description: *Expose your PC. Discover its
   personality, uncover its secrets, and roast your hardware.*).
2. Settings → Actions → General: allow workflows; "Read and write permissions" for `GITHUB_TOKEN`
   (the release workflow requests `contents: write` itself).
3. Settings → Code security: enable *Private vulnerability reporting*, Dependabot alerts and updates.
4. Optional but recommended before a stable release: code-signing certificate (see below).

## Cutting a release

1. **Pick the version** and update it in all three places (a test fails if they disagree):
   - `package.json` → `version`
   - `src-tauri/Cargo.toml` → `version` (then run `cargo check` so `Cargo.lock` follows)
   - `src-tauri/tauri.conf.json` → `version`
2. **Update `CHANGELOG.md`**: rename `unreleased` to the release date and make sure it describes the changes.
3. **Regenerate third-party licenses** if dependencies changed: `node scripts/generate-licenses.mjs`.
4. **Run the full local checks** (`npm run typecheck`, `npm test`, `npm run test:e2e`, `cargo fmt --check`,
   `cargo clippy --all-targets -- -D warnings`, `cargo test`) and a local `npx tauri build`.
5. **Run `cargo audit`** (in `src-tauri`) and `npm audit --omit=dev`. Fix or consciously accept findings.
6. Commit, push to `main`, and wait for CI to pass.
7. **Tag and push the tag**: `git tag v0.1.0-beta.1 && git push origin v0.1.0-beta.1`.
8. The *Release* workflow verifies the tag equals the app version, runs the tests, builds the Windows x64
   installer (NSIS `.exe`), computes `SHA256SUMS.txt`, and attaches everything to a **draft** release.
9. **Review the draft**: download the installer on a clean Windows machine/VM, check install, launch, a real
   scan, saving a card, uninstall. Edit the release notes (copy from the changelog).
10. **Publish** the draft yourself.

## Verifying a build locally

```powershell
npx tauri build
Get-FileHash src-tauri\target\release\bundle\nsis\*.exe -Algorithm SHA256
```

Artifacts appear under `src-tauri/target/release/bundle/nsis/`; the bare executable is
`src-tauri/target/release/pc-exposed.exe`.

## MSI installer (stable releases only)

The MSI format (WiX) only accepts numeric pre-release identifiers, so versions like `0.1.0-beta.1` cannot
build an MSI. Pre-releases ship the NSIS installer only. For the first stable release (for example `1.0.0`),
add `"msi"` to `bundle.targets` in `tauri.conf.json` (and `bundle.windows.wix.language` if desired) and
update `src/app/release.test.ts` accordingly.

## Code signing (not set up yet)

Unsigned installers trigger Windows SmartScreen warnings. Before a stable release, obtain a code-signing
certificate and configure signing in `tauri.conf.json` (`bundle.windows.certificateThumbprint`) or via a
signing service, and store credentials as GitHub encrypted secrets. Never commit certificates or keys.

## Rolling back

If a published release is bad, mark it as pre-release or delete it on GitHub, publish a fixed version with
a higher number, and note it in the changelog. Do not move or reuse tags.
