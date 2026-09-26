#!/usr/bin/env node
/**
 * scripts/render-demo.mjs
 *
 * Builds a complete demo site from fictional data — no API keys, D1, or network needed.
 * Copies site/ to the output dir, splits examples/demo-edition.json into per-section
 * research files, then runs the real assembler and index updater against them.
 *
 * Usage: node scripts/render-demo.mjs [--out dist/demo]
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const outIdx = process.argv.indexOf("--out");
const OUT = path.resolve(ROOT, outIdx >= 0 ? process.argv[outIdx + 1] : "dist/demo");
const SITE_OUT = path.join(OUT, "site");
const RESEARCH_OUT = path.join(OUT, "research");

const demo = JSON.parse(fs.readFileSync(path.join(ROOT, "examples", "demo-edition.json"), "utf-8"));

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "site"), SITE_OUT, { recursive: true });
fs.mkdirSync(RESEARCH_OUT, { recursive: true });
for (const [key, data] of Object.entries(demo.sections)) {
  fs.writeFileSync(path.join(RESEARCH_OUT, `${key}-research.json`), JSON.stringify(data, null, 2));
}

// SITE_URL is blanked so the demo never carries a real deployment's canonical URL
const env = { ...process.env, SITE_URL: "" };
const run = (script, args) =>
  execFileSync(process.execPath, [path.join(ROOT, "scripts", script), ...args], { env, stdio: "inherit" });

run("assemble-digest.mjs", ["--date", demo.date, "--research-dir", RESEARCH_OUT, "--out-dir", SITE_OUT]);
run("update-index.mjs", ["--site-dir", SITE_OUT]);

console.log(`✅ Demo site: ${path.relative(ROOT, SITE_OUT)}/ (edition ${demo.date})`);
