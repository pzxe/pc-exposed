import type { MessageKey } from "@/i18n";

/**
 * Disclosure of everything a scan reads. Each id is a section of `ScanReport`
 * (src/lib/scanTypes.ts); a test fails if a section is added without being
 * disclosed here, so this list cannot silently fall behind the scanner.
 */
export const COLLECTED_SECTIONS = ["cpu", "gpus", "memory", "storage", "os", "startup", "apps", "battery", "network", "processes"] as const;
export type CollectedSection = (typeof COLLECTED_SECTIONS)[number];

export const collectedKey = (id: CollectedSection): MessageKey => `privacy.collect.${id}` as MessageKey;

export const NEVER_COLLECTED: MessageKey[] = [
  "privacy.never.documents", "privacy.never.browser", "privacy.never.identity", "privacy.never.input", "privacy.never.traffic",
];
