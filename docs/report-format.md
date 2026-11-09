# PC EXPOSED report format (version 1)

A **report** is a small JSON summary of one scan. It is what PC EXPOSED saves locally,
what you export to a file, and what you can import to compare against another PC.

A report is deliberately a *summary*. It does **not** contain: process names, startup
app names, the installed-app list, drive letters, MAC or IP addresses, user names, or
any raw scan data.

- File extension: `.json`, UTF-8
- Maximum size: **1 MB** (a real report is a few KB)
- Version field: `formatVersion` (currently `1`)

## Example

```json
{
  "format": "pc-exposed-report",
  "formatVersion": 1,
  "id": "3f2b8c1e-5d44-4a6e-9a51-2c7d6f0e1b11",
  "createdAt": 1767225600000,
  "label": "Gaming rig",
  "appVersion": "0.1.0-beta.1",
  "system": {
    "cpu": { "name": "AMD Ryzen 7 9850X3D 8-Core Processor", "threads": 16, "cores": 8, "maxClockGhz": 4.7, "tier": 4 },
    "gpu": { "name": "NVIDIA GeForce RTX 5080", "vramGb": 16, "tier": 5, "classLabel": "Enthusiast" },
    "ramGb": 32,
    "storage": { "drives": 5, "totalTb": 3.4, "systemFreePercent": 63, "systemDriveKind": "ssd" },
    "os": { "name": "Windows 11 Pro", "isWindows11": true },
    "startupEnabled": 8,
    "appCount": 138
  },
  "scores": {
    "overall": 94,
    "verdict": "Elite",
    "categories": [
      { "id": "hardware", "label": "Hardware Power", "score": 91 },
      { "id": "memory", "label": "Memory Health", "score": 95 },
      { "id": "storage", "label": "Storage Health", "score": 100 },
      { "id": "startup", "label": "Startup Efficiency", "score": 85 },
      { "id": "config", "label": "System Configuration", "score": 100 },
      { "id": "gaming", "label": "Gaming Readiness", "score": 95 }
    ]
  },
  "personality": { "id": "gaming-monster", "title": "THE GAMING MONSTER" },
  "privacy": { "modelsHidden": false }
}
```

## Fields

| Field | Type | Rules |
|---|---|---|
| `format` | string | Must be exactly `"pc-exposed-report"`. |
| `formatVersion` | integer | Must be `1`. Newer versions are rejected with a message to update the app. |
| `id` | string | 6–64 characters: letters, digits, `-`, `_`. Replaced with a fresh id on import. |
| `createdAt` | integer | Unix epoch milliseconds, between years 2020 and 2100. |
| `label` | string | Up to 40 characters. Control characters, bidi overrides and `<` `>` are removed. |
| `appVersion` | string | Up to 32 characters of letters, digits, `.`, `+`, `-`. |
| `system.cpu` | object | `name` (≤ 80 chars), `threads` (1–1024), `cores` (1–1024), `maxClockGhz` (0.1–10), `tier` (0–5). All optional. |
| `system.gpu` | object | `name` (≤ 100), `vramGb` (0–1024), `tier` (0–5), `classLabel` (≤ 20). All optional. |
| `system.ramGb` | number | 0.1–16384. |
| `system.storage` | object | `drives` (0–256), `totalTb` (0–10000), `systemFreePercent` (0–100), `systemDriveKind` (`"ssd"` or `"hdd"`). All optional. |
| `system.os` | object | `name` (≤ 60), `isWindows11` (boolean). Optional. |
| `system.startupEnabled`, `system.appCount` | integer | 0–100000. |
| `scores.overall` | number or `null` | 0–100. `null` means there was not enough evidence to score. |
| `scores.verdict` | string | Up to 24 characters. |
| `scores.categories` | array | 1–12 items, each `{ id, label, score }`. `id` is one of `hardware`, `memory`, `storage`, `startup`, `config`, `gaming`, with no duplicates. `score` is 0–100 or `null`. |
| `personality` | object | Optional: `id` (lowercase letters, digits, `-`) and `title` (≤ 40). |
| `privacy.modelsHidden` | boolean | `true` when exact CPU/GPU models were replaced by generic classes. |

`tier` values are estimated classes (0 integrated, 1 entry, 2 mainstream, 3 upper-mid,
4 high-end, 5 enthusiast). They are estimates from specs, **not benchmark results**.

Missing optional fields mean "not available". They never mean zero.

## Import safety

Imported files are treated as untrusted data and are never executed.

1. The file size is checked (≤ 1 MB) **before** parsing.
2. The text must be valid JSON containing an object.
3. The validator reads **only the fields listed above** and builds a brand-new report.
   Unknown fields (for example `__proto__`, `constructor`, scripts, URLs) are discarded
   and never copied.
4. Every number must be finite and within its range. Every string is length-limited and
   stripped of control characters, bidirectional-override characters and angle brackets.
5. Any violation rejects the whole file with a list of specific problems. Nothing is
   partially imported.
6. An imported report always receives a fresh `id`, so it can never overwrite an
   existing saved report.
7. Text from an imported report is only ever rendered as plain text, never as HTML.

## Privacy export

Choosing "Hide exact CPU/GPU models" replaces `cpu.name` and `gpu.name` with generic text
such as `NVIDIA enthusiast-class GPU` and sets `privacy.modelsHidden` to `true`.
