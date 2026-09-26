#!/usr/bin/env node
/**
 * scripts/d1-init.mjs
 *
 * Initialize the D1 database schema for Sift.
 * Run once after creating the D1 database in Cloudflare.
 *
 * Usage: node scripts/d1-init.mjs
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
  console.error("❌ Set CF_ACCOUNT_ID, CF_API_TOKEN, CF_D1_DATABASE_ID in .env");
  process.exit(1);
}

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}`;

async function exec(sql) {
  const res = await fetch(`${BASE_URL}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
  });
  const data = await res.json();
  if (!data.success) {
    const errors = data.errors?.map((e) => e.message).join(", ");
    throw new Error(`D1 error: ${errors}`);
  }
  return data;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS editions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    edition_date TEXT NOT NULL UNIQUE,
    edition_number INTEGER NOT NULL UNIQUE,
    status TEXT DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now')),
    published_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    edition_id INTEGER NOT NULL,
    section_key TEXT NOT NULL,
    research_data TEXT,
    html_fragment TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (edition_id) REFERENCES editions(id),
    UNIQUE(edition_id, section_key)
  )`,

  `CREATE TABLE IF NOT EXISTS content_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    edition_id INTEGER NOT NULL,
    section_key TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    title TEXT,
    url TEXT,
    source TEXT,
    source_tier INTEGER DEFAULT 3,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (edition_id) REFERENCES editions(id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_content_lookup ON content_index(content_type, content_id)`,
  `CREATE INDEX IF NOT EXISTS idx_content_url ON content_index(url)`,
  `CREATE INDEX IF NOT EXISTS idx_content_recent ON content_index(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_edition_date ON editions(edition_date)`,
  `CREATE INDEX IF NOT EXISTS idx_section_edition ON sections(edition_id, section_key)`,
];

const MIGRATIONS = [
  `ALTER TABLE content_index ADD COLUMN source_tier INTEGER DEFAULT 3`,
  `ALTER TABLE editions ADD COLUMN started_at TEXT`,
  `ALTER TABLE editions ADD COLUMN completed_at TEXT`,
  `ALTER TABLE editions ADD COLUMN total_tokens INTEGER`,
];

async function main() {
  console.log("🔧 Initializing Sift D1 database...\n");

  for (const sql of SCHEMA) {
    const label = sql.match(/(?:CREATE TABLE|CREATE INDEX)[^(]*/)?.[0]?.trim() || sql.slice(0, 50);
    try {
      await exec(sql);
      console.log(`  ✅ ${label}`);
    } catch (err) {
      console.log(`  ⚠️  ${label}: ${err.message}`);
    }
  }

  console.log("\n🔧 Running migrations...\n");
  for (const sql of MIGRATIONS) {
    const label = sql.slice(0, 60);
    try {
      await exec(sql);
      console.log(`  ✅ ${label}`);
    } catch (err) {
      // "duplicate column" means it already ran — that's fine
      if (err.message.includes("duplicate column")) {
        console.log(`  ⏭️  ${label} (already applied)`);
      } else {
        console.log(`  ⚠️  ${label}: ${err.message}`);
      }
    }
  }

  console.log("\n✅ Database initialized successfully.");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
