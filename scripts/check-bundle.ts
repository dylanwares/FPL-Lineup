/**
 * Fails when a page's first-load JavaScript exceeds its gzip budget.
 * Reads the prerendered HTML from `next build`, so it measures exactly the
 * chunks the page loads. Run after `pnpm build`.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "..");
const NEXT = path.join(ROOT, ".next");

const BUDGETS: { route: string; html: string; maxKb: number }[] = [
  { route: "/", html: "server/app/index.html", maxKb: 150 },
];

async function firstLoadScripts(htmlFile: string) {
  const html = await readFile(path.join(NEXT, htmlFile), "utf8");
  const srcs = new Set<string>();
  // <script src> tags plus chunks listed in the inline RSC payload.
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s\\]+?\.js/g)) srcs.add(m[0]);
  // Legacy polyfills load with noModule, which modern browsers skip.
  for (const m of html.matchAll(/<script[^>]*src="([^"]+)"[^>]*noModule[^>]*>/gi)) srcs.delete(m[1]);
  return [...srcs];
}

async function main() {
  let failed = false;
  for (const { route, html, maxKb } of BUDGETS) {
    if (!existsSync(path.join(NEXT, html))) {
      console.error(`size: ${html} not found — run \`pnpm build\` first`);
      process.exit(1);
    }
    const scripts = await firstLoadScripts(html);
    let total = 0;
    const rows: [string, number][] = [];
    for (const src of scripts) {
      const file = path.join(NEXT, src.replace(/^\/_next\//, ""));
      const gz = gzipSync(await readFile(file)).length;
      total += gz;
      rows.push([path.basename(src), gz]);
    }
    rows.sort((a, b) => b[1] - a[1]);
    const kb = (n: number) => (n / 1024).toFixed(1).padStart(6) + " KB";
    console.log(`\n${route}  (${scripts.length} scripts)`);
    for (const [name, gz] of rows) console.log(`  ${kb(gz)}  ${name}`);
    const ok = total <= maxKb * 1024;
    console.log(`  ${kb(total)}  total gzip — budget ${maxKb} KB ${ok ? "✓" : "✗ OVER BUDGET"}`);
    failed ||= !ok;
  }
  if (failed) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
