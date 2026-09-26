# Fuzzy Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add entity-weighted fuzzy title matching with source tier tracking to Sift's dedup pipeline, so parroted stories get filtered while authoritative sources and novel angles pass through.

**Architecture:** A new `scripts/shared/fuzzy.mjs` module handles all similarity logic (normalize, tokenize, bigram, entity match, composite score). The `d1-save.mjs` CLI gets a `check-fuzzy` command that queries recent titles from D1 and scores them. The `record` command gains a `--tier` flag. Research instructions are updated to use `check-fuzzy` instead of the "mental check."

**Tech Stack:** Node.js (ESM), Cloudflare D1 REST API, no new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-03-26-fuzzy-dedup-design.md`

---

### Task 1: Create the Entity Dictionary

**Files:**
- Create: `data/entities.json`

- [ ] **Step 1: Create the `data/` directory and entity dictionary**

```bash
mkdir -p data
```

Write `data/entities.json`:

```json
{
  "anthropic": ["anthropic", "claude", "claude code", "claude ai", "sonnet", "opus", "haiku", "claude max", "claude pro"],
  "openai": ["openai", "chatgpt", "gpt-4", "gpt-4o", "gpt-5", "dall-e", "sora", "codex"],
  "google": ["google", "gemini", "deepmind", "gemma", "google ai"],
  "meta": ["meta", "llama", "meta ai"],
  "microsoft": ["microsoft", "copilot", "azure ai", "github copilot"],
  "apple": ["apple", "apple intelligence"],
  "mistral": ["mistral", "mixtral", "mistral ai"],
  "stability": ["stability ai", "stable diffusion"],
  "xai": ["xai", "grok", "x ai"],
  "perplexity": ["perplexity", "perplexity ai"],
  "anthropic-dream": ["dream", "claude dream"],
  "mcp": ["mcp", "model context protocol"],
  "huggingface": ["hugging face", "huggingface", "transformers"]
}
```

- [ ] **Step 2: Commit**

```bash
git add data/entities.json
git commit -m "feat: add entity dictionary for fuzzy dedup"
```

---

### Task 2: Create the Fuzzy Similarity Module

**Files:**
- Create: `scripts/shared/fuzzy.mjs`

- [ ] **Step 1: Write the test file**

Create `scripts/shared/fuzzy.test.mjs`:

```javascript
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { normalize, tokenize, bigrams, entityMatches, compositeScore, loadEntities } from "./fuzzy.mjs";

test("normalize strips punctuation, lowercases, collapses whitespace", () => {
  assert.equal(normalize("Anthropic Launches Dream!!! — For Claude Code"), "anthropic launches dream for claude code");
  assert.equal(normalize("  GPT-5   Released  "), "gpt-5 released");
  assert.equal(normalize(""), "");
});

test("tokenize removes stop words", () => {
  const tokens = tokenize("anthropic launches dream for claude code");
  assert.ok(!tokens.includes("for"));
  assert.ok(tokens.includes("anthropic"));
  assert.ok(tokens.includes("launches"));
  assert.ok(tokens.includes("dream"));
  assert.ok(tokens.includes("claude"));
  assert.ok(tokens.includes("code"));
});

test("bigrams produces consecutive word pairs", () => {
  const b = bigrams(["anthropic", "launches", "dream", "claude", "code"]);
  assert.deepEqual(b, [
    "anthropic launches",
    "launches dream",
    "dream claude",
    "claude code",
  ]);
});

test("bigrams returns empty for single word", () => {
  assert.deepEqual(bigrams(["hello"]), []);
});

test("entityMatches finds matching entities between two titles", () => {
  const entities = {
    anthropic: ["anthropic", "claude", "claude code"],
    openai: ["openai", "chatgpt"],
  };
  const a = "anthropic launches dream for claude code";
  const b = "claude code gets new dream feature from anthropic";
  const matches = entityMatches(a, b, entities);
  assert.ok(matches.includes("anthropic"));
  assert.ok(!matches.includes("openai"));
});

test("entityMatches returns empty when no shared entities", () => {
  const entities = {
    anthropic: ["anthropic", "claude"],
    openai: ["openai", "chatgpt"],
  };
  const matches = entityMatches("anthropic releases claude", "openai launches chatgpt", entities);
  assert.deepEqual(matches, []);
});

