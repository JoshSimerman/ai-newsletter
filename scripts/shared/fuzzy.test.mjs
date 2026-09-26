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
