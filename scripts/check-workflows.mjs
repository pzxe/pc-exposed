// Validates that every YAML file under .github parses and that workflows are structurally sane.
// Uses the YAML parser bundled inside playwright-core (already a dev dependency), so it adds no new package.
// Usage: node scripts/check-workflows.mjs
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { yaml } = require("playwright-core/lib/utilsBundle");
const root = resolve(import.meta.dirname, "..", ".github");

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
let failed = 0;
for (const file of walk(root).filter((f) => /\.ya?ml$/.test(f))) {
  const rel = file.slice(root.length - 7).split("\\").join("/");
  try {
    const doc = yaml.parse(readFileSync(file, "utf8"));
    if (rel.includes("/workflows/")) {
      if (!doc.on) throw new Error("missing `on` trigger");
      if (!doc.permissions) throw new Error("missing top-level `permissions` (least privilege)");
      for (const [name, job] of Object.entries(doc.jobs ?? {})) {
        if (!job["runs-on"] || !Array.isArray(job.steps) || job.steps.length === 0) throw new Error(`job "${name}" needs runs-on and steps`);
        if (!job["timeout-minutes"]) throw new Error(`job "${name}" needs timeout-minutes`);
      }
      console.log(`OK  ${rel}  triggers=[${Object.keys(doc.on)}] jobs=[${Object.keys(doc.jobs)}] permissions=${JSON.stringify(doc.permissions)}`);
    } else {
      console.log(`OK  ${rel}`);
    }
  } catch (e) {
    failed++;
    console.error(`FAIL ${rel}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
