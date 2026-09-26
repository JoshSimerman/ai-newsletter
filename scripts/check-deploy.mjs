#!/usr/bin/env node
/**
 * scripts/check-deploy.mjs
 *
 * Confirms a published edition is live on the deployed site.
 * Checks page *content*, not just status codes: static hosts with an SPA-style
 * fallback return 200 for any path, so a 200 alone proves nothing.
 *
 *   1. {SITE_URL}/issues/{date}/ contains the edition's <time datetime="{date}">
 *   2. {SITE_URL}/ links to /issues/{date}/
 *
 * Usage: node scripts/check-deploy.mjs --date YYYY-MM-DD [--retries 3] [--wait 30]
 *
 * Exit codes: 0 = live, 1 = not live after retries, 2 = SITE_URL not configured
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load env
for (const envFile of [".env", ".env.local"]) {
  const envPath = path.join(ROOT, envFile);
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim();
    }
  }
}

const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const DATE = argValue("--date");
const RETRIES = parseInt(argValue("--retries")) || 3;
const WAIT_SEC = parseInt(argValue("--wait")) || 30;
const SITE_URL = (process.env.SITE_URL || "").replace(/\/+$/, "");

if (!DATE || !/^\d{4}-\d{2}-\d{2}$/.test(DATE)) {
  console.error("Usage: node scripts/check-deploy.mjs --date YYYY-MM-DD [--retries 3] [--wait 30]");
  process.exit(1);
}
if (!SITE_URL) {
  console.error("❌ SITE_URL not set in .env or .env.local — cannot verify deployment");
  process.exit(2);
}

async function fetchText(url) {
  try {
    // Cache-bust so a CDN edge cannot serve the pre-deploy copy
    const res = await fetch(`${url}?t=${Date.now()}`, { redirect: "follow" });
    return { status: res.status, body: res.ok ? await res.text() : "" };
  } catch (err) {
    return { status: 0, body: "", error: err.message };
  }
}

async function check() {
  const issueUrl = `${SITE_URL}/issues/${DATE}/`;
  const [issue, home] = await Promise.all([fetchText(issueUrl), fetchText(`${SITE_URL}/`)]);
  return {
    issueLive: issue.body.includes(`datetime="${DATE}"`),
    indexLive: home.body.includes(`/issues/${DATE}/`),
    issue,
    home,
  };
}

// Set exitCode rather than calling process.exit(): exiting while fetch keep-alive
// sockets are still open trips a libuv assertion on Windows.
async function main() {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const r = await check();
    console.log(
      `Attempt ${attempt}/${RETRIES}: issue page ${r.issueLive ? "✅" : "❌"} (HTTP ${r.issue.status})` +
      ` · homepage ${r.indexLive ? "✅" : "❌"} (HTTP ${r.home.status})`
    );
    if (r.issueLive && r.indexLive) {
      console.log(`✅ ${DATE} is live at ${SITE_URL}/issues/${DATE}/`);
      return 0;
    }
    if (attempt < RETRIES) await new Promise((res) => setTimeout(res, WAIT_SEC * 1000));
  }
  console.error(`❌ ${DATE} not live after ${RETRIES} attempts — files are committed and may still be deploying`);
  return 1;
}

process.exitCode = await main();
