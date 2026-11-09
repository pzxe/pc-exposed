/**
 * English message catalog and the source of truth for message KEYS.
 * Every other locale must provide the same keys (enforced by the `Messages` type).
 *
 * Conventions
 *  - Keys are namespaced: `area.thing`.
 *  - `{name}` placeholders are interpolated by `t(key, { name })`.
 *  - Plurals use suffixed keys resolved by `tp(key, n)` with Intl.PluralRules:
 *    `key.one`, `key.other` (and `.zero` `.two` `.few` `.many` for languages that need them).
 *    Only `.other` is mandatory.
 */
export const en = {
  // navigation
  "nav.home": "Dashboard",
  "nav.investigation": "Investigation",
  "nav.results": "PC Exposure",
  "nav.personality": "Personality",
  "nav.hardware": "Hardware",
  "nav.analysis": "System Analysis",
  "nav.roast": "PC Roast",
  "nav.share": "Share Studio",
  "nav.compare": "Compare PCs",
  "nav.settings": "Settings",
  "nav.label": "Main",

  // shell
  "shell.skipToContent": "Skip to content",
  "shell.localNote": "Everything stays on this device. Nothing is uploaded.",
  "shell.content": "Content",
  "window.close": "Close",
  "window.minimize": "Minimize",
  "window.maximize": "Maximize or restore",

  // common
  "common.exposeMyPc": "EXPOSE MY PC",
  "common.scanning": "Scanning…",
  "common.delete": "Delete",
  "common.cancel": "Cancel",
  "common.yesDelete": "Yes, delete",
  "common.unavailable": "Unavailable",

  // empty states
  "needsScan.body": "This screen needs a real scan of your PC. Nothing is shown until one has run, and nothing leaves your device.",

  // home
  "home.title": "Expose your PC",
  "home.subtitle": "Discover its personality, uncover its secrets, and roast your hardware.",
  "home.scanNote": "The scan is local, read-only and takes about a second. Nothing is uploaded.",
  "home.pillar.local.title": "100% local",
  "home.pillar.local.text": "The scan runs on this PC. Nothing is uploaded, ever.",
  "home.pillar.real.title": "Real measurements",
  "home.pillar.real.text": "Only data read from your system is used. Missing data is shown as unavailable.",
  "home.pillar.share.title": "Share on your terms",
  "home.pillar.share.text": "Export a PNG card only when you choose to.",
  "home.last.title": "Your last scan",
  "home.last.score": "Score {score}/100 · {verdict}",
  "home.last.results": "See results",
  "home.last.share": "Make a share card",
  "home.last.demo": "DEMO DATA (synthetic), not your PC",

  // settings
  "settings.title": "Settings",
  "settings.subtitle": "Preferences, privacy and about.",
  "settings.appearance": "Appearance",
  "settings.theme": "Theme: Dark (the only theme in this beta).",
  "settings.animations": "Animations",
  "settings.motion.system": "Follow system",
  "settings.motion.on": "Always animate",
  "settings.motion.off": "Reduce animations",
  "settings.language": "Language",
  "settings.language.note": "More languages, including Arabic with right-to-left layout, can be added without code changes. See docs/localization.md.",

  "settings.privacy": "Privacy",
  "settings.privacy.local": "All investigations run locally and read-only.",
  "settings.privacy.none": "No account, telemetry, analytics or automatic uploads.",
  "settings.privacy.share": "Nothing leaves this device unless you export or share it yourself.",
  "settings.privacy.delete": "Saved reports can be deleted at any time under “Local data” below.",

  "settings.collected.title": "What PC EXPOSED reads",
  "settings.collected.intro": "A scan reads only the following, in read-only mode and without administrator rights. It stays in memory until you choose to save or export something.",
  "settings.never.title": "What it never reads",
  "privacy.collect.cpu": "Processor name, manufacturer, core and thread counts, rated clock speed, momentary utilization.",
  "privacy.collect.gpus": "Graphics adapter names and dedicated/shared video memory. Utilization and temperature are not read.",
  "privacy.collect.memory": "Total, used and available RAM.",
  "privacy.collect.storage": "Drive letters, types (SSD/HDD), file systems, and total and free space. Never file or folder contents.",
  "privacy.collect.os": "Windows edition, version, build, architecture and uptime.",
  "privacy.collect.startup": "Names of apps in the registry Run keys and Startup folders, and whether they are enabled. Command lines are not stored.",
  "privacy.collect.apps": "The count of installed apps, sizes where Windows records them, and a fixed list of well-known RGB and game-launcher apps. The full app list is never exported.",
  "privacy.collect.battery": "Whether a battery exists and its charge state.",
  "privacy.collect.network": "Adapter names, connected state and link speed. Never MAC or IP addresses.",
  "privacy.collect.processes": "Process count and the names of the biggest memory users. No command lines, paths, windows or content.",
  "privacy.never.documents": "Your documents, photos or any file contents",
  "privacy.never.browser": "Browser history, cookies, saved passwords or sessions",
  "privacy.never.identity": "Your name, account, computer name, MAC address or IP address",
  "privacy.never.input": "Keystrokes, screenshots, microphone, camera or location",
  "privacy.never.traffic": "Network traffic. The app makes no network requests at all.",

  "settings.local.title": "Local data",
  "settings.local.body": "Saved reports, roast history, card preferences and settings are stored only in this app's data folder on this device.",
  "settings.local.count.one": "You have {count} saved report.",
  "settings.local.count.other": "You have {count} saved reports.",
  "settings.local.deleteReports": "Delete saved reports",
  "settings.local.resetAll": "Reset all local data",
  "settings.local.confirmReports.one": "Permanently delete {count} saved report?",
  "settings.local.confirmReports.other": "Permanently delete {count} saved reports?",
  "settings.local.confirmAll": "Delete reports, roast history, card preferences and settings?",
  "settings.local.doneReports": "All saved reports were deleted.",
  "settings.local.doneAll": "All local data was deleted and settings were reset.",

  "settings.updates.title": "Updates",
  "settings.updates.body": "PC EXPOSED never contacts a server on its own. Automatic update checks are off, and this build has no update feed configured, so there is nothing to check.",
  "settings.updates.button": "Check for updates",
  "settings.updates.unconfigured": "No update feed is configured in this build.",

  "settings.about": "About",
  "settings.about.version": "Version",
  "settings.about.license": "License",
  "settings.about.platform": "Platform",
  "settings.about.browser": "not running in the desktop shell",
  "settings.licenses.title": "Open-source licenses",
  "settings.licenses.body": "PC EXPOSED is released under the MIT License. It is built with open-source software, all under permissive licenses (MIT, Apache-2.0, ISC, BSD, Unicode) apart from five MPL-2.0 Rust crates used unmodified.",

  // errors
  "error.title": "Something went wrong",
  "error.body": "PC EXPOSED hit an unexpected problem. Your saved reports are safe. Reload the app to continue.",
  "error.reload": "Reload",
} as const;

export type MessageKey = keyof typeof en;
/** A complete catalog for any locale. Plural variants are optional extras. */
export type Messages = { [K in MessageKey]: string } & Record<string, string>;
