#!/usr/bin/env node
/**
 * Edition Deduplication
 *
 * Scans all research JSON files for duplicate candidates within and across
 * sections. Exact URL or stable-ID matches are removed automatically. Fuzzy
 * matches remain in place and are written to a report for editorial review.
 *
 * Usage:
 *   node scripts/cross-section-dedup.mjs --date YYYY-MM-DD [--dry-run]
 *
 * Priority rules for exact duplicates:
 *   1. Top Stories (03) — the reader's headline section wins
 *   2. Section-specific (04-15)
 *   3. Business and YouTube lose to primary coverage
 *
 * When merging: the winning version gets any unique summary_bullets from
 * the losing version appended.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEntities } from './shared/fuzzy.mjs';
import { analyzeDedupPairs, mergeUniqueBullets, selectWinner } from './shared/dedup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const dateIdx = args.indexOf('--date');
const DATE = dateIdx >= 0 ? args[dateIdx + 1] : null;
const DRY_RUN = args.includes('--dry-run');

if (!DATE) {
  console.error('Usage: node scripts/cross-section-dedup.mjs --date YYYY-MM-DD [--dry-run]');
  process.exit(1);
}

// Section priority: higher = wins when duplicate.
// Top Stories WINS over specific sections (it's the reader's first stop).
// Specific sections WIN over Business (avoids double-counting funding in both company + deals).
// Dev Tools loses to company-specific (Claude Code goes in Claude section, not tools).
const PRIORITY = {
  '03-top-stories': 10,     // reader's headline section — always wins
  '04-claude-anthropic': 8,
  '05-openai': 8,
  '06-new-models': 8,
  '07-local-ai': 8,
  '13-openclaw': 8,
  '14-model-leaderboard': 8,
  '15-humanoid-robotics': 8,
  '10-open-source': 7,
  '09-dev-tools': 6,        // loses to company-specific sections
  '08-business-deals': 5,   // loses to company sections and top stories
  '11-youtube': 4,           // video coverage is supplementary
};

// All sections with standard news items
const SECTIONS = [
  '03-top-stories', '04-claude-anthropic', '05-openai', '06-new-models',
  '07-local-ai', '08-business-deals', '09-dev-tools', '10-open-source',
  '11-youtube', '13-openclaw', '15-humanoid-robotics'
];

function readResearch(key) {
  const p = path.join(ROOT, 'tmp', `${key}-research.json`);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function writeResearch(key, data) {
  const p = path.join(ROOT, 'tmp', `${key}-research.json`);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

const ENTITIES = loadEntities();

// Load all sections
const sectionData = {};
for (const key of SECTIONS) {
  const data = readResearch(key);
  if (data && data.items && data.items.length > 0) {
    sectionData[key] = data;
  }
}

// Build a flat list of all items with section references
const allItems = [];
for (const [section, data] of Object.entries(sectionData)) {
  for (let i = 0; i < data.items.length; i++) {
    allItems.push({ section, index: i, item: data.items[i] });
  }
}

const { exactDuplicates, reviewCandidates } = analyzeDedupPairs(allItems, ENTITIES);

// Decide winners
const removals = new Map(); // key: "section:index" → true
const exactDecisions = [];

for (const duplicate of exactDuplicates) {
  const { winner, loser } = selectWinner(duplicate.a, duplicate.b, PRIORITY);
  exactDecisions.push({ ...duplicate, winner, loser, action: 'REMOVE_EXACT_DUPLICATE' });

  const matchType = duplicate.urlMatch && duplicate.idMatch
    ? 'URL + ID'
    : duplicate.urlMatch ? 'URL' : 'ID';
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}DEDUP (${matchType}): "${loser.item.title}"`);
  console.log(`  REMOVE from ${loser.section} → KEEP in ${winner.section}`);

  // Merge unique bullets from loser into winner
  if (loser.item.summary_bullets && loser.item.summary_bullets.length > 0) {
    const mergeTarget = DRY_RUN
      ? { ...winner.item, summary_bullets: [...(winner.item.summary_bullets || [])] }
      : winner.item;
    const newBullets = mergeUniqueBullets(mergeTarget, loser.item);
    if (newBullets.length > 0) {
      console.log(`  MERGED ${newBullets.length} unique bullets into winner`);
    }
  }

  removals.set(`${loser.section}:${loser.index}`, true);
}

const report = {
  date: DATE,
  generated_at: new Date().toISOString(),
  policy: {
    automatic_removal: 'exact URL or stable ID only',
    fuzzy_threshold: 0.4,
    fuzzy_action: 'editorial review required; both items retained',
  },
  exact_duplicates: exactDecisions,
  review_candidates: reviewCandidates.map(candidate => ({
    ...candidate,
    action: 'REVIEW_REQUIRED',
  })),
};

const reportPath = path.join(ROOT, 'tmp', 'dedup-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

for (const candidate of reviewCandidates) {
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}REVIEW (${candidate.classification}, fuzzy ${candidate.score.total.toFixed(2)}):`);
  console.log(`  ${candidate.a.section}: "${candidate.a.item.title}"`);
  console.log(`  ${candidate.b.section}: "${candidate.b.item.title}"`);
}

if (exactDuplicates.length === 0 && reviewCandidates.length === 0) {
  console.log('✅ No duplicate candidates found.');
  console.log(`   Report: ${reportPath}`);
  process.exit(0);
}

if (DRY_RUN) {
  console.log(`\n${removals.size} exact duplicates would be removed. Run without --dry-run to apply.`);
  console.log(`${reviewCandidates.length} fuzzy candidates require editorial review.`);
  console.log(`Report: ${reportPath}`);
  process.exit(0);
}

// Apply removals
let totalRemoved = 0;
for (const [section, data] of Object.entries(sectionData)) {
  const originalCount = data.items.length;
  data.items = data.items.filter((_, i) => !removals.has(`${section}:${i}`));
  const removed = originalCount - data.items.length;
  if (removed > 0) {
    data.item_count = data.items.length;
    writeResearch(section, data);
    console.log(`\n  ${section}: removed ${removed} dupes (${originalCount} → ${data.items.length})`);
    totalRemoved += removed;
  }
}

console.log(`\n✅ Exact dedup complete: removed ${totalRemoved} duplicate items.`);
console.log(`   Editorial review candidates: ${reviewCandidates.length}`);
console.log(`   Report: ${reportPath}`);
