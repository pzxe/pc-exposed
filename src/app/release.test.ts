import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/** Release-readiness guards: versions in sync, required repo files present, safe workflows, no permission creep. */
const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const json = (p: string) => JSON.parse(read(p)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe("version consistency", () => {
  const pkg = json("package.json").version as string;
  const tauri = json("src-tauri/tauri.conf.json").version as string;
  const cargo = /^version\s*=\s*"([^"]+)"/m.exec(read("src-tauri/Cargo.toml"))![1];
  const lock = /name = "pc-exposed"\r?\nversion = "([^"]+)"/.exec(read("src-tauri/Cargo.lock"))?.[1];

  it("package.json, Cargo.toml, Cargo.lock and tauri.conf.json agree", () => {
    expect(new Set([pkg, tauri, cargo, lock]).size, JSON.stringify({ pkg, tauri, cargo, lock })).toBe(1);
  });

  it("is a valid semantic version (the initial development version is 0.1.0-beta.1)", () => {
    expect(pkg).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
    expect(pkg).toBe("0.1.0-beta.1");
  });

  it("the changelog has a section for this version", () => {
    expect(read("CHANGELOG.md")).toContain(`## [${pkg}]`);
  });

  it("the Rust app info reports the same version", () => {
    expect(read("src-tauri/src/app_info.rs")).toContain(`assert_eq!(info.version, "${pkg}")`);
  });
});

describe("repository files", () => {
  const required = [
    "LICENSE", "README.md", "SECURITY.md", "CONTRIBUTING.md", "CHANGELOG.md", "THIRD_PARTY_LICENSES.md",
    "docs/PRIVACY.md", "docs/ARCHITECTURE.md", "docs/SECURITY_REVIEW.md", "docs/RELEASING.md", "docs/report-format.md",
    "docs/localization.md", "docs/ACCESSIBILITY.md",
    ".github/workflows/ci.yml", ".github/workflows/release.yml", ".github/dependabot.yml",
    ".github/PULL_REQUEST_TEMPLATE.md", ".github/ISSUE_TEMPLATE/bug_report.yml", ".github/ISSUE_TEMPLATE/feature_request.yml",
  ];
  it.each(required)("%s exists and is not empty", (f) => {
    expect(existsSync(join(ROOT, f)), f).toBe(true);
    expect(read(f).trim().length).toBeGreaterThan(50);
  });

  it("is MIT licensed", () => {
    expect(read("LICENSE")).toMatch(/^MIT License/);
    expect(json("package.json").license).toBe("MIT");
    expect(read("src-tauri/Cargo.toml")).toMatch(/license\s*=\s*"MIT"/);
  });

  it("README embeds screenshots that exist", () => {
    const md = read("README.md");
    const refs = [
      ...md.matchAll(/!\[[^\]]*\]\((docs\/screenshots\/[^)]+)\)/g), // markdown images
      ...md.matchAll(/<img[^>]*src="(docs\/screenshots\/[^"]+)"/g), // HTML images
    ].map((m) => m[1]);
    expect(refs.length).toBeGreaterThanOrEqual(5);
    for (const r of refs) expect(existsSync(join(ROOT, r)), r).toBe(true);
  });

  it("documentation never invents a repository URL or username", () => {
    const docs = ["README.md", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md", ...readdirSync(join(ROOT, "docs")).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`)];
    const offenders = docs.filter((f) => /github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(read(f)));
    expect(offenders).toEqual([]);
  });
});

