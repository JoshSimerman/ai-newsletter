# Section 03: Top Stories — Research

> **Phase:** Research
> **Timing:** Every digest (daily)

---

## Purpose

Identify the 3-5 biggest AI stories of the day — the headlines that would lead a major tech publication's AI section. These are cross-cutting stories that don't fit neatly into one category, or are significant enough to deserve top billing.

## Deduplication Check

Follow the dedup + persistence workflow in `RESEARCH_BRIEF.md`: write all candidates to `tmp/03-top-stories-research.json`, run one `check-batch`, drop/justify DUPEs, then `save-research` + `record-batch`.

## Data Sources

| Source | Method | Priority |
|--------|--------|----------|
| Hacker News | `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=AI+LLM+artificial+intelligence&numericFilters=created_at_i>{unix_24h_ago}` | High — filter for 50+ points |
| TechCrunch AI | `web_search "TechCrunch artificial intelligence {today}"` | High |
| The Verge AI | `web_search "The Verge AI {today}"` | Medium |
| Ars Technica | `web_search "Ars Technica AI {today}"` | Medium |
| Reuters Technology | `web_search "Reuters AI artificial intelligence {today}"` | Medium — business/policy angle |
| Wired | `web_search "Wired AI {today}"` | Low — only if major |
| Bloomberg | `web_search "Bloomberg AI {today}"` | Low — paywalled but headlines useful |

## Selection Criteria

A story qualifies as a "Top Story" if it meets ANY of:
- **Major company announcement** — new product, policy change, leadership change at a major AI company
- **Regulatory/policy action** — government action on AI (executive orders, legislation, lawsuits)
- **Breakthrough result** — a genuinely new capability or benchmark record that changes the landscape
- **Major funding/acquisition** — $100M+ rounds or significant M&A
- **Cultural moment** — AI story that crosses into mainstream news

## What Does NOT Belong Here

- Routine product updates (those go in section-specific categories)
- Minor funding rounds under $50M (those go in 08-business-deals)
- New model releases that are iterative (those go in 06-new-models)
- Developer tool launches (those go in 09-dev-tools)

If a story fits better in a specific section, put it there instead. Top Stories is for the truly cross-cutting or outsized developments.

## Research Process

1. **Search Hacker News** for AI/LLM stories from within the lookback window (see `tmp/lookback-config.json`) with 50+ points
2. **Search TechCrunch and The Verge** for today's AI headlines
3. **Web search** for `"AI" OR "artificial intelligence" major announcement {today's date}`
4. **Deduplicate** — same story from different sources: keep the best source
5. **Rank** by significance and select top 3-5

## Output JSON

```json
{
  "section_key": "03-top-stories",
  "research_date": "2026-03-25",
  "item_count": 4,
  "items": [
    {
      "id": "eu-ai-act-enforcement-begins",
      "title": "EU AI Act Enforcement Begins: First Compliance Deadlines Hit",
      "url": "https://techcrunch.com/2026/03/25/eu-ai-act-enforcement/",
      "source": "TechCrunch",
      "source_url": "https://techcrunch.com",
      "published_date": "2026-03-25",
      "summary": "The European Union begins enforcing the first phase of AI Act requirements, affecting foundation model providers operating in the EU. Companies have until June to submit transparency reports.",
      "relevance_score": 9,
      "tags": ["regulation", "eu", "policy"],
      "content_type": "announcement"
    }
  ],
  "editorial_notes": "Strong news day — EU enforcement is the clear lead."
}
```