test("compositeScore is high for similar titles about same topic", () => {
  const entities = {
    anthropic: ["anthropic", "claude", "claude code"],
    "anthropic-dream": ["dream", "claude dream"],
  };
  const score = compositeScore(
    "Anthropic launches Dream for Claude Code",
    "Claude Code gets new Dream feature from Anthropic",
    entities
  );
  assert.ok(score.total > 0.6, `Expected > 0.6, got ${score.total}`);
});

test("compositeScore is low for unrelated titles", () => {
  const entities = {
    anthropic: ["anthropic", "claude"],
    openai: ["openai", "chatgpt"],
  };
  const score = compositeScore(
    "Anthropic launches Dream for Claude Code",
    "OpenAI raises $10B funding round",
    entities
  );
  assert.ok(score.total < 0.3, `Expected < 0.3, got ${score.total}`);
});

test("compositeScore returns breakdown with word, bigram, entity scores", () => {
  const entities = { anthropic: ["anthropic"] };
  const score = compositeScore("anthropic news today", "anthropic news today", entities);
  assert.ok("word" in score);
  assert.ok("bigram" in score);
  assert.ok("entity" in score);
  assert.ok("total" in score);
  assert.equal(score.word, 1);
  assert.equal(score.bigram, 1);
});

test("loadEntities reads data/entities.json", () => {
  const entities = loadEntities();
  assert.ok("anthropic" in entities);
  assert.ok(Array.isArray(entities.anthropic));
  assert.ok(entities.anthropic.includes("claude"));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test scripts/shared/fuzzy.test.mjs
```

Expected: FAIL — module `./fuzzy.mjs` not found.

- [ ] **Step 3: Write the fuzzy module**

Create `scripts/shared/fuzzy.mjs`:

```javascript
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "its", "as", "are", "was",
  "were", "be", "been", "being", "have", "has", "had", "do", "does",
  "did", "will", "would", "could", "should", "may", "might", "can",
  "this", "that", "these", "those", "not", "no", "nor", "so", "if",
  "than", "too", "very", "just", "about", "into", "over", "after",
  "before", "between", "under", "again", "then", "here", "there",
  "when", "where", "how", "all", "each", "every", "both", "few",
  "more", "most", "other", "some", "such", "only", "own", "same",
  "also", "up", "out", "new", "now", "get", "gets", "got",
]);

/**
 * Normalize a title: lowercase, strip punctuation (keep hyphens in words), collapse whitespace.
 */
export function normalize(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenize a normalized title, removing stop words.
 */
export function tokenize(normalizedTitle) {
  return normalizedTitle
    .split(" ")
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));
}

/**
 * Generate bigrams from a token array.
 */
export function bigrams(tokens) {
  const result = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    result.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return result;
}

/**
 * Jaccard similarity between two sets (as arrays).
 */
function jaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/**
 * Find entity keys that match in BOTH titles.
 * An entity matches a title if any of its aliases appear as a substring.
 */
export function entityMatches(normalizedA, normalizedB, entities) {
  const matched = [];
  for (const [key, aliases] of Object.entries(entities)) {
    const inA = aliases.some((alias) => normalizedA.includes(alias));
    const inB = aliases.some((alias) => normalizedB.includes(alias));
    if (inA && inB) matched.push(key);
  }
  return matched;
}

/**
 * Compute composite similarity score between two titles.
 * Returns { word, bigram, entity, entities, total }.
 *
 * Weights: word 0.3, bigram 0.3, entity 0.4
 */
