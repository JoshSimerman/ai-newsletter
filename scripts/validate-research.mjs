#!/usr/bin/env node
/**
 * scripts/validate-research.mjs
 *
 * Validates that all research sections for an edition have been saved to D1 correctly.
 * Used as a gate between Phase 1 (Research) and Phase 2 (Design).
 *
 * Usage:
 *   node scripts/validate-research.mjs --date YYYY-MM-DD
 *   node scripts/validate-research.mjs --date YYYY-MM-DD --json       # machine-readable output
 *   node scripts/validate-research.mjs --date YYYY-MM-DD --min-bytes 100
 *
 * Exit codes:
 *   0 = all sections PASS or WARN (empty day)
 *   1 = one or more sections FAIL (missing/corrupt data — needs retry)
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
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  }
}

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const API_TOKEN = process.env.CF_API_TOKEN;
const DATABASE_ID = process.env.CF_D1_DATABASE_ID;

if (!ACCOUNT_ID || !API_TOKEN || !DATABASE_ID) {
  console.error("Missing D1 credentials");
  process.exit(1);
}

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}`;

async function query(sql, params = []) {
  const res = await fetch(`${BASE_URL}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`D1 error: ${data.errors?.map(e => e.message).join(", ")}`);
  return data.result?.[0] || { results: [] };
}

// Sections that must have research data (excludes design-only: 01-header, 12-footer)
const RESEARCH_SECTIONS = [
  "02-executive-summary", "03-top-stories", "04-claude-anthropic",
  "05-openai", "06-new-models", "07-local-ai", "08-business-deals",
  "09-dev-tools", "10-open-source", "11-youtube", "13-openclaw",
  "14-model-leaderboard", "15-humanoid-robotics"
];

// Sections that are allowed to have 0 items on a quiet day
const ALLOW_EMPTY = ["02-executive-summary", "11-youtube", "13-openclaw", "15-humanoid-robotics"];

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].replace("--", "");
      flags[key] = (args[i + 1] && !args[i + 1].startsWith("--")) ? args[i + 1] : true;
      if (flags[key] !== true) i++;
    }
  }
  return flags;
}

async function main() {
  const flags = parseArgs();
  const date = flags.date;
  const jsonOutput = flags.json === true;
  const minBytes = parseInt(flags["min-bytes"]) || 50;

  if (!date) { console.error("Usage: node scripts/validate-research.mjs --date YYYY-MM-DD"); process.exit(1); }

  // Get edition
  const edResult = await query("SELECT id FROM editions WHERE edition_date = ?", [date]);
  if (edResult.results.length === 0) { console.error(`No edition found for ${date}`); process.exit(1); }
  const editionId = edResult.results[0].id;

  // Get all sections with research data sizes
  const sectionsResult = await query(
    `SELECT section_key, status, research_data,
            LENGTH(research_data) as research_len
     FROM sections WHERE edition_id = ?
     ORDER BY section_key`,
    [editionId]
  );

  const sectionMap = {};
  for (const s of sectionsResult.results) {
    sectionMap[s.section_key] = s;
  }

  const results = [];
  let hasFailures = false;

  // 14-model-leaderboard has no items[] — it uses ranking arrays instead
  function countItems(parsed, key) {
    if (key === "14-model-leaderboard") {
      return (parsed.arena_top_10?.length || 0) +
             (parsed.open_top_5?.length || 0) +
             (parsed.openrouter_top_10?.length || 0);
    }
    return parsed.items?.length || 0;
  }

  for (const key of RESEARCH_SECTIONS) {
    const section = sectionMap[key];
    let status, itemCount = 0, bytes = 0, error = null;

    if (!section) {
      status = "FAIL";
      error = "Section not found in D1";
      hasFailures = true;
    } else if (!section.research_data || section.research_len < minBytes) {
      status = "FAIL";
      error = `Research data too small (${section.research_len || 0} bytes, min ${minBytes})`;
      hasFailures = true;
    } else {
      bytes = section.research_len;
      try {
        const parsed = JSON.parse(section.research_data);
        itemCount = countItems(parsed, key);

        if (itemCount === 0 && !ALLOW_EMPTY.includes(key)) {
          // Standard section with 0 items — could be legit or could be a save failure
          // Check if the JSON structure is valid (has section_key, items array)
          if (!parsed.section_key && !parsed.section && !parsed.items) {
            status = "FAIL";
            error = "Research JSON missing required fields (section_key, items)";
            hasFailures = true;
          } else {
            status = "WARN";
            error = "0 items (quiet day or research found nothing)";
          }
        } else if (itemCount === 0 && ALLOW_EMPTY.includes(key)) {
          status = "WARN";
          error = "0 items (expected for this section on quiet days)";
        } else {
          status = "PASS";
        }
      } catch (e) {
        status = "FAIL";
        error = `Invalid JSON: ${e.message}`;
        hasFailures = true;
      }
    }

    results.push({ section: key, status, bytes, items: itemCount, error });
  }

  // Also check tmp/ files match D1 data
  const tmpMismatches = [];
  for (const r of results) {
    if (r.status === "PASS" || r.status === "WARN") {
      const tmpFile = path.join(ROOT, "tmp", `${r.section}-research.json`);
      if (fs.existsSync(tmpFile)) {
        try {
          const tmpData = JSON.parse(fs.readFileSync(tmpFile, "utf8"));
          const tmpItems = countItems(tmpData, r.section);
          if (tmpItems !== r.items) {
            tmpMismatches.push({ section: r.section, d1Items: r.items, tmpItems });
          }
        } catch {}
      }
    }
  }

  if (jsonOutput) {
    const output = {
      date,
      passed: !hasFailures,
      results,
      tmpMismatches: tmpMismatches.length > 0 ? tmpMismatches : undefined,
      failedSections: results.filter(r => r.status === "FAIL").map(r => r.section),
    };
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`\n🔍 Research Validation: ${date}`);
    console.log("─".repeat(60));
    for (const r of results) {
      const icon = r.status === "PASS" ? "✅" : r.status === "WARN" ? "⚠️ " : "❌";
      const detail = r.status === "PASS"
        ? `${r.bytes}b  ${r.items} items`
        : `${r.error}`;
      console.log(`  ${icon} ${r.section.padEnd(25)} ${detail}`);
    }

    if (tmpMismatches.length > 0) {
      console.log(`\n⚠️  D1/tmp file mismatches:`);
      for (const m of tmpMismatches) {
        console.log(`   ${m.section}: D1 has ${m.d1Items} items, tmp/ has ${m.tmpItems}`);
      }
    }

    const failed = results.filter(r => r.status === "FAIL");
    const warned = results.filter(r => r.status === "WARN");
    const passed = results.filter(r => r.status === "PASS");

    console.log(`\n${passed.length} passed · ${warned.length} warnings · ${failed.length} failures`);
    if (failed.length > 0) {
      console.log(`\n❌ FAILED sections need retry: ${failed.map(f => f.section).join(", ")}`);
    }
  }

  process.exit(hasFailures ? 1 : 0);
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });
