import { DEFAULT_LOCALE, isLocaleId } from "@/i18n";

/** Persisted UI preferences. Stored locally only (localStorage); never transmitted. */
export type MotionPref = "system" | "on" | "off";

export interface Settings {
  motion: MotionPref;
  /** Locale id from the i18n registry (BCP 47 tag). */
  language: string;
}

const KEY = "pc-exposed.settings.v1";
export const DEFAULT_SETTINGS: Settings = { motion: "system", language: DEFAULT_LOCALE };

/** Defensive parse: unknown or corrupt storage falls back to defaults. */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const v = JSON.parse(raw) as Partial<Settings>;
    const motion: MotionPref =
      v.motion === "on" || v.motion === "off" || v.motion === "system" ? v.motion : "system";
    return { motion, language: isLocaleId(v.language) ? v.language : DEFAULT_LOCALE };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}
