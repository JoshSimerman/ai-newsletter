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
