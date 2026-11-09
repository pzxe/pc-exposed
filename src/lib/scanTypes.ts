/** Mirrors src-tauri/src/collect/model.rs. Keep in sync (schemaVersion guards drift). */

export type Reading<T> = { status: "available"; value: T } | { status: "unavailable"; reason: string };

export interface CpuInfo {
  name: Reading<string>;
  manufacturer: Reading<string>;
  physicalCores: Reading<number>;
  logicalProcessors: Reading<number>;
  utilizationPercent: Reading<number>;
  maxClockMhz: Reading<number>;
}
export interface GpuInfo {
  name: string;
  manufacturer: Reading<string>;
  dedicatedVramBytes: Reading<number>;
  sharedMemoryBytes: Reading<number>;
  utilizationPercent: Reading<number>;
  temperatureC: Reading<number>;
  isSoftware: boolean;
}
export interface MemoryInfo { totalBytes: number; usedBytes: number; availableBytes: number; utilizationPercent: number }
export type DriveKind = "ssd" | "hdd";
export interface DriveInfo {
  mountPoint: string; label: Reading<string>; kind: Reading<DriveKind>; isRemovable: boolean;
  filesystem: Reading<string>; totalBytes: number; freeBytes: number; usedBytes: number; isSystemDrive: boolean;
}
export interface StorageInfo { drives: DriveInfo[]; logicalDriveCount: number; systemDriveFreeBytes: Reading<number> }
export interface OsInfo { name: Reading<string>; version: Reading<string>; build: Reading<string>; architecture: string; uptimeSeconds: number }
export interface StartupEntry { name: string; source: string; enabled: boolean }
export interface StartupInfo { entries: StartupEntry[]; enabledCount: number; disabledCount: number }
export interface InstalledApp { name: string; publisher: string | null; sizeBytes: number | null }
export interface NotableApp { name: string; category: "rgb" | "launcher" }
export interface AppsInfo { count: number; notable: NotableApp[]; largest: InstalledApp[]; appsWithSizeInfo: number }
export interface BatteryInfo { present: boolean; percent: Reading<number>; onAcPower: Reading<boolean>; charging: Reading<boolean> }
export interface NetworkAdapter { name: string; connected: Reading<boolean>; speedBitsPerSec: Reading<number> }
export interface ProcessUsage { name: string; memoryBytes: number; cpuPercent: number }
export interface ProcessesInfo { totalCount: number; topByMemory: ProcessUsage[] }
export interface CollectionIssue { section: string; message: string }

export interface ScanReport {
  schemaVersion: number;
  appVersion: string;
  scannedAtMs: number;
  scanDurationMs: number;
  cpu: Reading<CpuInfo>;
  gpus: Reading<GpuInfo[]>;
  memory: Reading<MemoryInfo>;
  storage: Reading<StorageInfo>;
  os: Reading<OsInfo>;
  startup: Reading<StartupInfo>;
  apps: Reading<AppsInfo>;
  battery: Reading<BatteryInfo>;
  network: Reading<NetworkAdapter[]>;
  processes: Reading<ProcessesInfo>;
  issues: CollectionIssue[];
}

export const SUPPORTED_SCHEMA_VERSION = 1;

/** Returns the value, or undefined when the reading is unavailable. */
export function valueOf<T>(r: Reading<T> | undefined): T | undefined {
  return r && r.status === "available" ? r.value : undefined;
}
