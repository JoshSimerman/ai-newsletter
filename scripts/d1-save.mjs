#!/usr/bin/env node
/**
 * scripts/d1-save.mjs
 *
 * CLI helper for saving research and design data to D1 for Sift daily editions.
 *
 * Usage:
 *   # Create an edition
 *   node scripts/d1-save.mjs create-edition --date 2026-03-25
 *
 *   # Save research data for a section
 *   node scripts/d1-save.mjs save-research --date 2026-03-25 --section 04-claude-anthropic --file tmp/04-claude-anthropic-research.json
 *   node scripts/d1-save.mjs save-research --date 2026-03-25 --section 04-claude-anthropic --json '{"items":[...]}'
 *
 *   # Save design HTML for a section
 *   node scripts/d1-save.mjs save-design --date 2026-03-25 --section 04-claude-anthropic --file tmp/04-claude-anthropic-design.html
 *
 *   # Record content in content_index (for deduplication)
 *   node scripts/d1-save.mjs record --date 2026-03-25 --section 04-claude-anthropic --type story --id "slug" --title "Title" --url "URL" --source "Source"
 *
 *   # Check if content has appeared recently (7-day window)
 *   node scripts/d1-save.mjs check --type story --id "slug"
 *   node scripts/d1-save.mjs check-url --url "https://example.com/article"
 *
 *   # Fuzzy title match (entity-weighted similarity)
 *   node scripts/d1-save.mjs check-fuzzy --title "Anthropic launches Dream" [--threshold 0.4]
 *
 *   # Batch dedup check — one call for a whole section's candidates (url + id + fuzzy)
 *   node scripts/d1-save.mjs check-batch --file tmp/04-claude-anthropic-research.json [--threshold 0.4]
 *
 *   # Batch record — record every item of a research JSON in one call
 *   node scripts/d1-save.mjs record-batch --date 2026-03-25 --section 04-claude-anthropic --file tmp/04-claude-anthropic-research.json
 *
 *   # Record content with source tier
 *   node scripts/d1-save.mjs record --date 2026-03-25 --section 04-claude-anthropic --type story --id "slug" --title "Title" --url "URL" --source "Source" --tier 1
 *
 *   # List recent content
 *   node scripts/d1-save.mjs list --type story [--section KEY] [--last N]
 *
 *   # Finalize an edition (mark as published)
 *   node scripts/d1-save.mjs finalize --date 2026-03-25
 *
 *   # Read research data for a section
 *   node scripts/d1-save.mjs read-research --date 2026-03-25 --section 04-claude-anthropic
 *
 *   # Reset an edition (delete all DB records + local HTML for re-run)
 *   node scripts/d1-save.mjs reset-edition --date 2026-03-25
 *
 *   # Show edition status
 *   node scripts/d1-save.mjs status --date 2026-03-25
 *   node scripts/d1-save.mjs status               # all editions overview
 *
 * Environment (.env or .env.local):
 *   CF_ACCOUNT_ID, CF_API_TOKEN, CF_D1_DATABASE_ID
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load .env then .env.local (local overrides)
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
  console.error("❌ D1 not configured. Set CF_ACCOUNT_ID, CF_API_TOKEN, CF_D1_DATABASE_ID in .env or .env.local");
  process.exit(1);
}

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}`;

async function query(sql, params = []) {
  const res = await fetch(`${BASE_URL}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const data = await res.json();
  if (!data.success) {
    const errors = data.errors?.map((e) => e.message).join(", ");
    throw new Error(`D1 error: ${errors}`);
  }
  return data.result?.[0] || { results: [] };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const flags = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].replace("--", "");
      flags[key] = args[i + 1] || true;
      i++;
    }
  }
  return { command, flags };
}

// ─── Helpers ───

async function getEditionId(editionDate) {
  const result = await query("SELECT id FROM editions WHERE edition_date = ?", [editionDate]);
  if (result.results.length === 0) return null;
  return result.results[0].id;
}

async function getOrCreateSection(editionId, sectionKey) {
  const existing = await query(
    "SELECT id FROM sections WHERE edition_id = ? AND section_key = ?",
    [editionId, sectionKey]
  );
  if (existing.results.length > 0) return existing.results[0].id;

  await query(
    "INSERT INTO sections (edition_id, section_key, status) VALUES (?, ?, 'pending')",
    [editionId, sectionKey]
  );
  const created = await query(
    "SELECT id FROM sections WHERE edition_id = ? AND section_key = ?",
    [editionId, sectionKey]
  );
  return created.results[0].id;
}

// ─── Commands ───

async function main() {
  const { command, flags } = parseArgs();

  switch (command) {

    // ── create-edition ──
    case "create-edition": {
      const date = flags.date;
      if (!date) { console.error("❌ --date required"); process.exit(1); }

      const existing = await getEditionId(date);
      if (existing) {
        console.log(`⚡ Edition ${date} already exists (id: ${existing})`);
        return;
      }

      // Auto-calculate edition number (MAX, not COUNT — survives deleted editions)
      const countResult = await query("SELECT COALESCE(MAX(edition_number), 0) as maxnum FROM editions");
      const editionNumber = (countResult.results[0]?.maxnum || 0) + 1;

      await query(
        "INSERT INTO editions (edition_date, edition_number, status) VALUES (?, ?, 'draft')",
        [date, editionNumber]
      );

      // Create all section records
      const sections = [
        "01-header", "02-executive-summary", "03-top-stories",
        "04-claude-anthropic", "05-openai", "06-new-models",
        "07-local-ai", "08-business-deals", "09-dev-tools",
        "10-open-source", "11-youtube", "12-footer", "13-openclaw",
        "14-model-leaderboard", "15-humanoid-robotics"
      ];
      const editionId = await getEditionId(date);
      for (const key of sections) {
        await query(
          "INSERT INTO sections (edition_id, section_key, status) VALUES (?, ?, 'pending')",
          [editionId, key]
        );
      }

      console.log(`✅ Created edition #${editionNumber} for ${date} with ${sections.length} sections`);
      break;
    }

    // ── save-research ──
    case "save-research": {
      const { date, section, file, json } = flags;
      if (!date || !section) { console.error("❌ --date and --section required"); process.exit(1); }

      let data;
      if (file) {
        const filePath = path.isAbsolute(file) ? file : path.join(ROOT, file);
        if (!fs.existsSync(filePath)) {
          console.error(`❌ File not found: ${filePath}`);
          process.exit(1);
        }
        data = fs.readFileSync(filePath, "utf-8");
      } else if (json) {
        data = json;
      } else {
        data = fs.readFileSync(0, "utf-8");
      }

      // Pre-save validation: warn if data looks empty or invalid
      const trimmed = data.trim();
      if (!trimmed || trimmed === "{}" || trimmed === "[]") {
        console.error(`⚠️  WARNING: Research data for ${section} is empty or trivial (${trimmed.length} bytes). This may indicate the research agent failed silently.`);
      }

      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        console.error(`❌ Invalid JSON for ${section}: ${e.message}`);
        console.error(`   First 200 chars: ${data.slice(0, 200)}`);
        process.exit(1);
      }

      const itemCount = parsed.item_count || parsed.items?.length || 0;
      if (itemCount === 0 && parsed.items && parsed.items.length === 0) {
        console.log(`⚠️  Note: ${section} has 0 items (empty section — this is OK if it was a quiet day)`);
      }

      const editionId = await getEditionId(date);
      if (!editionId) { console.error(`❌ Edition ${date} not found. Run create-edition first.`); process.exit(1); }

      const sectionId = await getOrCreateSection(editionId, section);
      await query(
        "UPDATE sections SET research_data = ?, status = 'researched' WHERE id = ?",
        [data, sectionId]
      );

      // Write verification: read back and confirm data was persisted
      const verify = await query(
        "SELECT LENGTH(research_data) as len FROM sections WHERE id = ?",
        [sectionId]
      );
      const savedLen = verify.results[0]?.len || 0;
      if (savedLen < 10) {
        console.error(`❌ WRITE VERIFICATION FAILED for ${section} — D1 has ${savedLen} bytes after save. Data may not have persisted.`);
        process.exit(1);
      }

      console.log(`✅ Saved research for ${section} (${itemCount} items, ${savedLen}b verified in D1)`);
      break;
    }

    // ── save-design ──
    case "save-design": {
      const { date, section, file } = flags;
      if (!date || !section) { console.error("❌ --date and --section required"); process.exit(1); }

      let html;
      if (file) {
        const filePath = path.isAbsolute(file) ? file : path.join(ROOT, file);
        if (!fs.existsSync(filePath)) {
          console.error(`❌ File not found: ${filePath}`);
          process.exit(1);
        }
        html = fs.readFileSync(filePath, "utf-8");
      } else {
        html = fs.readFileSync(0, "utf-8");
      }

      const editionId = await getEditionId(date);
      if (!editionId) { console.error(`❌ Edition ${date} not found.`); process.exit(1); }

      const sectionId = await getOrCreateSection(editionId, section);
      await query(
        "UPDATE sections SET html_fragment = ?, status = 'designed' WHERE id = ?",
        [html, sectionId]
      );

      console.log(`✅ Saved design for ${section} (${html.length} chars)`);
      break;
    }

    // ── record ──
    case "record": {
      const { date, section, type, id, title, url, source, tier } = flags;
      if (!date || !section || !type || !id) {
        console.error("❌ --date, --section, --type, --id required"); process.exit(1);
      }

      const editionId = await getEditionId(date);
      if (!editionId) { console.error(`❌ Edition ${date} not found.`); process.exit(1); }

      const sourceTier = tier ? parseInt(tier) : 3;

      await query(
        `INSERT INTO content_index (edition_id, section_key, content_type, content_id, title, url, source, source_tier)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [editionId, section, type, id, title || null, url || null, source || null, sourceTier]
      );

      console.log(`✅ Recorded ${type}: ${id} (${title || "untitled"}) [tier ${sourceTier}]`);
      break;
    }

    // ── check ──
    case "check": {
      const { type, id } = flags;
      if (!type || !id) { console.error("❌ --type and --id required"); process.exit(1); }

      const result = await query(
        `SELECT ci.content_id, ci.title, e.edition_date, ci.section_key
         FROM content_index ci
         JOIN editions e ON ci.edition_id = e.id
         WHERE ci.content_type = ? AND ci.content_id = ?
           AND ci.created_at > datetime('now', '-7 days')
         ORDER BY ci.created_at DESC LIMIT 5`,
        [type, id]
      );

      if (result.results.length === 0) {
        console.log(`✅ Not seen in last 7 days: ${type}/${id}`);
      } else {
        console.log(`⚠️  Already featured (${result.results.length} times in last 7 days):`);
        for (const r of result.results) {
          console.log(`   ${r.edition_date} · ${r.section_key} · "${r.title}"`);
        }
      }
      break;
    }

    // ── check-url ──
    case "check-url": {
      const { url } = flags;
      if (!url) { console.error("❌ --url required"); process.exit(1); }

      const result = await query(
        `SELECT ci.content_id, ci.title, e.edition_date, ci.section_key
         FROM content_index ci
         JOIN editions e ON ci.edition_id = e.id
         WHERE ci.url = ?
           AND ci.created_at > datetime('now', '-7 days')
         ORDER BY ci.created_at DESC LIMIT 5`,
        [url]
      );

      if (result.results.length === 0) {
        console.log(`✅ URL not seen in last 7 days`);
      } else {
        console.log(`⚠️  URL already featured:`);
        for (const r of result.results) {
          console.log(`   ${r.edition_date} · ${r.section_key} · "${r.title}"`);
        }
      }
      break;
    }

    // ── check-fuzzy ──
    case "check-fuzzy": {
      const { title, threshold } = flags;
      if (!title) { console.error("❌ --title required"); process.exit(1); }

      const { compositeScore, loadEntities, formatFuzzyResults } = await import("./shared/fuzzy.mjs");
      const entities = loadEntities();
      const minScore = threshold ? parseFloat(threshold) : 0.4;

      const result = await query(
        `SELECT ci.title, ci.source_tier, ci.section_key, e.edition_date
         FROM content_index ci
         JOIN editions e ON ci.edition_id = e.id
         WHERE ci.title IS NOT NULL
           AND ci.created_at > datetime('now', '-7 days')
         ORDER BY ci.created_at DESC`,
        []
      );

      const matches = [];
      for (const row of result.results) {
        if (!row.title) continue;
        const score = compositeScore(title, row.title, entities);
        if (score.total >= minScore) {
          matches.push({
            title: row.title,
            edition_date: row.edition_date,
            section_key: row.section_key,
            source_tier: row.source_tier || 3,
            score,
          });
        }
      }

      matches.sort((a, b) => b.score.total - a.score.total);
      console.log(formatFuzzyResults(matches));
      break;
    }

    // ── check-batch ──
    // One call, one D1 query: URL + content-ID + fuzzy-title dedup for a whole
    // section's candidates. Accepts a research JSON ({items:[...]}) or a bare array.
    case "check-batch": {
      const { file, threshold } = flags;
      if (!file) { console.error("❌ --file required (research JSON with items[], or bare array of {title,url,content_type,id})"); process.exit(1); }
      const filePath = path.isAbsolute(file) ? file : path.join(ROOT, file);
      if (!fs.existsSync(filePath)) { console.error(`❌ File not found: ${filePath}`); process.exit(1); }
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const candidates = Array.isArray(raw) ? raw : raw.items || [];
      if (candidates.length === 0) { console.log("✅ No candidates in file"); break; }

      const { compositeScore, loadEntities } = await import("./shared/fuzzy.mjs");
      const entities = loadEntities();
      const minScore = threshold ? parseFloat(threshold) : 0.4;

      const recent = await query(
        `SELECT ci.title, ci.url, ci.content_type, ci.content_id, ci.section_key, ci.source_tier, e.edition_date
         FROM content_index ci
         JOIN editions e ON ci.edition_id = e.id
         WHERE ci.created_at > datetime('now', '-7 days')`,
        []
      );
      const rows = recent.results;
      const byUrl = new Map();
      const byId = new Map();
      for (const r of rows) {
        if (r.url && !byUrl.has(r.url)) byUrl.set(r.url, r);
        const k = `${r.content_type}/${r.content_id}`;
        if (!byId.has(k)) byId.set(k, r);
      }

      let dupes = 0;
      for (const c of candidates) {
        const label = c.title || c.id || c.url || "?";
        const reasons = [];
        if (c.url && byUrl.has(c.url)) {
          const r = byUrl.get(c.url);
          reasons.push(`url seen ${r.edition_date} in ${r.section_key}`);
        }
        const cType = c.content_type || c.type;
        const cId = c.content_id || c.id;
        if (cType && cId && byId.has(`${cType}/${cId}`)) {
          const r = byId.get(`${cType}/${cId}`);
          reasons.push(`id seen ${r.edition_date} in ${r.section_key}`);
        }
        if (c.title) {
          let best = null;
          for (const r of rows) {
            if (!r.title) continue;
            const s = compositeScore(c.title, r.title, entities);
            if (s.total >= minScore && (!best || s.total > best.score)) best = { score: s.total, row: r };
          }
          if (best) reasons.push(`fuzzy ${best.score.toFixed(2)} vs "${best.row.title}" (${best.row.edition_date}, tier ${best.row.source_tier || 3})`);
        }
        if (reasons.length) {
          dupes++;
          console.log(`DUPE  ${label}`);
          console.log(`      ${reasons.join("; ")}`);
        } else {
          console.log(`NEW   ${label}`);
        }
      }
      console.log(`\n${candidates.length - dupes}/${candidates.length} new · ${dupes} duplicate${dupes === 1 ? "" : "s"} (7-day window)`);
      break;
    }

    // ── record-batch ──
    // Records every item from a research JSON into content_index in a single
    // D1 call. Replaces N per-item `record` invocations.
    case "record-batch": {
      const { date, section, file, tier } = flags;
      if (!date || !section || !file) { console.error("❌ --date, --section, --file required"); process.exit(1); }
      const filePath = path.isAbsolute(file) ? file : path.join(ROOT, file);
      if (!fs.existsSync(filePath)) { console.error(`❌ File not found: ${filePath}`); process.exit(1); }
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const items = Array.isArray(raw) ? raw : raw.items || [];
      if (items.length === 0) { console.log("⚠️  No items to record"); break; }

      const editionId = await getEditionId(date);
      if (!editionId) { console.error(`❌ Edition ${date} not found.`); process.exit(1); }

      const defaultTier = tier ? parseInt(tier) : 3;
      const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

      const values = [];
      const params = [];
      for (const it of items) {
        const type = it.content_type || it.type || "story";
        const id = it.content_id || it.id || slugify(it.title || it.url || "");
        const itemTier = it.source_tier || it.tier || defaultTier;
        values.push("(?, ?, ?, ?, ?, ?, ?, ?)");
        params.push(editionId, section, type, id, it.title || null, it.url || null, it.source || null, itemTier);
      }
      await query(
        `INSERT INTO content_index (edition_id, section_key, content_type, content_id, title, url, source, source_tier)
         VALUES ${values.join(", ")}`,
        params
      );
      console.log(`✅ Recorded ${items.length} items for ${section} (${date}) in one call`);
      break;
    }

    // ── list ──
    case "list": {
      const { type, section, last } = flags;
      const limit = parseInt(last) || 50;

      let sql = `
        SELECT ci.content_type, ci.content_id, ci.title, ci.url, ci.source,
               e.edition_date, ci.section_key
        FROM content_index ci
        JOIN editions e ON ci.edition_id = e.id
        WHERE 1=1`;
      const params = [];

      if (type) { sql += " AND ci.content_type = ?"; params.push(type); }
      if (section) { sql += " AND ci.section_key = ?"; params.push(section); }

      sql += ` ORDER BY ci.created_at DESC LIMIT ?`;
      params.push(limit);

      const result = await query(sql, params);
      if (result.results.length === 0) {
        console.log("No content found matching filters.");
      } else {
        console.log(`Found ${result.results.length} items:`);
        for (const r of result.results) {
          console.log(`  ${r.edition_date} | ${r.section_key} | ${r.content_type} | ${r.content_id} | "${r.title || ""}"`);
        }
      }
      break;
    }

    // ── read-research ──
    case "read-research": {
      const { date, section } = flags;
      if (!date || !section) { console.error("❌ --date and --section required"); process.exit(1); }

      const editionId = await getEditionId(date);
      if (!editionId) { console.error(`❌ Edition ${date} not found.`); process.exit(1); }

      const result = await query(
        "SELECT research_data FROM sections WHERE edition_id = ? AND section_key = ?",
        [editionId, section]
      );

      if (result.results.length === 0 || !result.results[0].research_data) {
        console.log(`No research data found for ${section} on ${date}`);
      } else {
        console.log(result.results[0].research_data);
      }
      break;
    }

    // ── finalize ──
    case "finalize": {
      const { date } = flags;
      if (!date) { console.error("❌ --date required"); process.exit(1); }

      const editionId = await getEditionId(date);
      if (!editionId) { console.error(`❌ Edition ${date} not found.`); process.exit(1); }

      await query(
        "UPDATE editions SET status = 'published', published_at = datetime('now') WHERE id = ?",
        [editionId]
      );

      console.log(`✅ Edition ${date} finalized and marked as published`);
      break;
    }

    // ── status ──
    case "status": {
      const { date } = flags;

      if (date) {
        // Single edition status
        const editionId = await getEditionId(date);
        if (!editionId) { console.log(`No edition found for ${date}`); break; }

        const edition = await query("SELECT * FROM editions WHERE id = ?", [editionId]);
        const sections = await query(
          "SELECT section_key, status, LENGTH(research_data) as research_len, LENGTH(html_fragment) as html_len FROM sections WHERE edition_id = ? ORDER BY section_key",
          [editionId]
        );

        const e = edition.results[0];
        console.log(`\n📰 Edition: ${e.edition_date} (#${e.edition_number}) — ${e.status}`);
        if (e.started_at || e.completed_at || e.total_tokens) {
          let metrics = [];
          if (e.started_at && e.completed_at) {
            const start = new Date(e.started_at + "Z");
            const end = new Date(e.completed_at + "Z");
            const diffMs = end - start;
            const mins = Math.floor(diffMs / 60000);
            const secs = Math.floor((diffMs % 60000) / 1000);
            metrics.push(`⏱  ${mins}m ${secs}s`);
          }
          if (e.total_tokens) {
            metrics.push(`🔤 ${parseInt(e.total_tokens).toLocaleString()} tokens`);
          }
          if (metrics.length) console.log(`   ${metrics.join("  ·  ")}`);
        }
        console.log("─".repeat(60));
        for (const s of sections.results) {
          const research = s.research_len ? `✅ ${s.research_len}b` : "⬜";
          const html = s.html_len ? `✅ ${s.html_len}b` : "⬜";
          console.log(`  ${s.section_key.padEnd(25)} R:${research.padEnd(12)} D:${html.padEnd(12)} [${s.status}]`);
        }
      } else {
        // All editions overview
        const result = await query(
          "SELECT edition_date, edition_number, status, published_at, started_at, completed_at, total_tokens FROM editions ORDER BY edition_date DESC LIMIT 30"
        );
        if (result.results.length === 0) {
          console.log("No editions found.");
        } else {
          console.log(`\n📰 Sift Editions (${result.results.length} most recent):`);
          console.log("─".repeat(70));
          for (const e of result.results) {
            let extras = [];
            if (e.started_at && e.completed_at) {
              const start = new Date(e.started_at + "Z");
              const end = new Date(e.completed_at + "Z");
              const mins = Math.floor((end - start) / 60000);
              const secs = Math.floor(((end - start) % 60000) / 1000);
              extras.push(`${mins}m${secs}s`);
            }
            if (e.total_tokens) extras.push(`${parseInt(e.total_tokens).toLocaleString()}tok`);
            const pub = e.published_at ? ` · published` : "";
            const met = extras.length ? ` · ${extras.join(" · ")}` : "";
            console.log(`  #${String(e.edition_number).padEnd(4)} ${e.edition_date}  [${e.status}]${pub}${met}`);
          }
        }
      }
      break;
    }

    // ── start-timer ──
    case "start-timer": {
      const { date } = flags;
      if (!date) { console.error("❌ --date required"); process.exit(1); }

      const editionId = await getEditionId(date);
      if (!editionId) { console.error(`❌ Edition ${date} not found.`); process.exit(1); }

      await query(
        "UPDATE editions SET started_at = datetime('now') WHERE id = ?",
        [editionId]
      );

      console.log(`✅ Timer started for edition ${date}`);
      break;
    }

    // ── save-metrics ──
    case "save-metrics": {
      const { date, tokens } = flags;
      if (!date) { console.error("❌ --date required"); process.exit(1); }

      const editionId = await getEditionId(date);
      if (!editionId) { console.error(`❌ Edition ${date} not found.`); process.exit(1); }

      const updates = ["completed_at = datetime('now')"];
      const params = [];
      if (tokens) {
        updates.push("total_tokens = ?");
        params.push(parseInt(tokens));
      }
      params.push(editionId);

      await query(
        `UPDATE editions SET ${updates.join(", ")} WHERE id = ?`,
        params
      );

      // Calculate elapsed time if started_at exists
      const edition = await query("SELECT started_at, completed_at FROM editions WHERE id = ?", [editionId]);
      const e = edition.results[0];
      let elapsed = "";
      if (e.started_at && e.completed_at) {
        const start = new Date(e.started_at + "Z");
        const end = new Date(e.completed_at + "Z");
        const diffMs = end - start;
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        elapsed = ` (${mins}m ${secs}s)`;
      }

      console.log(`✅ Metrics saved for edition ${date}${elapsed}${tokens ? ` · ${parseInt(tokens).toLocaleString()} tokens` : ""}`);
      break;
    }

    // ── reset-edition ──
    case "reset-edition": {
      const { date } = flags;
      if (!date) { console.error("❌ --date required"); process.exit(1); }

      const editionId = await getEditionId(date);
      if (!editionId) { console.error(`❌ Edition ${date} not found.`); process.exit(1); }

      // 1. Delete content_index records for this edition
      const contentResult = await query(
        "DELETE FROM content_index WHERE edition_id = ?",
        [editionId]
      );

      // 2. Delete section records for this edition
      const sectionResult = await query(
        "DELETE FROM sections WHERE edition_id = ?",
        [editionId]
      );

      // 3. Delete the edition record itself
      await query("DELETE FROM editions WHERE id = ?", [editionId]);

      // 4. Delete the local HTML file if it exists
      const htmlPath = path.join(ROOT, "site", "issues", date, "index.html");
      const htmlDir = path.join(ROOT, "site", "issues", date);
      let htmlDeleted = false;
      if (fs.existsSync(htmlPath)) {
        fs.unlinkSync(htmlPath);
        // Remove directory if empty
        try { fs.rmdirSync(htmlDir); } catch {}
        htmlDeleted = true;
      }

      console.log(`✅ Reset edition ${date}:`);
      console.log(`   — Deleted content_index records for edition ${editionId}`);
      console.log(`   — Deleted section records for edition ${editionId}`);
      console.log(`   — Deleted edition record`);
      console.log(`   — ${htmlDeleted ? "Deleted" : "No"} local HTML at site/issues/${date}/`);
      console.log(`\n   To re-run: node scripts/d1-save.mjs create-edition --date ${date}`);
      break;
    }

    // ── validate-research ──
    case "validate-research": {
      // Delegate to standalone script for full validation
      const { execSync } = await import("child_process");
      const args = process.argv.slice(3).join(" ");
      try {
        execSync(`node scripts/validate-research.mjs ${args}`, { cwd: ROOT, stdio: "inherit" });
      } catch (e) {
        process.exit(e.status || 1);
      }
      break;
    }

    // ── purge-old ──
    case "purge-old": {
      const days = parseInt(flags.days) || 30;
      console.log(`🗑️  Purging content_index entries older than ${days} days...`);

      const contentResult = await query(
        `DELETE FROM content_index WHERE created_at < datetime('now', '-${days} days')`
      );
      console.log(`   Deleted old content_index rows`);

      // Clear research_data and html_fragment for editions older than 90 days (keep metadata)
      const dataResult = await query(
        `UPDATE sections SET research_data = NULL, html_fragment = NULL
         WHERE edition_id IN (
           SELECT id FROM editions WHERE edition_date < date('now', '-90 days')
         ) AND research_data IS NOT NULL`
      );
      console.log(`   Cleared research/design data for editions older than 90 days`);
      console.log(`✅ Purge complete`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error("\nAvailable commands:");
      console.error("  create-edition  --date YYYY-MM-DD");
      console.error("  save-research   --date YYYY-MM-DD --section KEY --file PATH");
      console.error("  save-design     --date YYYY-MM-DD --section KEY --file PATH");
      console.error("  record          --date YYYY-MM-DD --section KEY --type TYPE --id ID [--title T] [--url U] [--source S] [--tier 1-4]");
      console.error("  check           --type TYPE --id ID");
      console.error("  check-url       --url URL");
      console.error("  check-fuzzy     --title TITLE [--threshold 0.4]");
      console.error("  list            [--type TYPE] [--section KEY] [--last N]");
      console.error("  read-research   --date YYYY-MM-DD --section KEY");
      console.error("  finalize        --date YYYY-MM-DD");
      console.error("  start-timer     --date YYYY-MM-DD");
      console.error("  save-metrics    --date YYYY-MM-DD [--tokens N]");
      console.error("  reset-edition   --date YYYY-MM-DD");
      console.error("  status          [--date YYYY-MM-DD]");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
