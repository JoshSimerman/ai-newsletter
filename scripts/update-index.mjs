#!/usr/bin/env node
/**
 * scripts/update-index.mjs
 *
 * Scans site/issues/ for edition folders and regenerates:
 *   - site/index.html (latest edition link + recent list)
 *   - site/issues/index.html (full archive listing)
 *
 * Usage: node scripts/update-index.mjs [--site-dir DIR]   (default: site/)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const siteDirIdx = process.argv.indexOf("--site-dir");
const SITE_DIR = path.resolve(ROOT, siteDirIdx >= 0 ? process.argv[siteDirIdx + 1] : "site");
const ISSUES_DIR = path.join(SITE_DIR, "issues");
const SITE_INDEX = path.join(SITE_DIR, "index.html");
const ARCHIVE_INDEX = path.join(ISSUES_DIR, "index.html");

function getEditions() {
  if (!fs.existsSync(ISSUES_DIR)) return [];
  return fs.readdirSync(ISSUES_DIR)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .filter((d) => fs.existsSync(path.join(ISSUES_DIR, d, "index.html")))
    .sort()
    .reverse();
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getMonthLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

// Replace via regex, but fail loudly if the marker pattern is missing —
// a silent no-op here would leave the live site pointing at a stale edition.
function mustReplace(html, regex, replacement, file, markerName) {
  if (!regex.test(html)) {
    console.error(`❌ ${file}: marker "${markerName}" not found — file structure changed? Aborting.`);
    process.exit(1);
  }
  return html.replace(regex, replacement);
}

function updateSiteIndex(editions) {
  let html = fs.readFileSync(SITE_INDEX, "utf-8");

  // Update latest link (drop it entirely when there are no editions, so it never points at a deleted issue)
  const latestLink = editions.length > 0
    ? `\n    <a href="/issues/${editions[0]}/" class="latest-link">Read Today's Edition →</a>`
    : "";
  html = mustReplace(
    html,
    /<!-- LATEST_EDITION_LINK -->[\s\S]*?(?=<\/div>\s*<div class="editions-list">)/,
    `<!-- LATEST_EDITION_LINK -->${latestLink}\n  `,
    "site/index.html", "LATEST_EDITION_LINK"
  );

  // Update edition list
  const listItems = editions.slice(0, 15).map((date) =>
    `    <div class="edition-item">
      <a href="/issues/${date}/">${formatDate(date)}</a>
      <span class="edition-meta">${date}</span>
    </div>`
  ).join("\n");

  html = mustReplace(
    html,
    /<!-- EDITION_LIST_START -->[\s\S]*?<!-- EDITION_LIST_END -->/,
    `<!-- EDITION_LIST_START -->\n${listItems || '    <div class="edition-item"><span style="color: var(--text-muted); font-size: 0.85rem;">No editions yet.</span></div>'}\n    <!-- EDITION_LIST_END -->`,
    "site/index.html", "EDITION_LIST_START/END"
  );

  fs.writeFileSync(SITE_INDEX, html);
  console.log(`✅ Updated site/index.html (${editions.length} editions)`);
}

function updateArchiveIndex(editions) {
  let html = fs.readFileSync(ARCHIVE_INDEX, "utf-8");

  // Group by month
  const groups = {};
  for (const date of editions) {
    const month = getMonthLabel(date);
    if (!groups[month]) groups[month] = [];
    groups[month].push(date);
  }

  const archiveHtml = Object.entries(groups).map(([month, dates]) => {
    const rows = dates.map((date) =>
      `    <div class="edition-row">
      <a href="/issues/${date}/">${formatDate(date)}</a>
      <span class="meta">${date}</span>
    </div>`
    ).join("\n");
    return `  <div class="month-group">
    <div class="month-label">${month}</div>
${rows}
  </div>`;
  }).join("\n\n");

  html = mustReplace(
    html,
    /<!-- ARCHIVE_START -->[\s\S]*?<!-- ARCHIVE_END -->/,
    `<!-- ARCHIVE_START -->\n${archiveHtml || '  <div class="month-group"><div class="month-label">No editions yet</div></div>'}\n  <!-- ARCHIVE_END -->`,
    "site/issues/index.html", "ARCHIVE_START/END"
  );

  fs.writeFileSync(ARCHIVE_INDEX, html);
  console.log(`✅ Updated site/issues/index.html (${editions.length} editions)`);
}

const editions = getEditions();
updateSiteIndex(editions);
updateArchiveIndex(editions);
