import { useState, type ReactNode } from "react";
import { Check, ClipboardCopy, Cpu, RefreshCw } from "lucide-react";
import { buildSpecSheet } from "@/lib/specSheet";
import { useApp } from "@/app/state";
import { Button, EmptyState, Panel, ScreenHeader } from "@/components/ui";
import { formatBytes, formatUptime, reasonOf, show } from "@/lib/format";
import type { Reading } from "@/lib/scanTypes";

function Row({ label, value, reason }: { label: string; value: string; reason?: string }) {
  const missing = value === "Unavailable";
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/40 py-1.5 text-sm last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className={missing ? "text-muted italic" : ""} title={reason}>{value}</dd>
    </div>
  );
}

function R<T>({ label, r, fmt }: { label: string; r: Reading<T>; fmt?: (v: T) => string }) {
  return <Row label={label} value={show(r, fmt)} reason={reasonOf(r)} />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="p-5">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </Panel>
  );
}

function Failed({ r }: { r: Reading<unknown> }) {
  return <p className="text-sm text-muted italic">Unavailable: {reasonOf(r)}</p>;
}

export function Hardware() {
  const { scan, scanning, scanError, startScan } = useApp();
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");

  const copySpecs = async () => {
    if (!scan) return;
    try {
      await navigator.clipboard.writeText(buildSpecSheet(scan));
      setCopy("done");
    } catch {
      setCopy("failed");
    }
    setTimeout(() => setCopy("idle"), 2000);
  };

  const header = (
    <div className="flex items-start justify-between gap-4">
      <ScreenHeader title="Hardware Details" subtitle="Read-only measurements taken from this PC." />
      <div className="flex shrink-0 gap-2">
        {scan && (
          <Button variant="ghost" onClick={() => void copySpecs()} title="Copies CPU, GPU, RAM, storage and Windows version as plain text, ready to paste into a forum or chat">
            {copy === "done" ? <Check size={16} aria-hidden /> : <ClipboardCopy size={16} aria-hidden />}
            {copy === "done" ? "Copied" : copy === "failed" ? "Copy unavailable" : "Copy specs"}
          </Button>
        )}
        <Button variant="ghost" onClick={startScan} disabled={scanning}>
          <RefreshCw size={16} className={scanning ? "animate-spin" : ""} aria-hidden />
          {scan ? "Rescan" : "Run scan"}
        </Button>
      </div>
    </div>
  );

  if (!scan) {
    return (
      <div className="animate-rise">
        {header}
        {scanError && <p role="alert" className="mb-4 rounded-xl border border-bad/50 p-3 text-sm text-bad">{scanError}</p>}
        <EmptyState icon={Cpu} title={scanning ? "Scanning…" : "No scan yet"}
          body="Press “Run scan” to read your hardware. Nothing leaves this device." />
      </div>
    );
  }

  const { cpu, gpus, memory, storage, os, startup, apps, battery, network, processes, issues } = scan;
  return (
    <div className="animate-rise space-y-4">
      {header}
      <p className="text-xs text-muted">
        Scanned {new Date(scan.scannedAtMs).toLocaleString()} in {scan.scanDurationMs} ms · “Unavailable” means Windows did not provide the value, not that it is zero.
      </p>
      {issues.length > 0 && (
        <Panel className="border-warn/40 p-4 text-sm">
          <h2 className="mb-1 font-semibold text-warn">Collection issues</h2>
          <ul className="list-disc ps-5 text-muted">{issues.map((i, n) => <li key={n}>{i.section}: {i.message}</li>)}</ul>
        </Panel>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Section title="CPU">
          {cpu.status === "available" ? (
            <dl>
              <R label="Processor" r={cpu.value.name} />
              <R label="Manufacturer" r={cpu.value.manufacturer} />
              <R label="Physical cores" r={cpu.value.physicalCores} />
              <R label="Logical processors" r={cpu.value.logicalProcessors} />
              <R label="Utilization" r={cpu.value.utilizationPercent} fmt={(v) => `${v.toFixed(0)}%`} />
              <R label="Rated max clock" r={cpu.value.maxClockMhz} fmt={(v) => `${(v / 1000).toFixed(2)} GHz`} />
            </dl>
          ) : <Failed r={cpu} />}
        </Section>

        <Section title="Memory">
          {memory.status === "available" ? (
            <dl>
              <Row label="Total" value={formatBytes(memory.value.totalBytes)} />
              <Row label="Used" value={formatBytes(memory.value.usedBytes)} />
              <Row label="Available" value={formatBytes(memory.value.availableBytes)} />
              <Row label="Utilization" value={`${memory.value.utilizationPercent.toFixed(0)}%`} />
            </dl>
          ) : <Failed r={memory} />}
        </Section>

        <Section title="Graphics">
          {gpus.status === "available" ? gpus.value.map((g, i) => (
            <dl key={`${i}-${g.name}`} className="mb-3 last:mb-0">
              <Row label="Adapter" value={g.isSoftware ? `${g.name} (software)` : g.name} />
              <R label="Manufacturer" r={g.manufacturer} />
              <R label="Dedicated VRAM" r={g.dedicatedVramBytes} fmt={formatBytes} />
              <R label="Shared memory" r={g.sharedMemoryBytes} fmt={formatBytes} />
              <R label="Utilization" r={g.utilizationPercent} fmt={(v) => `${v}%`} />
              <R label="Temperature" r={g.temperatureC} fmt={(v) => `${v}°C`} />
            </dl>
          )) : <Failed r={gpus} />}
        </Section>

        <Section title="Operating system">
          {os.status === "available" ? (
            <dl>
              <R label="Windows" r={os.value.name} />
              <R label="Version" r={os.value.version} />
              <R label="Build" r={os.value.build} />
              <Row label="Architecture" value={os.value.architecture} />
              <Row label="Uptime" value={formatUptime(os.value.uptimeSeconds)} />
            </dl>
          ) : <Failed r={os} />}
        </Section>

        <Section title="Storage">
          {storage.status === "available" ? (
            <dl>
              <Row label="Logical drives" value={String(storage.value.logicalDriveCount)} />
              <R label="System drive free" r={storage.value.systemDriveFreeBytes} fmt={formatBytes} />
              {storage.value.drives.map((d) => (
                <Row key={d.mountPoint}
                  label={`${d.mountPoint} ${show(d.kind, (k) => k.toUpperCase())} ${show(d.filesystem)}`}
                  value={`${formatBytes(d.freeBytes)} free of ${formatBytes(d.totalBytes)}`} />
              ))}
            </dl>
          ) : <Failed r={storage} />}
        </Section>

        <Section title="Startup">
          {startup.status === "available" ? (
            <>
              <dl>
                <Row label="Enabled entries" value={String(startup.value.enabledCount)} />
                <Row label="Disabled entries" value={String(startup.value.disabledCount)} />
              </dl>
              {/* Scrollable: keyboard-focusable and labelled so it can be scrolled without a mouse (WCAG 2.1.1) */}
              <ul tabIndex={0} aria-label="Startup entries" className="mt-2 max-h-40 overflow-y-auto rounded-lg text-xs text-muted focus-visible:ring-2 focus-visible:ring-accent">
                {startup.value.entries.map((e, i) => (
                  <li key={i}>{e.enabled ? "●" : "○"} {e.name} — {e.source}</li>
                ))}
              </ul>
            </>
          ) : <Failed r={startup} />}
        </Section>

        <Section title="Installed applications">
          {apps.status === "available" ? (
            <>
              <dl>
                <Row label="Applications" value={String(apps.value.count)} />
                <Row label="With size info" value={String(apps.value.appsWithSizeInfo)} />
              </dl>
              <ul className="mt-2 text-xs text-muted">
                {apps.value.largest.slice(0, 5).map((a, i) => (
                  <li key={`${i}-${a.name}`}>{a.name} — {formatBytes(a.sizeBytes ?? 0)}</li>
                ))}
              </ul>
            </>
          ) : <Failed r={apps} />}
        </Section>

        <Section title="Battery & network">
          {battery.status === "available" && (
            <dl>
              <Row label="Battery" value={battery.value.present ? "Present" : "None (desktop)"} />
              {battery.value.present && <R label="Charge" r={battery.value.percent} fmt={(v) => `${v}%`} />}
            </dl>
          )}
          {network.status === "available" ? (
            <dl className="mt-2">
              {network.value.map((n, i) => (
                <Row key={`${i}-${n.name}`} label={n.name}
                  value={`${show(n.connected, (c) => (c ? "connected" : "disconnected"))}${n.speedBitsPerSec.status === "available" ? ` · ${(n.speedBitsPerSec.value / 1e6).toFixed(0)} Mbps` : ""}`} />
              ))}
            </dl>
          ) : <Failed r={network} />}
        </Section>

        <Section title="Processes">
          {processes.status === "available" ? (
            <>
              <dl><Row label="Running" value={String(processes.value.totalCount)} /></dl>
              <ul className="mt-2 text-xs text-muted">
                {processes.value.topByMemory.map((p, i) => <li key={`${i}-${p.name}`}>{p.name} — {formatBytes(p.memoryBytes)}</li>)}
              </ul>
            </>
          ) : <Failed r={processes} />}
        </Section>
      </div>
    </div>
  );
}
