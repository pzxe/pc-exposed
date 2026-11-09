/**
 * Update-check architecture.
 *
 * PC EXPOSED makes NO network requests, so there is no default provider and
 * nothing is checked automatically. This module defines the seam a release
 * build can plug a provider into (for example one that reads a GitHub Releases
 * feed after the user clicks "Check for updates"). The CSP would also need to
 * allow that single host; see docs/ARCHITECTURE.md.
 */
export interface ReleaseInfo {
  version: string;
  notesUrl?: string;
}

export interface UpdateProvider {
  id: string;
  /** Returns the latest release, or null if none is published. Called only on explicit user action. */
  latest(): Promise<ReleaseInfo | null>;
}

export type UpdateCheckResult =
  | { status: "disabled" }
  | { status: "up-to-date"; current: string }
  | { status: "available"; current: string; release: ReleaseInfo }
  | { status: "error"; message: string };

/** Semantic-version comparison including pre-release identifiers. Returns <0, 0 or >0. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(v.trim());
    if (!m) throw new Error(`Invalid version "${v}"`);
    return { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ? m[4].split(".") : [] };
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] - y.core[i];
  if (x.pre.length === 0 || y.pre.length === 0) return x.pre.length === y.pre.length ? 0 : x.pre.length === 0 ? 1 : -1; // a release outranks its pre-releases
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn) { if (Number(p) !== Number(q)) return Number(p) - Number(q); }
    else if (pn !== qn) return pn ? -1 : 1; // numeric identifiers sort before alphanumeric
    else if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

export async function checkForUpdates(current: string, provider: UpdateProvider | null): Promise<UpdateCheckResult> {
  if (!provider) return { status: "disabled" };
  try {
    const release = await provider.latest();
    if (!release || compareVersions(release.version, current) <= 0) return { status: "up-to-date", current };
    return { status: "available", current, release };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

/** No provider by default: the app never contacts a server on its own. */
export const DEFAULT_UPDATE_PROVIDER: UpdateProvider | null = null;
