# Localization

English is the only shipped language. The architecture is ready for more, including
right-to-left (RTL) languages such as Arabic, without component changes.

## How it works

- `src/i18n/en.ts`: the English catalog and the source of truth for message **keys**
  (`area.thing`). `MessageKey` is derived from it.
- `src/i18n/index.tsx`: a locale registry, `translate`/`translatePlural`, `I18nProvider`
  and `useI18n()` returning `{ t, tp, locale, dir, formatNumber, formatDate }`.
- `Settings.language` stores the locale id. Unknown ids fall back to English.
- `<html lang>` and `<html dir>` are set from the active locale, so browser and
  assistive-tech behaviour follow the language.
- Missing keys fall back to English, then to the key itself: never a blank label.

## Adding a language (e.g. Arabic)

1. Create `src/i18n/ar.ts` exporting a `Messages` object with every key in `en.ts`.
2. For plurals add suffixed keys per CLDR category: Arabic needs
   `key.zero`, `.one`, `.two`, `.few`, `.many`, `.other`. English needs `.one` and `.other`.
   `tp(key, n)` picks the right one with `Intl.PluralRules`.
3. Register it in `src/i18n/index.tsx`:
   `["ar", { id: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl", messages: ar }]`.
4. The language picker in Settings lists it automatically.

`quality.test.tsx` proves this path with a test-only Arabic catalog: `dir="rtl"` is applied,
translated chrome renders, and all six Arabic plural forms resolve correctly.

## RTL readiness

- All layout uses **logical** Tailwind utilities (`ms-`, `ps-`, `text-start`, `border-e`,
  `end-6`, …). A test fails if physical `ml-`/`pr-`/`text-left`/`border-r`/`right-` classes
  are used, so layouts mirror automatically.
- Directional icons (Wrapped chevrons) use `rtl:rotate-180`; keyboard arrows in the
  radio groups and Wrapped are mirrored in RTL.
- The window controls keep macOS-style placement in every language (they are window
  chrome, not content).

## What is not yet localized (honest status)

- **Migrated to the catalog:** navigation, shell, title bar, Home, Settings (including the
  privacy disclosure), shared empty states, and the error boundary.
- **Still English literals (mechanical migration):** Investigation, Results, Personality,
  System Analysis, Roast, Hardware, Share Studio, Compare and Wrapped screen text.
- **Engine content is English-only:** personality descriptions, the roast library
  (101 lines), analysis reasons and bottleneck text live in `src/engine/`. Roasts are
  humour tied to English idiom; localizing them means authoring new lines per language,
  not translating strings. The engine emits structured data (ids, numbers), so a locale
  layer can be added without changing scoring logic.
- **Share cards** are drawn on a canvas with Latin-script layout assumptions. Arabic needs
  `ctx.direction = "rtl"` and a font with Arabic glyphs; this has not been implemented or tested.
