import { valueOf, type ScanReport } from "@/lib/scanTypes";
import { classifyCpu, classifyGpu, type HwClass } from "./hardwareClass";

/**
 * Normalized, nullable facts distilled from a ScanReport. `undefined` always
 * means "not available", never zero. Every engine module reads Facts, not the
 * raw report, so missing data is handled in exactly one place.
 */
export interface Facts {
  cpuName?: string;
  physicalCores?: number;
  logicalThreads?: number;
  maxClockGhz?: number;
  cpuUtilPercent?: number;
  cpuClass?: HwClass;

  gpuName?: string;
  gpuVramGb?: number;
  gpuIntegrated?: boolean;
  gpuClass?: HwClass;
  gpuUtilKnown: boolean;

  /** Nominal installed size (e.g. 32), snapped from usable memory when within 10% below a standard size. */
  ramGb?: number;
  /** Raw usable memory in GB, as Windows reports it (e.g. 31.1). Used for arithmetic. */
  ramUsableGb?: number;
  ramUsedPercent?: number;

  startupEnabled?: number;
  startupDisabled?: number;
  startupNames: string[];

  driveCount?: number;
  systemFreeGb?: number;
  systemFreePercent?: number;
  systemDriveKind?: "ssd" | "hdd";
  lowestFreePercent?: number;
  totalUsedPercent?: number;
  totalStorageTb?: number;
  ssdCount: number;
  hddCount: number;

  appCount?: number;
  rgbApps: string[];
  launchers: string[];

  osName?: string;
  isWindows11?: boolean;
  isWindows10?: boolean;
  uptimeDays?: number;
  hasBattery?: boolean;

  topProcesses: string[];
  browserRunning: boolean;
}

const GB = 1024 ** 3;
const TB = 1024 ** 4;
const STANDARD_RAM_GB = [2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512];

/** Windows reports usable RAM (e.g. 31.1 GB for a 32 GB kit). Snap to the nominal size when close. */
export function nominalRamGb(usableGb: number): number {
  const match = STANDARD_RAM_GB.find((s) => usableGb <= s && usableGb >= s * 0.9);
  return match ?? Math.round(usableGb * 10) / 10;
}

const STANDARD_VRAM_GB = [1, 2, 3, 4, 6, 8, 10, 11, 12, 16, 20, 24, 32, 48];

/** DXGI reports e.g. 15.6 GB for a 16 GB card. Snap to the nominal size when within 10% below. */
export function nominalVramGb(usableGb: number): number {
  const match = STANDARD_VRAM_GB.find((s) => usableGb <= s && usableGb >= s * 0.9);
  return match ?? Math.round(usableGb * 10) / 10;
}

const BROWSERS = /^(chrome|msedge|firefox|brave|opera|vivaldi)/i;

export function extractFacts(scan: ScanReport): Facts {
  const cpu = valueOf(scan.cpu);
  const gpus = valueOf(scan.gpus)?.filter((g) => !g.isSoftware) ?? [];
  const mem = valueOf(scan.memory);
  const storage = valueOf(scan.storage);
  const os = valueOf(scan.os);
  const startup = valueOf(scan.startup);
  const apps = valueOf(scan.apps);
  const battery = valueOf(scan.battery);
  const procs = valueOf(scan.processes);

  // Primary GPU: the adapter with the most dedicated VRAM (discrete wins over integrated).
  const gpu = [...gpus].sort(
    (a, b) => (valueOf(b.dedicatedVramBytes) ?? -1) - (valueOf(a.dedicatedVramBytes) ?? -1),
  )[0];
  const gpuClass = gpu ? classifyGpu(gpu.name) : undefined;
  const vram = gpu ? valueOf(gpu.dedicatedVramBytes) : undefined;

  const cpuThreads = cpu ? valueOf(cpu.logicalProcessors) : undefined;
  const maxClockMhz = cpu ? valueOf(cpu.maxClockMhz) : undefined;

  const drives = storage?.drives.filter((d) => !d.isRemovable) ?? [];
  const sysDrive = drives.find((d) => d.isSystemDrive);
  const totalBytes = drives.reduce((a, d) => a + d.totalBytes, 0);
  const usedBytes = drives.reduce((a, d) => a + d.usedBytes, 0);
  const frees = drives.map((d) => (d.freeBytes / d.totalBytes) * 100);

  const buildNum = parseInt(valueOf(os?.build ?? { status: "unavailable", reason: "" })?.split(".")[0] ?? "", 10);

  return {
    cpuName: cpu ? valueOf(cpu.name) : undefined,
    physicalCores: cpu ? valueOf(cpu.physicalCores) : undefined,
    logicalThreads: cpuThreads,
    maxClockGhz: maxClockMhz !== undefined ? maxClockMhz / 1000 : undefined,
    cpuUtilPercent: cpu ? valueOf(cpu.utilizationPercent) : undefined,
    cpuClass: cpuThreads !== undefined ? classifyCpu(cpuThreads, maxClockMhz) : undefined,

    gpuName: gpu?.name,
    gpuVramGb: vram !== undefined ? nominalVramGb(vram / GB) : undefined,
    gpuIntegrated: gpuClass ? gpuClass.tier === 0 : undefined,
    gpuClass,
    gpuUtilKnown: gpus.some((g) => valueOf(g.utilizationPercent) !== undefined),

    ramGb: mem ? nominalRamGb(mem.totalBytes / GB) : undefined,
    ramUsableGb: mem ? mem.totalBytes / GB : undefined,
    ramUsedPercent: mem?.utilizationPercent,

    startupEnabled: startup?.enabledCount,
    startupDisabled: startup?.disabledCount,
    startupNames: startup?.entries.filter((e) => e.enabled).map((e) => e.name) ?? [],

    driveCount: storage?.logicalDriveCount,
    systemFreeGb: sysDrive ? sysDrive.freeBytes / GB : undefined,
    systemFreePercent: sysDrive ? (sysDrive.freeBytes / sysDrive.totalBytes) * 100 : undefined,
    systemDriveKind: sysDrive ? valueOf(sysDrive.kind) : undefined,
    lowestFreePercent: frees.length ? Math.min(...frees) : undefined,
    totalUsedPercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : undefined,
    totalStorageTb: totalBytes > 0 ? totalBytes / TB : undefined,
    ssdCount: drives.filter((d) => valueOf(d.kind) === "ssd").length,
    hddCount: drives.filter((d) => valueOf(d.kind) === "hdd").length,

    appCount: apps?.count,
    rgbApps: apps?.notable.filter((n) => n.category === "rgb").map((n) => n.name) ?? [],
    launchers: apps?.notable.filter((n) => n.category === "launcher").map((n) => n.name) ?? [],

    osName: os ? valueOf(os.name) : undefined,
    isWindows11: Number.isFinite(buildNum) ? buildNum >= 22000 : undefined,
    isWindows10: Number.isFinite(buildNum) ? buildNum < 22000 : undefined,
    uptimeDays: os ? os.uptimeSeconds / 86400 : undefined,
    hasBattery: battery?.present,

    topProcesses: procs?.topByMemory.map((p) => p.name) ?? [],
    browserRunning: procs?.topByMemory.some((p) => BROWSERS.test(p.name)) ?? false,
  };
}
