import { invoke, isTauri } from "@tauri-apps/api/core";
import { SUPPORTED_SCHEMA_VERSION, type ScanReport } from "./scanTypes";

/** Mirrors `AppInfo` in src-tauri/src/app_info.rs. Keep in sync. */
export interface AppInfo {
  name: string;
  version: string;
  license: string;
  os: string;
  arch: string;
}

/** True when running inside the Tauri shell (false in a plain browser/dev preview). */
export const inTauri = (): boolean => {
  try {
    return isTauri();
  } catch {
    return false;
  }
};

/** Runs the native read-only scan. Throws outside Tauri or on schema mismatch. */
export async function runScan(): Promise<ScanReport> {
  if (!inTauri()) throw new Error("Scanning needs the desktop app. It is not available in a browser preview.");
  const report = await invoke<ScanReport>("run_scan");
  if (report.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(`Unsupported scan schema version ${report.schemaVersion}`);
  }
  return report;
}

/** Returns native app info, or null when not running inside Tauri. */
export async function getAppInfo(): Promise<AppInfo | null> {
  if (!inTauri()) return null;
  return invoke<AppInfo>("get_app_info");
}

/**
 * Saves PNG bytes. In the desktop app this opens the native Save dialog (the
 * webview itself has no filesystem access). Returns the saved path, or null if
 * the user cancelled. In a browser preview it falls back to a normal download.
 */
export async function savePng(blob: Blob, fileName: string): Promise<string | null> {
  if (inTauri()) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return invoke<string | null>("save_share_image", bytes, { headers: { "x-file-name": fileName } });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}

/**
 * Saves an exported report (JSON). Desktop: native Save dialog via a validated
 * command (the webview has no filesystem access). Browser preview: a normal download.
 */
export async function saveReportJson(json: string, fileName: string): Promise<string | null> {
  const bytes = new TextEncoder().encode(json);
  if (inTauri()) {
    return invoke<string | null>("save_report_file", bytes, { headers: { "x-file-name": fileName } });
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}
