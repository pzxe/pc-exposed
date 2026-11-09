// Generates THIRD_PARTY_LICENSES.md from the real dependency graphs.
//   - npm: production dependency tree (what ships in the app bundle)
//   - Rust: crates in the x86_64-pc-windows-msvc build graph
// Usage: node scripts/generate-licenses.mjs            (writes the file)
//        node scripts/generate-licenses.mjs --check    (exits 1 if the file is out of date)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "THIRD_PARTY_LICENSES.md");
const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, shell: process.platform === "win32" && cmd === "npm" });

// ---- npm (production, whole tree) ----
const npmPaths = sh("npm", ["ls", "--omit=dev", "--all", "--parseable"], root).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const npm = new Map();
for (const p of npmPaths) {
  const f = join(p, "package.json");
  if (p === root || !existsSync(f)) continue;
  const j = JSON.parse(readFileSync(f, "utf8"));
  const lic = typeof j.license === "string" ? j.license : j.license?.type ?? (Array.isArray(j.licenses) ? j.licenses.map((l) => l.type).join(" OR ") : "UNKNOWN");
  npm.set(`${j.name}@${j.version}`, lic);
}

// ---- Rust ----
const meta = JSON.parse(sh("cargo", ["metadata", "--format-version", "1", "--filter-platform", "x86_64-pc-windows-msvc"], join(root, "src-tauri")));
const ids = new Set(meta.resolve.nodes.map((n) => n.id));
const rust = new Map();
for (const p of meta.packages) {
  if (!ids.has(p.id) || p.name === "pc-exposed") continue;
  rust.set(`${p.name}@${p.version}`, p.license ?? (p.license_file ? `see ${p.license_file}` : "UNKNOWN"));
}

const group = (m) => {
  const g = new Map();
  for (const [k, v] of m) g.set(v, [...(g.get(v) ?? []), k]);
  return [...g.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
};
const section = (title, m) =>
  `## ${title} (${m.size} packages)\n\n| License | Count |\n|---|---|\n${group(m).map(([l, ks]) => `| ${l} | ${ks.length} |`).join("\n")}\n\n<details><summary>Full list</summary>\n\n${[...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\n</details>\n`;

const flagged = [...npm, ...rust].filter(([, l]) => /\b(A?GPL|SSPL|BUSL)\b/i.test(l) && !/LGPL/i.test(l) || /UNKNOWN/.test(l));
const mpl = [...npm, ...rust].filter(([, l]) => /MPL/i.test(l)).map(([k]) => k);
const body = `# Third-party licenses

PC EXPOSED is released under the MIT License (see LICENSE). It includes the open-source
packages below. This file is **generated** by \`node scripts/generate-licenses.mjs\` from the
real dependency graphs; do not edit it by hand.

- Copyleft or unknown licenses found: **${flagged.length === 0 ? "none" : flagged.map(([k, l]) => `${k} (${l})`).join(", ")}**
- MPL-2.0 packages (file-level copyleft, used unmodified; compatible with MIT distribution): **${mpl.length === 0 ? "none" : mpl.join(", ")}**

${section("npm packages shipped in the app bundle", npm)}
${section("Rust crates in the Windows build", rust)}`;

if (process.argv.includes("--check")) {
  const current = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (current !== body) { console.error("THIRD_PARTY_LICENSES.md is out of date. Run: node scripts/generate-licenses.mjs"); process.exit(1); }
  console.log("THIRD_PARTY_LICENSES.md is up to date.");
} else {
  writeFileSync(out, body);
  console.log(`Wrote ${out}: ${npm.size} npm packages, ${rust.size} Rust crates, ${flagged.length} flagged.`);
}
