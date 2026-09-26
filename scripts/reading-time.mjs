#!/usr/bin/env node
/**
 * scripts/reading-time.mjs
 *
 * Calculate estimated reading time for a Sift digest.
 * Strips HTML tags, counts words, divides by 200 WPM.
 *
 * Usage:
 *   node scripts/reading-time.mjs --file site/issues/2026-03-26/index.html
 *   node scripts/reading-time.mjs --date 2026-03-26
 *
 * Output: prints the reading time in minutes (e.g., "5 min read")
 * Also outputs word count and item count for use in header/footer generation.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readingStatsFromHtml } from "./shared/reading-metrics.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].replace("--", "");
      flags[key] = args[i + 1] || true;
      i++;
    }
  }
  return flags;
}

function main() {
  const flags = parseArgs();

  let filePath;
  if (flags.file) {
    filePath = path.resolve(flags.file);
  } else if (flags.date) {
    filePath = path.join(ROOT, "site", "issues", flags.date, "index.html");
  } else {
    console.error("Usage: node scripts/reading-time.mjs --file PATH or --date YYYY-MM-DD");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const html = fs.readFileSync(filePath, "utf-8");
  const { words, minutes, items } = readingStatsFromHtml(html);

  if (flags.json) {
    console.log(JSON.stringify({ words, minutes, items }));
  } else {
    console.log(`📖 Reading time: ~${minutes} min read`);
    console.log(`   ${words.toLocaleString()} words · ${items} items`);
  }
}

main();
