// Fails if chaos/test hooks leaked into a production build (CHAOS_TESTING.md §3.1).
// Usage: node scripts/check-prod-bundle.mjs dist
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "dist";
const FORBIDDEN = ["__banjoChaos", "__banjoTest", "ChaosController", "CHAOS_SEED"];

function* files(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(js|mjs|html)$/.test(name)) yield p;
  }
}

let bad = 0;
let count = 0;
for (const file of files(dir)) {
  count++;
  const text = readFileSync(file, "utf8");
  for (const word of FORBIDDEN) {
    if (text.includes(word)) {
      console.error(`✗ ${file} contains "${word}"`);
      bad++;
    }
  }
}
if (count === 0) {
  console.error(`✗ No built files found in ${dir}. Run the build first.`);
  process.exit(1);
}
if (bad > 0) process.exit(1);
console.log(`✓ ${count} files checked, no chaos or test hooks in ${dir}`);
