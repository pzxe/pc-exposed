import { describe, it, expect } from "vitest";
import { analyze } from "./analyze";
import { buildWrapped, mostInteresting } from "./wrapped";
import { extractFacts } from "./facts";
import { makeScan } from "./testFixtures";
import { buildSlides } from "@/screens/Wrapped";
import { hasIcon } from "@/lib/icons";
import { PERSONALITIES } from "./personality";

describe("PC Wrapped data", () => {
  it("assembles every required field from the analysis", () => {
    const a = analyze(makeScan({ startupEnabled: 12, ramGb: 16, ramUsedPct: 40 }));
    const w = buildWrapped(a);
    expect(w.score).toBe(a.overall.score);
    expect(w.personality.title).toBe(a.personality.primary.def.title);
    expect(w.strongest!.score).toBeGreaterThanOrEqual(w.weakest!.score);
    expect(w.startupEnabled).toBe(12);
    expect(w.ramGb).toBe(16);
    expect(w.cpu).toBe("Test CPU");
    expect(w.gpu).toContain("RTX 4070");
    expect(w.bestRoast).toBe(a.roasts.best.text);
    expect(w.verdictLine).toContain(`${a.overall.score}/100`);
  });

  it("picks the weakest category by score and explains it with a real reason", () => {
    const w = buildWrapped(analyze(makeScan({ startupEnabled: 45 })));
    expect(w.weakest!.label).toBe("Startup Efficiency");
    expect(w.weakest!.why).toMatch(/45 enabled startup entries/);
  });

  it("only uses facts that exist for the discovery", () => {
    expect(mostInteresting(extractFacts(makeScan({ startupEnabled: 2, startupDisabled: 9 }))).title).toBe("A tidy startup");
    expect(mostInteresting(extractFacts(makeScan({ uptimeDays: 20 }))).title).toBe("Marathon runner");
    expect(mostInteresting(extractFacts(makeScan({ threads: null, gpu: null, ramGb: null, drives: null }))).title).toBe("Refreshingly normal");
  });

  it("omits slides whose data is unavailable rather than inventing values", () => {
    const keys = (spec: Parameters<typeof makeScan>[0]) => buildSlides(buildWrapped(analyze(makeScan(spec)))).map((s) => s.key);
    expect(keys({})).toEqual(expect.arrayContaining(["intro", "score", "personality", "ram", "chips", "storage", "roast", "verdict"]));
    const sparse = keys({ ramGb: null, drives: null, threads: null, gpu: null });
    expect(sparse).not.toContain("ram");
    expect(sparse).not.toContain("storage");
    expect(sparse).not.toContain("chips");
  });

  it("every personality icon resolves to a component", () => {
    for (const p of PERSONALITIES) expect(hasIcon(p.icon), p.icon).toBe(true);
  });
});
