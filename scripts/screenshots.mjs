#!/usr/bin/env node
/**
 * scripts/screenshots.mjs
 *
 * Regenerates the README screenshots from the fictional demo edition.
 * Deterministic: fixed clock, timezone, locale, and viewport. Every request except
 * Google Fonts is served locally, and example.com thumbnails get generated placeholders.
 *
 * Usage: npm run screenshots   (first run: npx playwright install chromium)
 * Output: docs/screenshots/*.png
 */

import fs from "fs";
import http from "http";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEMO_DIR = path.join(ROOT, "dist", "demo");
const SITE_DIR = path.join(DEMO_DIR, "site");
const SHOT_DIR = path.join(ROOT, "docs", "screenshots");

execFileSync(process.execPath, [path.join(ROOT, "scripts", "render-demo.mjs"), "--out", DEMO_DIR], { stdio: "inherit" });
const { date } = JSON.parse(fs.readFileSync(path.join(ROOT, "examples", "demo-edition.json"), "utf-8"));

// Minimal static server so root-relative links (/issues/, /favicon.svg) resolve like on Pages
const TYPES = { ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".css": "text/css", ".txt": "text/plain" };
const server = http.createServer((req, res) => {
  let p = path.join(SITE_DIR, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(SITE_DIR)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// Placeholder video thumbnail: a gradient card, hue varied per URL
function thumbSvg(url) {
  const hue = [...url].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue},55%,28%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},60%,14%)"/>
</linearGradient></defs><rect width="480" height="270" fill="url(#g)"/>
<polygon points="215,105 215,165 268,135" fill="rgba(255,255,255,0.85)"/></svg>`;
}

const browser = await chromium.launch();
const shots = [
  { name: "digest-desktop.png", url: `/issues/${date}/`, viewport: { width: 1280, height: 1500 } },
  { name: "digest-sections.png", url: `/issues/${date}/#model-leaderboard`, viewport: { width: 1280, height: 1500 } },
  { name: "digest-mobile.png", url: `/issues/${date}/`, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  { name: "homepage.png", url: "/", viewport: { width: 1280, height: 800 } },
];

fs.mkdirSync(SHOT_DIR, { recursive: true });
try {
  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: shot.viewport,
      deviceScaleFactor: shot.deviceScaleFactor || 1,
      locale: "en-US",
      timezoneId: "UTC",
      colorScheme: "dark",
    });
    await context.clock.setFixedTime(new Date(`${date}T16:00:00Z`));
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith(base) || /fonts\.(googleapis|gstatic)\.com/.test(url)) return route.continue();
      if (/\/thumbs\//.test(url)) return route.fulfill({ contentType: "image/svg+xml", body: thumbSvg(url) });
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(base + shot.url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(SHOT_DIR, shot.name) });
    console.log(`📸 docs/screenshots/${shot.name}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
