# Section 14: Model Leaderboard — Research

> **Phase:** Research
> **Timing:** Every digest

---

## Purpose

Capture a snapshot of the top-performing AI models across three axes: overall quality (Arena.ai ELO), open-weight models, and real-world usage (OpenRouter traffic). This is a leaderboard, not a news section — no deduplication needed.

## Data Sources

### 1. Arena.ai — Top 10 Overall

| Source | Method | Notes |
|--------|--------|-------|
| Arena.ai leaderboard | `web_search "arena.ai leaderboard top models"` | Primary — ELO scores often cited in articles |
| Arena.ai page | `web_fetch https://arena.ai/leaderboard/text` | Model names in HTML; ELO scores may require JS |
| Artificial Analysis | `web_fetch https://artificialanalysis.ai` | Fallback — Intelligence Index scores in page HTML |

**Strategy:** Start with `web_search` for recent articles citing Arena.ai rankings (tech blogs frequently publish these). Supplement with `web_fetch` on the Arena.ai page to confirm model names. If ELO scores aren't available from search, use Artificial Analysis Intelligence Index as the primary metric instead.

### 2. Top 5 Open-Weight Models

Filter the Arena.ai rankings to models with permissive open-weight licenses (Apache 2.0, MIT, Llama Community License, etc.).

Known open-weight model families to look for:
- Google Gemma series
- Meta Llama series
- DeepSeek series
- Qwen series
- Mistral open models
- Alibaba/Yi series

Cross-reference with Artificial Analysis or Hugging Face Open LLM Leaderboard if Arena.ai filtering isn't possible.

### 3. OpenRouter — Top 10 by Usage

| Source | Method | Notes |
|--------|--------|-------|
| OpenRouter rankings | `web_fetch https://openrouter.ai/rankings` | Top 10 by token throughput in static HTML |
| OpenRouter API | `web_fetch https://openrouter.ai/api/v1/models` | Full model catalog JSON (no usage data) |

**Strategy:** `web_fetch` the rankings page. The top 10 models by token throughput are server-rendered in static HTML. Extract model names and token counts.

## Research Process

1. **Search for Arena.ai rankings** — `web_search "arena.ai leaderboard April 2026"` and `web_search "top AI models ranking 2026"`
2. **Fetch OpenRouter rankings** — `web_fetch https://openrouter.ai/rankings`, extract top 10
3. **Fetch Artificial Analysis** — `web_fetch https://artificialanalysis.ai` for Intelligence Index scores
4. **Identify open-weight models** — filter Arena rankings or search specifically for open model leaderboards
5. **Write editorial note** — one sentence summarizing what's notable (new entrants, rank changes, surprises)

## Output JSON Schema

```json
{
  "section_key": "14-model-leaderboard",
  "research_date": "YYYY-MM-DD",
  "arena_top_10": [
    {
      "rank": 1,
      "model": "Model Name",
      "elo": 1547,
      "provider": "Company",
      "change": "—"
    }
  ],
  "open_top_5": [
    {
      "rank": 1,
      "model": "Model Name",
      "elo": 1452,
      "license": "Apache 2.0",
      "provider": "Company"
    }
  ],
  "openrouter_top_10": [
    {
      "rank": 1,
      "model": "Model Name",
      "tokens": "4.6T",
      "provider": "Company",
      "is_free": true
    }
  ],
  "editorial_note": "One-liner about notable movements or surprises."
}
```

## Special Rules

- **No deduplication** — this is a snapshot, not news. Do NOT call `check-url`, `check-fuzzy`, or `record`.
- **No freshness filter** — rankings are current as of research date. The lookback window does not apply.
- **Fallback chain:** Arena.ai → Artificial Analysis → web_search for "top AI models"
- **If a source fails:** Log the failure but continue with available data. Two of three sub-rankings is acceptable.
- **ELO vs Intelligence Index:** If Arena.ai ELO is unavailable, use Artificial Analysis Intelligence Index. Label the metric clearly in the JSON.
