import { valueOf, type ScanReport } from "./scanTypes";
import { nominalRamGb, nominalVramGb } from "@/engine/facts";

const GB = 1024 ** 3;

const size = (bytes: number): string => {
  const gb = bytes / GB;
  return gb >= 1024 ? `${(gb / 1024).toFixed(gb >= 10240 ? 0 : 1)} TB` : `${Math.round(gb)} GB`;
};

/**
 * A plain-text spec sheet for pasting into a forum post or chat, built only from the real scan.
 * Unavailable values are omitted rather than guessed. Contains no app, process or network names.
 */
export function buildSpecSheet(scan: ScanReport): string {
  const lines: string[] = [];

  const cpu = valueOf(scan.cpu);
  if (cpu) {
    const name = valueOf(cpu.name);
    const cores = valueOf(cpu.physicalCores), threads = valueOf(cpu.logicalProcessors);
    const clock = valueOf(cpu.maxClockMhz);
    const extra = [cores !== undefined && threads !== undefined ? `${cores}C/${threads}T` : threads !== undefined ? `${threads} threads` : undefined,
      clock ? `${(clock / 1000).toFixed(2)} GHz` : undefined].filter(Boolean).join(", ");
    if (name || extra) lines.push(`CPU: ${name ?? "Unknown processor"}${extra ? ` (${extra})` : ""}`);
  }

  const gpus = valueOf(scan.gpus)?.filter((g) => !g.isSoftware) ?? [];
  for (const g of gpus) {
    const vram = valueOf(g.dedicatedVramBytes);
    lines.push(`GPU: ${g.name}${vram && vram >= GB ? ` (${nominalVramGb(vram / GB)} GB)` : ""}`);
  }

  const mem = valueOf(scan.memory);
  if (mem) lines.push(`RAM: ${nominalRamGb(mem.totalBytes / GB)} GB`);

  const st = valueOf(scan.storage);
  if (st) {
    const drives = st.drives.filter((d) => !d.isRemovable).map((d) => {
      const kind = valueOf(d.kind);
      return `${d.mountPoint.replace(/\\$/, "")} ${size(d.totalBytes)}${kind ? ` ${kind.toUpperCase()}` : ""} (${Math.round((d.freeBytes / d.totalBytes) * 100)}% free)`;
    });
    if (drives.length) lines.push(`Storage: ${drives.join(", ")}`);
  }

  const os = valueOf(scan.os);
  if (os) {
    const name = valueOf(os.name), ver = valueOf(os.version), build = valueOf(os.build);
    if (name || ver || build) lines.push(`OS: ${[name ?? "Windows", ver].filter(Boolean).join(" ")}${build ? ` (build ${build})` : ""}`);
  }

  const bat = valueOf(scan.battery);
  if (bat) lines.push(`Form factor: ${bat.present ? "laptop / portable (battery present)" : "desktop (no battery)"}`);

  return [...lines, "", "Read locally with PC EXPOSED"].join("\n");
}
