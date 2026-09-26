import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Render the fictional demo edition once through the real assembler + index updater
const out = fs.mkdtempSync(path.join(os.tmpdir(), "sift-render-"));
execFileSync(process.execPath, [path.join(ROOT, "scripts", "render-demo.mjs"), "--out", out], { stdio: "pipe" });
const demo = JSON.parse(fs.readFileSync(path.join(ROOT, "examples", "demo-edition.json"), "utf-8"));
const issue = fs.readFileSync(path.join(out, "site", "issues", demo.date, "index.html"), "utf-8");
const home = fs.readFileSync(path.join(out, "site", "index.html"), "utf-8");
test.after(() => fs.rmSync(out, { recursive: true, force: true }));

test("renders every section that has demo items", () => {
  for (const id of ["top-stories", "claude-anthropic", "openai", "new-models", "model-leaderboard",
    "local-ai", "business-deals", "dev-tools", "open-source", "openclaw", "humanoid-robotics", "youtube"]) {
    assert.match(issue, new RegExp(`id="${id}"`), `missing section #${id}`);
  }
});

test("escapes scraped bullet text but keeps **bold** markup", () => {
  assert.match(issue, /<strong>Queues<\/strong> — run up to 4 background tasks &amp; review/);
  assert.match(issue, /inputs &gt; 32K tokens/);
});

test("omits canonical and og:url when SITE_URL is unset", () => {
  assert.doesNotMatch(issue, /rel="canonical"/);
  assert.doesNotMatch(issue, /og:url/);
});

test("header date and story count come from the data", () => {
  assert.match(issue, new RegExp(`<time datetime="${demo.date}">`));
  const items = Object.values(demo.sections)
    .filter((s) => s.section_key !== "02-executive-summary")
    .reduce((n, s) => n + (s.items?.length || 0), 0);
  assert.match(issue, new RegExp(`${items} stories`));
});

test("homepage links to the newest edition", () => {
  assert.match(home, new RegExp(`href="/issues/${demo.date}/" class="latest-link"`));
});
