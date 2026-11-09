/**
 * TEST FIXTURES ONLY. Synthetic scans used by unit tests. Never imported by app code.
 * Real scans always come from the native collectors.
 */
import type { DriveInfo, Reading, ScanReport } from "@/lib/scanTypes";

const GB = 1024 ** 3;
const ok = <T,>(value: T): Reading<T> => ({ status: "available", value });
const no = <T,>(reason = "test: unavailable"): Reading<T> => ({ status: "unavailable", reason });

export interface Spec {
  threads?: number | null; cores?: number; clockMhz?: number; cpuUtil?: number;
  gpu?: string | null; vramGb?: number;
  ramGb?: number | null; ramUsedPct?: number;
  startupEnabled?: string[] | number; startupDisabled?: number;
  drives?: { mount: string; totalGb: number; freeGb: number; kind?: "ssd" | "hdd" | null; system?: boolean }[] | null;
  apps?: number; rgb?: string[]; launchers?: string[];
  build?: string; uptimeDays?: number; battery?: boolean;
  procs?: string[];
}

export function makeScan(spec: Spec = {}): ScanReport {
  const threads = spec.threads === undefined ? 16 : spec.threads;
  const ramGb = spec.ramGb === undefined ? 32 : spec.ramGb;
  const used = spec.ramUsedPct ?? 45;
  const gpuName = spec.gpu === undefined ? "NVIDIA GeForce RTX 4070" : spec.gpu;
  const driveSpecs = spec.drives === undefined
    ? [{ mount: "C:\\", totalGb: 1000, freeGb: 500, kind: "ssd" as const, system: true }]
    : spec.drives;
  const startupList = typeof spec.startupEnabled === "number"
    ? Array.from({ length: spec.startupEnabled }, (_, i) => `App${i}`)
    : spec.startupEnabled ?? ["OneApp", "TwoApp", "ThreeApp"];

  const drives: DriveInfo[] = (driveSpecs ?? []).map((d) => ({
    mountPoint: d.mount, label: no(), kind: d.kind === null ? no() : ok(d.kind ?? "ssd"), isRemovable: false,
    filesystem: ok("NTFS"), totalBytes: d.totalGb * GB, freeBytes: d.freeGb * GB, usedBytes: (d.totalGb - d.freeGb) * GB,
    isSystemDrive: d.system ?? false,
  }));

  return {
    schemaVersion: 1, appVersion: "test", scannedAtMs: 1_700_000_000_000, scanDurationMs: 1,
    cpu: threads === null ? no("cpu failed") : ok({
      name: ok("Test CPU"), manufacturer: ok("Test"), physicalCores: ok(spec.cores ?? Math.max(1, threads / 2)),
      logicalProcessors: ok(threads), utilizationPercent: ok(spec.cpuUtil ?? 5), maxClockMhz: ok(spec.clockMhz ?? 4000),
    }),
    gpus: gpuName === null ? no("no adapters") : ok([{
      name: gpuName, manufacturer: ok("Test"), dedicatedVramBytes: ok((spec.vramGb ?? 12) * GB),
      sharedMemoryBytes: ok(8 * GB), utilizationPercent: no(), temperatureC: no(), isSoftware: false,
    }]),
    memory: ramGb === null ? no("memory failed") : ok({
      totalBytes: ramGb * GB, usedBytes: ramGb * GB * (used / 100), availableBytes: ramGb * GB * (1 - used / 100), utilizationPercent: used,
    }),
    storage: driveSpecs === null ? no("storage failed") : ok({
      drives, logicalDriveCount: drives.length,
      systemDriveFreeBytes: ok((drives.find((d) => d.isSystemDrive)?.freeBytes) ?? 0),
    }),
    os: ok({ name: ok("Windows 11 Pro"), version: ok("24H2"), build: ok(spec.build ?? "26100.1"), architecture: "x86_64", uptimeSeconds: (spec.uptimeDays ?? 2) * 86400 }),
    startup: ok({
      entries: startupList.map((name) => ({ name, source: "Registry: HKCU Run", enabled: true })),
      enabledCount: startupList.length, disabledCount: spec.startupDisabled ?? 0,
    }),
    apps: ok({
      count: spec.apps ?? 80, largest: [], appsWithSizeInfo: 0,
      notable: [
        ...(spec.rgb ?? []).map((name) => ({ name, category: "rgb" as const })),
        ...(spec.launchers ?? []).map((name) => ({ name, category: "launcher" as const })),
      ],
    }),
    battery: ok({ present: spec.battery ?? false, percent: no(), onAcPower: no(), charging: no() }),
    network: ok([]),
    processes: ok({ totalCount: 200, topByMemory: (spec.procs ?? ["Code.exe"]).map((name) => ({ name, memoryBytes: GB, cpuPercent: 1 })) }),
    issues: [],
  };
}