describe("GitHub configuration is valid YAML", () => {
  it("every file under .github parses, and every workflow has triggers, least-privilege permissions, and bounded jobs", async () => {
    const { createRequire } = await import("node:module");
    const { yaml } = createRequire(import.meta.url)("playwright-core/lib/utilsBundle");
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : files.push(join(d, e.name))));
    walk(join(ROOT, ".github"));
    const yml = files.filter((f) => /\.ya?ml$/.test(f));
    expect(yml.length).toBeGreaterThanOrEqual(6);
    for (const f of yml) {
      const doc = yaml.parse(readFileSync(f, "utf8"));
      expect(doc, f).toBeTruthy();
      if (/workflows/.test(f)) {
        expect(doc.on, `${f}: on`).toBeTruthy();
        expect(doc.permissions, `${f}: permissions`).toBeTruthy();
        for (const [name, job] of Object.entries<any>(doc.jobs)) { // eslint-disable-line @typescript-eslint/no-explicit-any
          expect(job["runs-on"], `${f}:${name} runs-on`).toBeTruthy();
          expect(job["timeout-minutes"], `${f}:${name} timeout`).toBeGreaterThan(0);
          expect(job.steps.length, `${f}:${name} steps`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("workflows are safe by construction", () => {
  const ci = read(".github/workflows/ci.yml");
  const rel = read(".github/workflows/release.yml");

  it("CI is read-only and never uses pull_request_target", () => {
    expect(ci).toMatch(/permissions:\s*\n\s+contents: read/);
    expect(ci + rel).not.toContain("pull_request_target");
  });

  it("the release workflow only ever creates a DRAFT, and only from a version tag or manual run", () => {
    expect(rel).toContain("releaseDraft: true");
    expect(rel).not.toMatch(/releaseDraft:\s*false/);
    expect(rel).toMatch(/tags: \["v\*"\]/);
    expect(rel).toContain("workflow_dispatch");
  });

  it("checksum file names match the names GitHub serves (spaces become dots)", () => {
    // Found by downloading the first draft release: the file said "PC EXPOSED_..." but GitHub serves "PC.EXPOSED_...".
    expect(rel).toMatch(/\(\$_\.Name -replace ' ', '\.'\)/);
  });

  it("the checksum file is written with LF endings and no BOM, so `sha256sum -c` works on Linux/macOS", () => {
    expect(rel).toContain("UTF8Encoding]::new($false)");
    expect(rel).toMatch(/-join "`n"/);
    expect(rel).not.toMatch(/Set-Content SHA256SUMS/); // Set-Content writes CRLF on Windows
  });

  it("the release workflow checks the tag against the app version", () => {
    expect(rel).toMatch(/Tag \(\$TAG\) does not match/);
  });

  it("actions are pinned to a major version at minimum and secrets come from the standard token", () => {
    // dtolnay/rust-toolchain is the one documented exception: its ref selects the Rust channel ("stable").
    for (const m of (ci + rel).matchAll(/uses:\s*([^\s@]+)@(\S+)/g)) {
      if (m[1] === "dtolnay/rust-toolchain") continue;
      expect(m[2], m[0]).toMatch(/^v?\d+/);
    }
    expect(ci + rel).not.toMatch(/secrets\.(?!GITHUB_TOKEN)/);
  });
});

describe("hardening configuration cannot silently regress", () => {
  const conf = json("src-tauri/tauri.conf.json");
  const csp = conf.app.security.csp as string;

  it("CSP forbids eval, remote origins, plugins and frames", () => {
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toMatch(/https?:\/\/(?!ipc\.localhost)/);
    for (const d of ["object-src 'none'", "frame-src 'none'", "base-uri 'none'", "form-action 'none'", "worker-src 'none'"]) expect(csp).toContain(d);
    expect(csp).toMatch(/connect-src 'self' ipc: http:\/\/ipc\.localhost;/);
  });

  it("the webview capability set is window controls only (no fs, shell, dialog, http)", () => {
    const cap = json("src-tauri/capabilities/default.json");
    expect(cap.windows).toEqual(["main"]);
    for (const p of cap.permissions as string[]) expect(p, p).toMatch(/^core:(window|event):/);
    expect(JSON.stringify(cap)).not.toMatch(/fs:|shell:|http:|dialog:|opener:|process:/);
  });

  it("the bundle targets a per-user Windows installer that needs no administrator rights", () => {
    // MSI (WiX) rejects pre-release versions like "beta.1" (numeric-only identifiers), so it is added at the first stable release.
    expect(conf.bundle.targets).toContain("nsis");
    if (/-/.test(conf.version)) expect(conf.bundle.targets).not.toContain("msi");
    expect(conf.bundle.windows.nsis.installMode).toBe("currentUser");
    expect(conf.app.withGlobalTauri).toBe(false);
  });

  it("Rust has no HTTP client dependency", () => {
    const toml = read("src-tauri/Cargo.toml");
    for (const c of ["reqwest", "hyper", "ureq", "isahc", "surf", "attohttpc"]) expect(toml).not.toMatch(new RegExp(`^${c}\\s*=`, "m"));
  });
});
