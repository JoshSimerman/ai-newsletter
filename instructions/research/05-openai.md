# Section 05: OpenAI & ChatGPT — Research

> **Phase:** Research
> **Timing:** Every digest (daily)

---

## Purpose

Track developments from OpenAI — product launches, API changes, ChatGPT updates, model releases, policy changes, and notable community reactions.

## Deduplication Check

Follow the dedup + persistence workflow in `RESEARCH_BRIEF.md`: write all candidates to `tmp/05-openai-research.json`, run one `check-batch`, drop/justify DUPEs, then `save-research` + `record-batch`.

## Data Sources

### Official Sources

| Source | Method | What to Pull |
|--------|--------|-------------|
| OpenAI Blog | `web_search "openai.com/blog" OR "openai.com/index" {this week}` | Announcements, research |
| OpenAI Platform Changelog | `web_search "platform.openai.com changelog {today}"` | API changes |
| ChatGPT release notes | `web_search "openai chatgpt new feature {today}"` | Product updates |
| OpenAI on X/Twitter | `web_search "from:OpenAI site:x.com {today}"` | Breaking news |

### Community Sources

| Source | Method | What to Pull |
|--------|--------|-------------|
| r/OpenAI | `web_fetch https://www.reddit.com/r/OpenAI/hot.json?limit=25` | Announcements, discussion |
| r/ChatGPT | `web_fetch https://www.reddit.com/r/ChatGPT/hot.json?limit=20` | Feature discoveries, updates |
| Hacker News | `web_search "site:news.ycombinator.com OpenAI OR GPT OR ChatGPT {this week}"` | Technical discussion |

## What to Include

- **Model releases** — GPT-5, o3, o4-mini, any new model or variant
- **API changes** — pricing, rate limits, new endpoints, deprecations
- **ChatGPT features** — new capabilities, UI changes, plugin/GPT store updates
- **Enterprise/business** — partnerships, API customer announcements
- **Policy/safety** — new usage policies, safety reports, alignment research
- **Codex/dev tools** — any updates to OpenAI's coding assistant or developer tools
- **Notable community reactions** — significant findings, behavior changes (score 6+ only)

## What to Exclude

- "GPT-4 vs Claude" comparison posts (unless revealing specific new capabilities)
- Generic usage tips
- DALL-E/Sora updates (unless major — this is an AI coding/LLM newsletter)

## Output JSON

Same schema as RESEARCH_BRIEF.md. Content types: `release`, `announcement`, `analysis`, `discussion`.
