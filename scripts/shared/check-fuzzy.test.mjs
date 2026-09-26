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
