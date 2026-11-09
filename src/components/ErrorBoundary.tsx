import { Component, type ErrorInfo, type ReactNode } from "react";
import { translate } from "@/i18n";

/**
 * Last-resort boundary: a render crash shows a calm message and a reload
 * button instead of a blank window. The error is logged to the console only
 * (never transmitted). It deliberately avoids hooks so it can always render.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; locale?: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("PC EXPOSED render error:", error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    const t = (k: string) => translate(this.props.locale ?? document.documentElement.lang ?? "en", k);
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 bg-bg p-8 text-center text-ink">
        <h1 className="font-display text-2xl font-bold">{t("error.title")}</h1>
        <p className="max-w-md text-sm text-muted">{t("error.body")}</p>
        <button type="button" onClick={() => location.reload()} className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-bg">{t("error.reload")}</button>
      </div>
    );
  }
}