export function compositeScore(titleA, titleB, entities) {
  const normA = normalize(titleA);
  const normB = normalize(titleB);

  const tokensA = tokenize(normA);
  const tokensB = tokenize(normB);

  const wordScore = jaccard(tokensA, tokensB);
  const bigramScore = jaccard(bigrams(tokensA), bigrams(tokensB));

  const matched = entityMatches(normA, normB, entities);

  // Entity score: proportion of all entities present in EITHER title that are shared
  const allEntities = new Set();
  for (const [key, aliases] of Object.entries(entities)) {
    const inA = aliases.some((alias) => normA.includes(alias));
    const inB = aliases.some((alias) => normB.includes(alias));
    if (inA || inB) allEntities.add(key);
  }
  const entityScore = allEntities.size > 0 ? matched.length / allEntities.size : 0;

  const total = 0.3 * wordScore + 0.3 * bigramScore + 0.4 * entityScore;

  return {
    word: Math.round(wordScore * 100) / 100,
    bigram: Math.round(bigramScore * 100) / 100,
    entity: Math.round(entityScore * 100) / 100,
    entities: matched,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Load entity dictionary from data/entities.json.
 */
export function loadEntities() {
  const filePath = path.join(ROOT, "data", "entities.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test scripts/shared/fuzzy.test.mjs
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/shared/fuzzy.mjs scripts/shared/fuzzy.test.mjs
git commit -m "feat: add fuzzy similarity module with entity-weighted scoring"
```

---

### Task 3: Add `source_tier` Column to Database

**Files:**
- Modify: `scripts/d1-init.mjs:79-90` (update schema)

- [ ] **Step 1: Update the `content_index` CREATE TABLE in `d1-init.mjs`**

In `scripts/d1-init.mjs`, change the `content_index` table definition (line 79-90) from:

```javascript
  `CREATE TABLE IF NOT EXISTS content_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    edition_id INTEGER NOT NULL,
    section_key TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    title TEXT,
    url TEXT,
    source TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (edition_id) REFERENCES editions(id)
  )`,
```

to:

```javascript
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
```

Also add a migration section after the SCHEMA array (before the `main()` function, around line 97):

```javascript
const MIGRATIONS = [
  `ALTER TABLE content_index ADD COLUMN source_tier INTEGER DEFAULT 3`,
];
```

Update the `main()` function to run migrations after schema:

```javascript
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
```

- [ ] **Step 2: Run the migration against D1**

```bash
node scripts/d1-init.mjs
```

Expected: `✅ ALTER TABLE content_index ADD COLUMN source_tier` (or `⏭️ already applied` on re-run).

- [ ] **Step 3: Commit**

```bash
git add scripts/d1-init.mjs
git commit -m "feat: add source_tier column to content_index"
```

---

### Task 4: Add `--tier` Flag to `record` Command and `check-fuzzy` Command

**Files:**
- Modify: `scripts/d1-save.mjs:228-246` (record command)
- Modify: `scripts/d1-save.mjs:411-424` (help text)

- [ ] **Step 1: Write test for `check-fuzzy` CLI output parsing**

Create `scripts/shared/check-fuzzy.test.mjs`:

```javascript
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formatFuzzyResults } from "./fuzzy.mjs";

test("formatFuzzyResults formats matches with tier labels", () => {
  const matches = [
    {
      title: "Anthropic Launches Dream",
      edition_date: "2026-03-24",
      section_key: "04-claude-anthropic",
      source_tier: 1,
      score: { total: 0.82, word: 0.71, bigram: 0.65, entity: 1.0, entities: ["anthropic"] },
    },
  ];
  const output = formatFuzzyResults(matches);
  assert.ok(output.includes("0.82"));
  assert.ok(output.includes("Anthropic Launches Dream"));
  assert.ok(output.includes("tier 1"));
  assert.ok(output.includes("authoritative"));
});

test("formatFuzzyResults returns clean message for no matches", () => {
  const output = formatFuzzyResults([]);
  assert.ok(output.includes("No similar content"));
});

test("tier labels are correct", () => {
  const tiers = [
    { source_tier: 1, title: "t", edition_date: "d", section_key: "s", score: { total: 0.5, word: 0, bigram: 0, entity: 0, entities: [] } },
    { source_tier: 2, title: "t", edition_date: "d", section_key: "s", score: { total: 0.5, word: 0, bigram: 0, entity: 0, entities: [] } },
    { source_tier: 3, title: "t", edition_date: "d", section_key: "s", score: { total: 0.5, word: 0, bigram: 0, entity: 0, entities: [] } },
    { source_tier: 4, title: "t", edition_date: "d", section_key: "s", score: { total: 0.5, word: 0, bigram: 0, entity: 0, entities: [] } },
  ];
  const output = formatFuzzyResults(tiers);
  assert.ok(output.includes("authoritative"));
  assert.ok(output.includes("major outlet"));
  assert.ok(output.includes("tech press"));
  assert.ok(output.includes("blog/community"));
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test scripts/shared/check-fuzzy.test.mjs
```

Expected: FAIL — `formatFuzzyResults` not exported from `./fuzzy.mjs`.

- [ ] **Step 3: Add `formatFuzzyResults` to `scripts/shared/fuzzy.mjs`**

Append to the end of `scripts/shared/fuzzy.mjs`, before the closing:

```javascript
const TIER_LABELS = {
  1: "authoritative",
  2: "major outlet",
  3: "tech press",
  4: "blog/community",
};

/**
 * Format fuzzy match results for CLI output.
 */
export function formatFuzzyResults(matches) {
  if (matches.length === 0) {
    return "✅ No similar content found in last 7 days";
  }

  const lines = [`⚠️  Similar content found (${matches.length} match${matches.length > 1 ? "es" : ""}):\n`];

  for (const m of matches) {
    const tierLabel = TIER_LABELS[m.source_tier] || "unknown";
    lines.push(`  ${m.score.total.toFixed(2)}  "${m.title}"`);
    lines.push(`        ${m.edition_date} · ${m.section_key} · tier ${m.source_tier} (${tierLabel})`);
    if (m.score.entities.length > 0) {
      lines.push(`        Entities: ${m.score.entities.join(", ")}`);
    }
    lines.push(`        Words: ${m.score.word.toFixed(2)} · Bigrams: ${m.score.bigram.toFixed(2)} · Entities: ${m.score.entity.toFixed(2)}`);
    lines.push("");
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test scripts/shared/check-fuzzy.test.mjs
```

Expected: All tests PASS.

- [ ] **Step 5: Update `record` command in `d1-save.mjs` to accept `--tier`**

In `scripts/d1-save.mjs`, change the `record` case (lines 228-246) from:

```javascript
    // ── record ──
    case "record": {
      const { date, section, type, id, title, url, source } = flags;
      if (!date || !section || !type || !id) {
        console.error("❌ --date, --section, --type, --id required"); process.exit(1);
      }

      const editionId = await getEditionId(date);
      if (!editionId) { console.error(`❌ Edition ${date} not found.`); process.exit(1); }

      await query(
        `INSERT INTO content_index (edition_id, section_key, content_type, content_id, title, url, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [editionId, section, type, id, title || null, url || null, source || null]
      );

      console.log(`✅ Recorded ${type}: ${id} (${title || "untitled"})`);
      break;
    }
```

to:

```javascript
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
```

- [ ] **Step 6: Add `check-fuzzy` command to `d1-save.mjs`**

Insert the following case after the `check-url` case (after line 298), before the `list` case:

```javascript
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
```

- [ ] **Step 7: Update the help text in the default case**

In `scripts/d1-save.mjs`, update the default case help text (around line 411-424) to include:

```javascript
      console.error("  check-fuzzy     --title TITLE [--threshold 0.4]");
```

Add it after the `check-url` line, and update the `record` line to show `--tier`:

```javascript
      console.error("  record          --date YYYY-MM-DD --section KEY --type TYPE --id ID [--title T] [--url U] [--source S] [--tier 1-4]");
```

Also update the usage comment at the top of the file (lines 18-23) to include:

```javascript
 *   # Fuzzy title match (entity-weighted similarity)
 *   node scripts/d1-save.mjs check-fuzzy --title "Anthropic launches Dream" [--threshold 0.4]
 *
 *   # Record content with source tier
 *   node scripts/d1-save.mjs record --date 2026-03-25 --section 04-claude-anthropic --type story --id "slug" --title "Title" --url "URL" --source "Source" --tier 1
```

- [ ] **Step 8: Commit**

```bash
git add scripts/d1-save.mjs scripts/shared/check-fuzzy.test.mjs scripts/shared/fuzzy.mjs
git commit -m "feat: add check-fuzzy command and --tier flag to record"
```

---

### Task 5: Update Research Instructions

**Files:**
- Modify: `instructions/RESEARCH_MAIN.md:46-57`
- Modify: `instructions/MAIN.md:113-119`
- Modify: `instructions/research/03-top-stories.md:12-21`
- Modify: `instructions/research/04-claude-anthropic.md:12-17`
- Modify: `instructions/research/05-openai.md` (dedup section)
- Modify: `instructions/research/06-new-models.md` (dedup section)
- Modify: `instructions/research/07-local-ai.md` (dedup section)
- Modify: `instructions/research/08-business-deals.md` (dedup section)
- Modify: `instructions/research/09-dev-tools.md` (dedup section)
- Modify: `instructions/research/10-open-source.md` (dedup section)
- Modify: `instructions/research/11-youtube.md` (dedup section)

- [ ] **Step 1: Update `RESEARCH_MAIN.md` dedup section**

Replace the "Deduplication Process" section (lines 46-57) with:

```markdown
### Deduplication Process

Before including ANY item, run these checks in order:

1. `node scripts/d1-save.mjs check-url --url "{url}"` — exact URL match in last 7 days
2. `node scripts/d1-save.mjs check-fuzzy --title "{title}"` — fuzzy title match (entity-weighted similarity)
3. If check-url finds a match: **skip it** (exact duplicate)
4. If check-fuzzy finds matches, follow the decision framework:

#### Fuzzy Match Decision Framework

**Score >= 0.7 (strong match):**
- **Skip** unless the new article provides one of:
  - Genuinely new facts (benchmarks, pricing, release dates not in the original)
  - First-hand experience (someone testing/using the thing and writing about their actual results)
  - Authoritative source replacing a lower-tier one (e.g., the official blog just dropped, but only an aggregator was recorded)

**Score 0.4–0.7 (possible match):**
- Read both titles and the matched entry's source tier
- You must state in the research JSON `dedup_justification` field *why* this isn't a duplicate (one sentence)
- If you can't articulate a reason, skip it

**Score < 0.4:**
- No match surfaced, proceed normally

#### Source Tier Logic

When recording content, assign a `--tier` value:
- `--tier 1` — Official source (company blog, press release, official repo)
- `--tier 2` — Major outlet with original reporting (Reuters, Bloomberg, NYT, The Information)
- `--tier 3` — Tech press / aggregator (TechCrunch, The Verge, VentureBeat) — **default if omitted**
- `--tier 4` — Blog, influencer, community post (Substack, Reddit, YouTube)

When a match exists from a **higher tier** (lower number = more authoritative), the bar for re-inclusion is very high. When a match exists only from a **lower tier**, consider replacing it if an authoritative source just published.

After including an item, record it with its tier:
```bash
node scripts/d1-save.mjs record --date {YYYY-MM-DD} --section {section-key} --type {type} --id "{slug}" --title "{title}" --url "{url}" --source "{source-name}" --tier {1-4}
```
```

Also add `dedup_justification` to the Output JSON Schema field definitions table in `RESEARCH_MAIN.md` (around line 253):

```markdown
| `dedup_justification` | no | One-sentence explanation of why this item was included despite a fuzzy match score of 0.4-0.7. Required when check-fuzzy flags a possible match. |
```

- [ ] **Step 2: Update `MAIN.md` dedup rules**

Replace the "Deduplication Rules" section (lines 113-119) with:

```markdown
### Deduplication Rules

1. **Check URL:** `node scripts/d1-save.mjs check-url --url "{url}"` — if seen in last 7 days, skip
2. **Fuzzy title match:** `node scripts/d1-save.mjs check-fuzzy --title "{title}"` — entity-weighted similarity check against recent content
3. **Same story, different source:** Keep only the best (highest-tier) source. Prefer authoritative/official over aggregator.
4. **Updates to running stories:** Include if there's genuinely new information, but note it's an update
5. **Source tiers:** Record every item with `--tier 1-4` for future dedup decisions (1=official, 2=major outlet, 3=tech press, 4=blog/community)
```

- [ ] **Step 3: Update per-section research instructions**

For each section file, replace the existing "Deduplication Check" section with the new version. The pattern is the same for all sections — only the `--section` value and `--type` value change.

**`instructions/research/03-top-stories.md`** — replace lines 12-21 with:

```markdown
## Deduplication Check

Before finalizing each item, run both checks:
```bash
node scripts/d1-save.mjs check-url --url "{url}"
node scripts/d1-save.mjs check-fuzzy --title "{title}"
```
Follow the fuzzy match decision framework in RESEARCH_MAIN.md. If score >= 0.7, skip unless genuinely new. If 0.4-0.7, justify in `dedup_justification`.

After finalizing, record each item with its source tier:
```bash
node scripts/d1-save.mjs record --date {YYYY-MM-DD} --section 03-top-stories --type story --id "{slug}" --title "{title}" --url "{url}" --source "{source}" --tier {1-4}
```
```

**`instructions/research/04-claude-anthropic.md`** — replace lines 12-17 with:

```markdown
## Deduplication Check

Before finalizing each item, run both checks:
```bash
node scripts/d1-save.mjs check-url --url "{url}"
node scripts/d1-save.mjs check-fuzzy --title "{title}"
```
Follow the fuzzy match decision framework in RESEARCH_MAIN.md. If score >= 0.7, skip unless genuinely new. If 0.4-0.7, justify in `dedup_justification`.

After finalizing, record each item with its source tier:
```bash
node scripts/d1-save.mjs record --date {YYYY-MM-DD} --section 04-claude-anthropic --type story --id "{slug}" --title "{title}" --url "{url}" --source "{source}" --tier {1-4}
```
```

**Apply the same pattern to sections 05-11**, changing only the `--section` value and `--type` value:

| File | `--section` | `--type` |
|------|-------------|----------|
| `05-openai.md` | `05-openai` | `story` |
| `06-new-models.md` | `06-new-models` | `model` |
| `07-local-ai.md` | `07-local-ai` | `story` |
| `08-business-deals.md` | `08-business-deals` | `deal` |
| `09-dev-tools.md` | `09-dev-tools` | `tool` |
| `10-open-source.md` | `10-open-source` | `repo` |
| `11-youtube.md` | `11-youtube` | `video` |

- [ ] **Step 4: Commit**

```bash
git add instructions/RESEARCH_MAIN.md instructions/MAIN.md instructions/research/*.md
git commit -m "feat: update research instructions to use check-fuzzy and source tiers"
```

---

### Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (dedup strategy section and D1 commands)

- [ ] **Step 1: Update the D1 Database Commands section**

In `CLAUDE.md`, add the new commands to the D1 Database Commands code block:

```bash
node scripts/d1-save.mjs check-fuzzy --title "Title" [--threshold 0.4]
node scripts/d1-save.mjs record --date YYYY-MM-DD --section KEY --type TYPE --id ID --title "Title" --url URL --tier 1-4
```

- [ ] **Step 2: Update the Deduplication Strategy section**

Replace the existing dedup strategy section with:

```markdown
### Deduplication Strategy
- **URL-based:** Every story URL is recorded in `content_index`. Before including a story, `check-url` verifies it hasn't appeared in the last 7 days.
- **Fuzzy title match:** `check-fuzzy` uses entity-weighted similarity (word Jaccard 30% + bigram Jaccard 30% + entity overlap 40%) to catch the same story from different sources with different headlines. Threshold: 0.4. Entity dictionary in `data/entities.json`.
- **Content ID:** Stable identifiers (e.g., model name, repo slug, company name) for semantic dedup via `check`.
- **Source tiers:** Every recorded item includes a source tier (1=authoritative, 2=major outlet, 3=tech press, 4=blog/community). Higher-tier coverage raises the bar for re-inclusion from lower-tier sources.
- **7-day dedup window** — stories seen in the last 7 days won't repeat unless they add genuinely new information or an authoritative source replaces a lower-tier one.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with fuzzy dedup and source tier documentation"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Run all tests**

```bash
node --test scripts/shared/fuzzy.test.mjs scripts/shared/check-fuzzy.test.mjs
```

Expected: All tests PASS.

- [ ] **Step 2: Run the migration**

```bash
node scripts/d1-init.mjs
```

Expected: All schema items pass or skip (already applied). `source_tier` migration succeeds or shows "already applied."

- [ ] **Step 3: Test `check-fuzzy` against the live database**

```bash
node scripts/d1-save.mjs check-fuzzy --title "Anthropic launches new Claude feature"
```

Expected: Either "No similar content found" (if DB is empty) or a list of matches with scores, tiers, and entity breakdowns. No errors.

- [ ] **Step 4: Test `record` with `--tier`**

If an edition exists (check with `node scripts/d1-save.mjs status`), test:

```bash
node scripts/d1-save.mjs record --date {existing-date} --section 03-top-stories --type story --id "test-fuzzy-dedup" --title "Test fuzzy dedup story" --url "https://example.com/test" --source "Test" --tier 1
```

Expected: `✅ Recorded story: test-fuzzy-dedup (Test fuzzy dedup story) [tier 1]`

Then verify fuzzy check catches it:

```bash
node scripts/d1-save.mjs check-fuzzy --title "Test fuzzy dedup story"
```

Expected: Match with score ~1.0.

- [ ] **Step 5: Commit any fixes from verification**

Only if issues were found and fixed during steps 1-4.
