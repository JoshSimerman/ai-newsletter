# Sift Research Phase — Brief

> Compressed instruction set. All rules preserved, prose minimized.

---

## Data Persistence — 3 calls per section, not 3 per item

```bash
# 1. Write ALL candidate items to tmp/{key}-research.json first (Write tool), then
#    dedup-check the whole file in ONE call (url + content-id + fuzzy title):
node scripts/d1-save.mjs check-batch --file tmp/{key}-research.json

# 2. Remove DUPE items (or keep with dedup_justification per the score table below),
#    rewrite the JSON, then save:
node scripts/d1-save.mjs save-research --date {YYYY-MM-DD} --section {key} --file tmp/{key}-research.json

# 3. Record every kept item in ONE call (reads items[] straight from the research JSON):
node scripts/d1-save.mjs record-batch --date {YYYY-MM-DD} --section {key} --file tmp/{key}-research.json
```

Do NOT run per-item `check-url`/`check-fuzzy`/`record` loops — the batch commands
replace them. (Single-item variants still exist for ad-hoc use.)

**File writing:** Use **Write tool** for JSON. Never bash echo/cat.
**CLI only:** Use `node scripts/d1-save.mjs` via Bash. No MCP tools in sub-agents.

---

## Content Rules (NEVER VIOLATE)

1. Every link = real page (not homepage)
2. Every source = attributed with URL
3. No fabricated content, URLs, or dates
4. Unverifiable URL = omit item
5. No date found = reject item
6. Date older than lookback period = reject item (freshness)

### Publication Dates (REQUIRED)

- Format: YYYY-MM-DD
- Find via: `article:published_time`, `<time datetime>`, ld+json `datePublished`
- No date = reject
- Older than lookback period = reject
- Never fabricate/guess

### Freshness (DYNAMIC LOOKBACK)

- **Read `tmp/lookback-config.json`** at the start of research to get the lookback window
- The file contains `{ "days": N, "hours": H, "since_date": "YYYY-MM-DD" }` — include content published since `since_date`
- If the file is missing, default to 24h (1-day lookback)
- Claude/Anthropic releases get +24h grace beyond the lookback window
- Empty section = return `"items": []`

### Deduplication

| Score | Action |
|-------|--------|
| >= 0.7 | Skip unless genuinely new facts, first-hand testing, or authoritative source upgrade |
| 0.4-0.7 | Include only with `dedup_justification` explaining why |
| < 0.4 | Proceed |

### Source Tiers

Set `source_tier` on every item in the research JSON (`record-batch` reads it):

- `1` Official (company blog, press release)
- `2` Major outlet (Reuters, Bloomberg, NYT)
- `3` Tech press (TechCrunch, Verge) — default
- `4` Blog/community (Substack, Reddit, YouTube)

---

## Research Methods

| Method | Usage |
|--------|-------|
| RSS | `web_fetch` on feed URL, parse XML, filter by lookback window |
| Web Search | Include date qualifiers: `{topic} {date range}` |
| Reddit | `https://www.reddit.com/r/{sub}/hot.json?limit=25` — filter `created_utc` by lookback window |
| HN | `https://hn.algolia.com/api/v1/search_by_date?tags=story&query={q}&numericFilters=created_at_i>{unix_since}` |
| YouTube | `node scripts/youtube-check.mjs --hours {H} --json` (reads lookback from config) |

---

## Output Schema

```json
{
  "section_key": "{key}",
  "research_date": "YYYY-MM-DD",
  "item_count": N,
  "items": [{
    "id": "slug-kebab-case",
    "title": "Rewritten headline (8-15 words, no hype)",
    "original_title": "Source headline verbatim",
    "url": "verified URL",
    "source": "Source Name",
    "source_url": "source homepage",
    "published_date": "YYYY-MM-DD",
    "summary": "1-3 sentences: what happened, why it matters, concrete detail",
    "summary_bullets": ["**Term** — explanation", ...],
    "relevance_score": 1-10,
    "tags": ["tag1", "tag2"],
    "content_type": "announcement|release|analysis|tutorial|discussion|funding|paper|tool|video",
    "source_tier": 1-4,
    "dedup_justification": "Required if fuzzy score 0.4-0.7"
  }],
  "editorial_notes": "Brief note on the day's coverage"
}
```

### Headline Rules

- **Rewrite every headline** (never copy verbatim)
- Format: [Subject] [verb] [specific detail]
- Include: version numbers, dollar amounts, metrics
- 8-15 words, max 20
- Banned: just, finally, exciting, huge, massive, game-changing, breaking

### Summary Rules

- Sentence 1: What happened
- Sentence 2: Why it matters
- Sentence 3 (optional): Concrete detail
- Never start: "In a move...", "According to..."
- Include: versions, benchmarks, pricing, availability
- 3+ details = use `summary_bullets` with **bold term** — explanation

---

## Required Fields

| Field | Required | Notes |
|-------|----------|-------|
| id | yes | kebab-case slug |
| title | yes | Rewritten |
| url | yes | Verified |
| source | yes | Name |
| source_url | yes | Homepage |
| published_date | yes | YYYY-MM-DD |
| summary | yes | 1-3 sentences or intro + bullets |
| relevance_score | yes | 1-10 |
| tags | yes | lowercase array |
| content_type | yes | One of defined types |
| source_tier | yes | 1-4 (see Source Tiers) |
| summary_bullets | conditional | When 3+ details |
| dedup_justification | conditional | When fuzzy 0.4-0.7 |
