import { valueOf, type ScanReport } from "./scanTypes";
import { formatUptime } from "./format";
import { nominalRamGb, nominalVramGb } from "@/engine/facts";

export interface Discovery {
  id: string;
  label: string;
  /** What was found, or why it could not be read. */
  text: string;
  status: "found" | "unavailable";
}

const GB = 1024 ** 3;

/**
 * Turns a REAL scan into the ordered list of findings shown on the
 * Investigation screen. Nothing is invented: unavailable sections are listed
 * as unavailable with their reason.
 */
export function buildDiscoveries(scan: ScanReport): Discovery[] {
  const out: Discovery[] = [];
  const found = (id: string, label: string, text: string) => out.push({ id, label, text, status: "found" });
  const missing = (id: string, label: string, reason: string) => out.push({ id, label, text: reason, status: "unavailable" });

  const cpu = valueOf(scan.cpu);
  if (cpu) {
    const name = valueOf(cpu.name) ?? "Unknown processor";
    const cores = valueOf(cpu.physicalCores);
    const threads = valueOf(cpu.logicalProcessors);
    found("cpu", "Processor", `${name}${cores !== undefined && threads !== undefined ? ` · ${cores} cores / ${threads} threads` : ""}`);
  } else missing("cpu", "Processor", scan.cpu.status === "unavailable" ? scan.cpu.reason : "unavailable");

  const gpus = valueOf(scan.gpus)?.filter((g) => !g.isSoftware);
  if (gpus && gpus.length) {
    for (const g of gpus) {
      const vram = valueOf(g.dedicatedVramBytes);
      found(`gpu-${g.name}`, "Graphics", `${g.name}${vram ? ` · ${nominalVramGb(vram / GB)} GB VRAM` : ""}`);
    }
  } else missing("gpu", "Graphics", scan.gpus.status === "unavailable" ? scan.gpus.reason : "no hardware graphics adapter reported");

  const mem = valueOf(scan.memory);
  if (mem) found("ram", "Memory", `${nominalRamGb(mem.totalBytes / GB)} GB · ${Math.round(mem.utilizationPercent)}% in use`);
  else missing("ram", "Memory", scan.memory.status === "unavailable" ? scan.memory.reason : "unavailable");

  const st = valueOf(scan.storage);
  if (st) {
    const sys = st.drives.find((d) => d.isSystemDrive);
    found("storage", "Storage", `${st.logicalDriveCount} drive${st.logicalDriveCount === 1 ? "" : "s"}${sys ? ` · system drive ${Math.round((sys.freeBytes / sys.totalBytes) * 100)}% free` : ""}`);
  } else missing("storage", "Storage", scan.storage.status === "unavailable" ? scan.storage.reason : "unavailable");

  const os = valueOf(scan.os);
  if (os) {
    found("os", "Operating system", `${valueOf(os.name) ?? "Windows"} ${valueOf(os.version) ?? ""} · up ${formatUptime(os.uptimeSeconds)}`.replace(/\s+·/, " ·"));
  } else missing("os", "Operating system", scan.os.status === "unavailable" ? scan.os.reason : "unavailable");

  const su = valueOf(scan.startup);
  if (su) found("startup", "Startup", `${su.enabledCount} app${su.enabledCount === 1 ? "" : "s"} start with Windows${su.disabledCount ? ` (${su.disabledCount} disabled)` : ""}`);
  else missing("startup", "Startup", scan.startup.status === "unavailable" ? scan.startup.reason : "unavailable");

  const apps = valueOf(scan.apps);
  if (apps) found("apps", "Applications", `${apps.count} installed${apps.notable.length ? ` · spotted ${apps.notable.length} gaming/peripheral suite${apps.notable.length === 1 ? "" : "s"}` : ""}`);
  else missing("apps", "Applications", scan.apps.status === "unavailable" ? scan.apps.reason : "unavailable");

  const bat = valueOf(scan.battery);
  if (bat) found("battery", "Power", bat.present ? "Battery present (portable PC)" : "No battery (desktop)");

  const procs = valueOf(scan.processes);
  if (procs) found("procs", "Processes", `${procs.totalCount} running${procs.topByMemory[0] ? ` · biggest: ${procs.topByMemory[0].name}` : ""}`);
  else missing("procs", "Processes", scan.processes.status === "unavailable" ? scan.processes.reason : "unavailable");

  return out;
}
