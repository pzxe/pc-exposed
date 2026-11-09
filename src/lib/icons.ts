import {
  Rocket, Gamepad2, Ghost, Lightbulb, LifeBuoy, Hammer, Moon, Funnel, Archive, Sparkles, Tornado, Briefcase, HelpCircle,
  type LucideIcon,
} from "lucide-react";

/** Personality icon names (from the engine) → components. Explicit map keeps the bundle small. */
const MAP: Record<string, LucideIcon> = {
  Rocket, Gamepad2, Ghost, Lightbulb, LifeBuoy, Hammer, Moon, Funnel, Archive, Sparkles, Tornado, Briefcase,
};

export const hasIcon = (name: string) => name in MAP;
export const iconFor = (name: string): LucideIcon => MAP[name] ?? HelpCircle;
