#!/usr/bin/env node
/**
 * scripts/verify-links.mjs
 *
 * Post-assembly link verification for Sift daily digests.
 * Extracts all href URLs from the generated HTML and checks each with a HEAD request.
 *
 * Usage:
 *   node scripts/verify-links.mjs --file site/issues/2026-03-26/index.html
 *   node scripts/verify-links.mjs --date 2026-03-26
 *
 * Options:
 *   --timeout 5000   Request timeout in ms (default: 5000)
 *   --concurrency 3  Max parallel requests (default: 3)
 *
 * Exit codes:
 *   0 = all links valid
 *   1 = one or more broken links found
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { checkUrl, extractContentUrls } from "./shared/link-check.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load env (SITE_URL marks links to this site as internal)
for (const envFile of [".env", ".env.local"]) {
  const envPath = path.join(ROOT, envFile);
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim();
    }
  }
}
const SITE_URL = (process.env.SITE_URL || "").replace(/\/+$/, "");

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

async function checkBatch(urls, concurrency, timeout) {
  const results = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((url) => checkUrl(url, timeout))
    );
    results.push(...batchResults);
  }
  return results;
}

async function main() {
  const flags = parseArgs();
  const timeout = parseInt(flags.timeout) || 5000;
  const concurrency = parseInt(flags.concurrency) || 3;

  let filePath;
  if (flags.file) {
    filePath = path.resolve(flags.file);
  } else if (flags.date) {
    filePath = path.join(ROOT, "site", "issues", flags.date, "index.html");
  } else {
    console.error("Usage: node scripts/verify-links.mjs --file PATH or --date YYYY-MM-DD");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const html = fs.readFileSync(filePath, "utf-8");
  const urls = extractContentUrls(html);

  // Separate internal (site) vs external URLs
  const externalUrls = urls.filter(
    (u) => !(SITE_URL && u.startsWith(SITE_URL)) && !u.includes("localhost")
  );

  console.log(`\n🔗 Link Verification: ${path.basename(path.dirname(filePath))}/${path.basename(filePath)}`);
  console.log(`   ${urls.length} total links found (${externalUrls.length} external)`);
  console.log(`   Timeout: ${timeout}ms · Concurrency: ${concurrency}\n`);

  const results = await checkBatch(externalUrls, concurrency, timeout);

  const broken = results.filter((r) => !r.ok);
  const valid = results.filter((r) => r.ok);

  // Report results
  if (valid.length > 0) {
    console.log(`✅ ${valid.length} links OK`);
  }

  if (broken.length > 0) {
    console.log(`\n❌ ${broken.length} broken links:`);
    for (const r of broken) {
      const detail = r.error ? r.error : `HTTP ${r.status}`;
      console.log(`   ${detail} → ${r.url}`);
    }
    console.log("");
    process.exit(1);
  } else {
    console.log(`\n✅ All ${externalUrls.length} external links verified\n`);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
