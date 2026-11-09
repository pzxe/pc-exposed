import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ScanSearch, type LucideIcon } from "lucide-react";
import { useApp } from "@/app/state";
import { useI18n } from "@/i18n";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-panel border border-border/70 bg-gradient-to-b from-surface to-surface/70 p-6 ${className}`}>
      {children}
    </section>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  const v =
    variant === "primary"
      ? "bg-accent text-bg hover:bg-accent-soft shadow-glow"
      : "border border-border bg-surface text-ink hover:bg-surface-2";
  return <button type="button" className={`${base} ${v} ${className}`} {...p} />;
}

/** Screen title. It is the h1 and receives focus when the screen changes, so assistive tech announces the new screen. */
export function ScreenHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 tabIndex={-1} data-screen-title className="font-display text-3xl font-bold tracking-tight outline-none">{title}</h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
    </div>
  );
}

/** Generic empty state with an optional action. */
export function EmptyState({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body: string; children?: ReactNode }) {
  return (
    <Panel className="flex flex-col items-center gap-3 py-16 text-center">
      <Icon size={36} className="text-accent" aria-hidden />
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted">{body}</p>
      {children}
    </Panel>
  );
}

/** Shown on result screens before any scan exists. Offers to run one. */
export function NeedsScan({ title }: { title: string }) {
  const { scanning, scanError, startScan, go } = useApp();
  const { t } = useI18n();
  return (
    <EmptyState icon={ScanSearch} title={title} body={t("needsScan.body")}>
      {scanError && <p role="alert" className="text-sm text-bad">{scanError}</p>}
      <Button disabled={scanning} onClick={() => { go("investigation"); void startScan(); }}>
        {scanning ? t("common.scanning") : t("common.exposeMyPc")}
      </Button>
    </EmptyState>
  );
}
