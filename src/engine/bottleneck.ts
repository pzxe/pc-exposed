import type { BottleneckObservation } from "./types";
import type { Facts } from "./facts";

export const BENCHMARK_NOTICE =
  "PC EXPOSED did not run any benchmark or game. Findings are measurements from this scan or estimates from your specs, and they are labelled as such.";

const gb = (n: number) => `${Math.round(n * 10) / 10} GB`;

/**
 * Bottleneck analysis in four strictly separate kinds:
 *  - measured:     observed in this scan (point-in-time)
 *  - potential:    plausible from specs, NOT observed
 *  - pairing:      CPU/GPU class relationship, NOT a benchmark
 *  - insufficient: we could not tell
 */
export function analyzeBottlenecks(f: Facts): BottleneckObservation[] {
  const out: BottleneckObservation[] = [];

  // ---- measured ----
  if (f.ramUsedPercent !== undefined && f.ramUsedPercent >= 90) {
    out.push({
      kind: "measured", title: "Memory pressure right now", confidence: "high",
      detail: "Most of your RAM was in use during the scan, which can force Windows to page to disk.",
      evidence: [`${Math.round(f.ramUsedPercent)}% of memory in use`, ...(f.topProcesses.length ? [`Top consumers: ${f.topProcesses.slice(0, 3).join(", ")}`] : [])],
    });
  }
  if (f.systemFreePercent !== undefined && f.systemFreePercent < 10) {
    out.push({
      kind: "measured", title: "System drive nearly full", confidence: "high",
      detail: "Windows needs working space on the system drive for updates, caching and virtual memory.",
      evidence: [`${Math.round(f.systemFreePercent)}% free (${gb(f.systemFreeGb ?? 0)})`],
    });
  }
  if (f.cpuUtilPercent !== undefined && f.cpuUtilPercent >= 85) {
    out.push({
      kind: "measured", title: "CPU busy during the scan", confidence: "medium",
      detail: "The CPU was heavily loaded when sampled. This is one short sample, not a sustained measurement.",
      evidence: [`${Math.round(f.cpuUtilPercent)}% CPU utilization`],
    });
  }

  // ---- potential ----
  if (f.ramGb !== undefined && f.ramGb < 15 && f.gpuClass && f.gpuClass.tier >= 3) {
    out.push({
      kind: "potential", title: "RAM may limit a strong GPU", confidence: "medium",
      detail: "Modern games and a browser alongside them can exceed this capacity. Not observed in this scan.",
      evidence: [`${gb(f.ramGb)} RAM`, `GPU class: ${f.gpuClass.label}`],
    });
  }
  if (f.gpuVramGb !== undefined && f.gpuClass && f.gpuClass.tier >= 3 && f.gpuVramGb < 8) {
    out.push({
      kind: "potential", title: "VRAM may run short at high texture settings", confidence: "medium",
      detail: "Some recent titles want more than this at high settings. It depends heavily on the game and resolution.",
      evidence: [`${gb(f.gpuVramGb)} dedicated VRAM`],
    });
  }
  if (f.systemDriveKind === "hdd") {
    out.push({
      kind: "potential", title: "Hard disk system drive may slow boot and loading", confidence: "medium",
      detail: "Hard disks have much higher access latency than SSDs. Boot time was not measured.",
      evidence: ["System drive type: HDD"],
    });
  }
  if (f.startupEnabled !== undefined && f.startupEnabled >= 20) {
    out.push({
      kind: "potential", title: "Many startup entries may slow sign-in", confidence: "low",
      detail: "Each entry can add to post-login load. Actual boot time was not measured and many entries are lightweight.",
      evidence: [`${f.startupEnabled} enabled startup entries`],
    });
  }

  // ---- pairing ----
  if (f.cpuClass && f.gpuClass) {
    const gap = f.gpuClass.tier - f.cpuClass.tier;
    const ev = [`CPU class: ${f.cpuClass.label} (${f.logicalThreads} threads)`, `GPU class: ${f.gpuClass.label}`];
    if (gap >= 2) {
      out.push({
        kind: "pairing", title: "GPU class is well above CPU class", confidence: "low",
        detail: "In CPU-heavy games, or at low resolutions, the CPU could cap what this GPU delivers. This is a pairing observation, not a measured bottleneck.",
        evidence: ev,
      });
    } else if (gap <= -2) {
      out.push({
        kind: "pairing", title: "CPU class is well above GPU class", confidence: "low",
        detail: "In graphics-heavy games the GPU is the more likely limit. This is a pairing observation, not a measured bottleneck.",
        evidence: ev,
      });
    } else {
      out.push({
        kind: "pairing", title: "CPU and GPU look reasonably matched", confidence: "low",
        detail: "Neither part's class is far ahead of the other, so no obvious pairing imbalance. Real behavior still depends on the game.",
        evidence: ev,
      });
    }
  }

  // ---- insufficient evidence ----
  if (!f.gpuUtilKnown) {
    out.push({
      kind: "insufficient", title: "GPU load unknown", confidence: "high",
      detail: "GPU utilization and temperature could not be read, so a GPU-limited or thermal bottleneck cannot be confirmed or ruled out.",
      evidence: ["GPU utilization: unavailable"],
    });
  }
  if (f.gpuName && !f.gpuClass) {
    out.push({
      kind: "insufficient", title: "GPU model not recognized", confidence: "high",
      detail: "The engine could not classify this GPU from its name, so GPU pairing and gaming readiness were not estimated.",
      evidence: [f.gpuName],
    });
  }
  return out;
}
