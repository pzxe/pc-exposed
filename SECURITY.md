# Security policy

PC EXPOSED reads hardware and system information on your PC, so security and privacy are
core to the project. Thank you for helping keep it safe.

## Supported versions

This is a beta. Only the latest release receives security fixes.

| Version | Supported |
|---|---|
| 0.1.x (latest beta) | ✅ |
| older | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private reporting: open this repository's **Security** tab and choose
**Report a vulnerability**. If that option is not available, open an issue that says only
"I have a security report" **without any details**, and a maintainer will arrange a private channel.

Please include: what you found, the affected version, steps to reproduce, and the impact you
believe it has. Proof-of-concept code is welcome; please keep it harmless.

You can expect an acknowledgement within about a week and a fix or a decision as soon as
practical. This is a volunteer-run open-source project, so there are no guaranteed SLAs.
Credit is given in the release notes unless you prefer otherwise.

## What is in scope

- The desktop app (Rust core, Tauri configuration, React frontend) and its installers
- Handling of imported report files (parsing, validation, rendering)
- Anything that could make the app contact a network, read files it should not, write files
  without the user choosing a location, or run attacker-controlled code
- Privacy: collecting or retaining data beyond what `docs/PRIVACY.md` states

## Out of scope

- Vulnerabilities in Windows, WebView2, or other third-party software themselves
- Attacks that require an already-compromised machine or administrator access
- Findings that are only theoretical and have no impact on the app's users
- Unsigned installers triggering SmartScreen (known; code signing is planned)

## How the app is designed to limit risk

See `docs/SECURITY_REVIEW.md` for the threat model, evidence and known gaps. In short:
no network code, a restrictive Content Security Policy, a webview with no filesystem or
shell permission, validated native commands for saving files, and a whitelist validator for
imported reports.

## Verifying downloads

Releases include a `SHA256SUMS.txt`. Compare it with the hash of the file you downloaded:

```powershell
Get-FileHash .\PC-EXPOSED-setup.exe -Algorithm SHA256
```

Installers are **not code-signed yet**; always download from this repository's Releases page.
