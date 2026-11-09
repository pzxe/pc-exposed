import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { en, type MessageKey, type Messages } from "./en";

export type { MessageKey, Messages };

export type Direction = "ltr" | "rtl";

export interface LocaleDef {
  /** BCP 47 tag, e.g. "en", "ar". */
  id: string;
  /** Name in English, and in the language itself (shown in the language picker). */
  name: string;
  nativeName: string;
  dir: Direction;
  messages: Messages;
}

/**
 * Locale registry. To add Arabic: create src/i18n/ar.ts exporting a full `Messages`
 * object, then register it here with dir: "rtl". No component changes are needed:
 * layouts use logical CSS (start/end) and `<html dir>` follows the locale.
 */
const registry = new Map<string, LocaleDef>([
  ["en", { id: "en", name: "English", nativeName: "English", dir: "ltr", messages: en as unknown as Messages }],
]);

export const DEFAULT_LOCALE = "en";
export const registerLocale = (def: LocaleDef) => { registry.set(def.id, def); };
export const unregisterLocale = (id: string) => { if (id !== DEFAULT_LOCALE) registry.delete(id); };
export const listLocales = (): LocaleDef[] => [...registry.values()];
export const isLocaleId = (id: unknown): id is string => typeof id === "string" && registry.has(id);
export const getLocale = (id: string): LocaleDef => registry.get(id) ?? registry.get(DEFAULT_LOCALE)!;

const interpolate = (s: string, params?: Record<string, string | number>) =>
  params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s;

/** Looks up `key` in the locale, falls back to English, then to the key itself (visible, never blank). */
export function translate(localeId: string, key: MessageKey | string, params?: Record<string, string | number>): string {
  const msg = getLocale(localeId).messages[key] ?? (en as Record<string, string>)[key] ?? key;
  return interpolate(msg, params);
}

/** Plural lookup using the locale's CLDR rules: tries `key.<category>` then `key.other`. */
export function translatePlural(localeId: string, key: string, count: number, params?: Record<string, string | number>): string {
  let category = "other";
  try { category = new Intl.PluralRules(localeId).select(count); } catch { /* unsupported tag: use "other" */ }
  const msgs = getLocale(localeId).messages;
  const en_ = en as Record<string, string>;
  const msg = msgs[`${key}.${category}`] ?? msgs[`${key}.other`] ?? en_[`${key}.${category}`] ?? en_[`${key}.other`] ?? key;
  return interpolate(msg, { count, ...params });
}

export interface I18n {
  locale: string;
  dir: Direction;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  tp: (key: string, count: number, params?: Record<string, string | number>) => string;
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string;
  formatDate: (ms: number, opts?: Intl.DateTimeFormatOptions) => string;
}

export function makeI18n(localeId: string): I18n {
  const def = getLocale(localeId);
  return {
    locale: def.id,
    dir: def.dir,
    t: (key, params) => translate(def.id, key, params),
    tp: (key, count, params) => translatePlural(def.id, key, count, params),
    formatNumber: (n, opts) => new Intl.NumberFormat(def.id, opts).format(n),
    formatDate: (ms, opts) => new Intl.DateTimeFormat(def.id, opts ?? { dateStyle: "medium" }).format(new Date(ms)),
  };
}

const Ctx = createContext<I18n>(makeI18n(DEFAULT_LOCALE));

/** Provides translations and keeps `<html lang dir>` in sync with the active locale. */
export function I18nProvider({ locale, children }: { locale: string; children: ReactNode }) {
  const value = useMemo(() => makeI18n(locale), [locale]);
  useEffect(() => {
    document.documentElement.lang = value.locale;
    document.documentElement.dir = value.dir;
  }, [value]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = (): I18n => useContext(Ctx);
