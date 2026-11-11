# Privacy policy

*Applies to PC EXPOSED v0.2.0-beta.1. Plain-language summary first, details below.*

**PC EXPOSED investigates your PC on your PC. It never sends anything anywhere.**

## In short

- No account. No telemetry. No analytics. No crash reporting. No automatic updates.
- The app contains **no network-request code**. Its Content Security Policy blocks all external connections.
- Scan results stay in memory until you save a report, export something, or turn on scan history.
- Anything leaving your device does so only because **you** chose a destination (a PNG or JSON file) and shared it yourself.
- You can delete everything the app stores, at any time, in Settings → Local data.

## What a scan reads

Read-only, no administrator rights, and no access to your files:

| Area | What is read |
|---|---|
| Processor | name, manufacturer, core/thread counts, rated clock speed, momentary utilization |
| Graphics | adapter names, dedicated/shared video memory (utilization and temperature are not read) |
| Memory | total, used and available RAM |
| Storage | drive letters, type (SSD/HDD), file system, total and free space. Never file or folder contents |
| Operating system | Windows edition, version, build, architecture, uptime |
| Startup | names of apps in the registry Run keys and Startup folders, and whether they are enabled. Command lines are not stored |
| Installed apps | the count; sizes where Windows records them; and a fixed list of well-known RGB/peripheral and game-launcher apps. The full list is never exported |
| Battery | whether one exists, and its charge state |
| Network | adapter names, connected state, link speed. **Never MAC or IP addresses** |
| Processes | the process count and the names of the largest memory users. No command lines, paths, windows or content |

## What it never reads

Your documents, photos or any file contents; browser history, cookies, saved passwords or sessions;
your name, account, computer name, MAC or IP address; keystrokes, screenshots, microphone,
camera or location; network traffic.

## What is stored on your device

Stored only in this app's own data folder, `%LOCALAPPDATA%\dev.pcexposed.desktop\EBWebView`
(the app's private WebView2 profile):

- **Saved reports** you chose to keep (a small summary: hardware classes and scores; no process
  or startup-app names). Up to 50.
- **Scan history**, only if you turn it on (it is **off by default**): a summary of each real scan,
  identical in content to a saved report (hardware classes and scores; no process, startup-app or
  installed-app names). Up to 60, oldest dropped first. Delete one or all on the History screen.
- **Roast history** (ids of roast lines already shown, to avoid repeats).
- **Preferences**: animation setting, language, share-card options (including a username you typed).

Delete all of it under **Settings → Local data → Reset all local data**, or delete the folder above.
**Uninstalling does not delete this folder** (verified with a silent uninstall: the program files,
shortcuts and registry entry were removed, but the data folder remained). To remove everything, use
Settings → Local data → Reset all local data *before* uninstalling, or delete the folder above afterwards.

## What you can export

- **PNG share cards.** Optional *Privacy mode* hides your username, exact CPU/GPU models, app
  names and drive letters. Cards made from demo data are labelled as such.
- **Spec sheet (clipboard).** *Hardware → Copy specs* copies CPU, GPU, RAM, drive letters with sizes and
  free space, Windows version and whether a battery is present. No app, process or network names.
- **Report files (.json).** A summary as described in `docs/report-format.md`. The optional
  "Hide exact CPU/GPU models" setting replaces exact model names with generic classes.

Before you post an export publicly, look at it: it can still contain details you typed yourself
(such as a username) and, outside Privacy mode, your hardware models.

## Importing

Imported reports are validated and rebuilt from known fields only. They are never executed and
are shown as plain text.

## Third parties

The app uses open-source libraries (see `THIRD_PARTY_LICENSES.md`). None of them is given network
access by this app. Windows' WebView2 component renders the interface; its own behaviour is
governed by Microsoft's terms and Windows settings.

## Changes and contact

If this policy changes it will be noted in `CHANGELOG.md`. For privacy questions or concerns,
open an issue (for anything sensitive, see `SECURITY.md`).
