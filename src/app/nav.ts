import type { MessageKey } from "@/i18n";
import {
  Home, ScanSearch, Gauge, Sparkles, Cpu, Activity, Flame, Share2,
  Settings as SettingsIcon, GitCompare, type LucideIcon,
} from "lucide-react";

export type ScreenId =
  | "home" | "investigation" | "results" | "personality" | "hardware"
  | "analysis" | "roast" | "share" | "compare" | "settings";

export interface NavItem {
  id: ScreenId;
  labelKey: MessageKey;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { id: "home", labelKey: "nav.home", icon: Home },
  { id: "investigation", labelKey: "nav.investigation", icon: ScanSearch },
  { id: "results", labelKey: "nav.results", icon: Gauge },
  { id: "personality", labelKey: "nav.personality", icon: Sparkles },
  { id: "hardware", labelKey: "nav.hardware", icon: Cpu },
  { id: "analysis", labelKey: "nav.analysis", icon: Activity },
  { id: "roast", labelKey: "nav.roast", icon: Flame },
  { id: "share", labelKey: "nav.share", icon: Share2 },
  { id: "compare", labelKey: "nav.compare", icon: GitCompare },
  { id: "settings", labelKey: "nav.settings", icon: SettingsIcon },
];
