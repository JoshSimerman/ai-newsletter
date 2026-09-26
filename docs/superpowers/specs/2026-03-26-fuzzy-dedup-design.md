# Fuzzy Deduplication for Sift

**Date:** 2026-03-26
**Status:** Approved

## Problem

Hot AI stories circulate across dozens of outlets over several days. The current dedup system only catches exact URL and exact content ID matches. When Anthropic drops a story like "Dream is now available," the authoritative blog post gets recorded — but TechCrunch, The Verge, VentureBeat, and 15 blogs all publish their own version with unique URLs and slightly different headlines. These parroted articles pass through the existing checks and clutter the digest.

The user wants:
- Authoritative sources prioritized (the Anthropic blog, not the rehash)
- Novel angles allowed through (someone testing Dream and writing about real experience)
- Parroting filtered out (same facts, different byline)

## Approach: Entity-Weighted Similarity with Bigram Overlap

Combine three signals into a composite similarity score, with an entity dictionary providing the strongest signal. All logic runs locally in JS — no external APIs, no npm dependencies.

## Data Model Changes

### Source Tiers

Add `source_tier` column to `content_index`:

| Tier | Meaning | Examples |
|------|---------|---------|
| `1` | Official / authoritative | Anthropic blog, OpenAI blog, company press release, official GitHub repo |
| `2` | Major outlet with original reporting | Reuters, Bloomberg, NYT, Ars Technica, The Information |
| `3` | Tech press / aggregator | TechCrunch, The Verge, VentureBeat, Wired |
| `4` | Blog / influencer / community | Personal blogs, Substack, Reddit posts, YouTube videos |

Added via `ALTER TABLE content_index ADD COLUMN source_tier INTEGER DEFAULT 3`. Existing rows get tier 3 (reasonable middle ground). The `record` command gets a new optional `--tier` flag.

### Entity Dictionary

New file: `data/entities.json`

A flat map of canonical entity names to aliases:

```json
{
  "anthropic": ["anthropic", "claude", "claude code", "sonnet", "opus", "haiku"],
  "openai": ["openai", "chatgpt", "gpt-4", "gpt-5", "dall-e", "sora"],
  "google": ["google", "gemini", "deepmind", "gemma"],
  "meta": ["meta", "llama", "meta ai"],
  "microsoft": ["microsoft", "copilot", "azure ai"],
  "anthropic-dream": ["dream", "claude dream"]
}
```

Maintained manually. Updated when gaps are noticed — no automation needed. Multi-word aliases (e.g., "claude code") are matched as bigrams and as entity entries.

## Similarity Algorithm

### New command: `check-fuzzy`

```bash
node scripts/d1-save.mjs check-fuzzy --title "Anthropic launches Dream for Claude Code"
```

**Steps:**

1. **Normalize** the input title: lowercase, strip punctuation, collapse whitespace
2. **Pull recent titles** from `content_index` (last 7 days) — one SQL query
3. **Score each** against the input using a composite similarity score:
   - **Word Jaccard** (30% weight) — overlap of individual word sets, stop words removed
   - **Bigram Jaccard** (30% weight) — overlap of 2-word phrase sets
   - **Entity score** (40% weight) — proportion of shared entity matches from `data/entities.json`
4. **Return matches** above threshold (default 0.4), sorted by score descending

### Output format

```
⚠️  Similar content found (2 matches):

  0.82  "Anthropic Launches Dream Feature for Claude Code"
        2026-03-24 · 04-claude-anthropic · tier 1 (authoritative)
        Entities: anthropic, claude code, dream
        Words: 0.71 · Bigrams: 0.65 · Entities: 1.00

  0.51  "Claude Code Gets Major Update with New Agent Mode"
        2026-03-23 · 04-claude-anthropic · tier 3 (tech press)
        Entities: claude code
        Words: 0.22 · Bigrams: 0.15 · Entities: 0.50
```

### Threshold

Starting at **0.4** — low enough to surface borderline matches for agent evaluation, high enough to avoid noise. Tuned from real results over time.

## Agent Decision Framework

### Score-based decision tree

**Score >= 0.7 (strong match):**
- **Skip** unless the new article provides one of:
  - Genuinely new facts (benchmarks, pricing, release dates not in the original)
  - First-hand experience ("I used Dream for 48 hours and here's what happened")
  - Authoritative source replacing a lower-tier one (e.g., Anthropic blog just dropped but only TechCrunch was recorded)

**Score 0.4–0.7 (possible match):**
- Agent reads both titles and the matched entry's source tier
- Must state in the research JSON *why* this isn't a duplicate (one sentence)
- If it can't articulate a reason, skip it

**Score < 0.4:**
- No match surfaced, proceed normally

### Source tier logic

When a match exists from a **higher tier** (lower number = more authoritative), the bar for re-inclusion is very high — that story is already covered by the best source. When a match exists only from a **lower tier**, the agent should consider replacing it if an authoritative source just published.

### Recording

Research agents assign tier at record time using this rubric:
- Tier 1: Official source (company blog, press release, official repo)
- Tier 2: Major outlet with original reporting
- Tier 3: Tech press / aggregator (default if omitted)
- Tier 4: Blog, influencer, community post

## File Changes

### Modified files

| File | Change |
|------|--------|
| `scripts/d1-save.mjs` | Add `check-fuzzy` command, add `--tier` flag to `record`, load entity dictionary |
| `scripts/d1-init.mjs` | Add `source_tier` column to `content_index` schema, add migration for existing DBs |
| `instructions/RESEARCH_MAIN.md` | Replace "mental check" with `check-fuzzy` command + decision framework |
| `instructions/research/03-11` | Update dedup instructions to use `check-fuzzy` and `--tier` on `record` |
| `instructions/MAIN.md` | Update dedup strategy description |
| `CLAUDE.md` | Update dedup strategy section to reflect fuzzy matching |

### New files

| File | Purpose |
|------|---------|
| `data/entities.json` | Entity dictionary — canonical names mapped to aliases |
| `scripts/shared/fuzzy.mjs` | Similarity logic — normalize, tokenize, bigrams, entity match, composite score |

### Not changed

- No new npm dependencies — pure string manipulation
- Template/CSS/site files untouched
- Existing `check` and `check-url` commands remain unchanged (still useful for exact matches)
