# Section 04: Claude & Anthropic — Research

> **Phase:** Research
> **Timing:** Every digest (daily)

---

## Purpose

Track every development from Anthropic and Claude — product releases, API changes, Claude Code updates, new features, blog posts, research publications, and community discoveries. This is the highest-priority section for the reader.

## Deduplication Check

Follow the dedup + persistence workflow in `RESEARCH_BRIEF.md`: write all candidates to `tmp/04-claude-anthropic-research.json`, run one `check-batch`, drop/justify DUPEs, then `save-research` + `record-batch`.

## Data Sources

### Official Sources (Check First)

| Source | URL / Method | What to Pull |
|--------|-------------|-------------|
| Anthropic Blog | `web_search "anthropic.com/research" OR "anthropic.com/news" {this week}` | Research papers, company news, product announcements |
| Anthropic Changelog | `web_fetch https://docs.anthropic.com/en/docs/about-claude/models` + `web_search "anthropic changelog {today}"` | API changes, model updates |
| Claude Code GitHub | `web_fetch https://github.com/anthropics/claude-code/releases` | New releases, changelogs |
| Anthropic Status | `web_search "status.anthropic.com"` | Outages, incidents (only if significant) |
| Claude Max/Pro updates | `web_search "Claude Pro" OR "Claude Max" new feature {today}` | Subscription/feature changes |

### Community Sources

| Source | URL / Method | What to Pull |
|--------|-------------|-------------|
| r/ClaudeAI | `web_fetch https://www.reddit.com/r/ClaudeAI/hot.json?limit=25` | Community discoveries, tips, complaints, feature finds |
| r/AnthropicAI | `web_fetch https://www.reddit.com/r/AnthropicAI/new.json?limit=15` | Anthropic-specific discussion |
| Hacker News | `web_search "site:news.ycombinator.com Claude OR Anthropic {this week}"` | Technical discussions |
| X/Twitter | `web_search "anthropic OR claude-code announcement site:x.com {today}"` | Breaking news, employee posts |

### Notable Independent Coverage

| Source | Method | What to Pull |
|--------|--------|-------------|
| Simon Willison | `web_search "simonwillison.net claude OR anthropic {this week}"` | Deep analysis, tutorials |
| Ethan Mollick (One Useful Thing) | `web_search "oneusefulthing.org claude {this week}"` | Usage insights |
| Latent Space podcast/blog | `web_search "latent.space anthropic OR claude {this week}"` | Industry analysis |

## What to Include

- **Claude Code releases** — every version bump, no matter how minor. Include version number, key changes, and link to release notes.
- **API changes** — new models, pricing changes, rate limit adjustments, new features (tool use, vision, etc.)
- **Product updates** — Claude.ai features, Projects, Artifacts, memory, any UI changes
- **Research papers** — papers published by Anthropic researchers
- **Company news** — hiring, leadership, partnerships, policy statements
- **Community discoveries** — Reddit/HN posts where someone found an undocumented feature or useful technique (relevance_score 6+ only)

## What to Exclude

- Generic "Claude is great/bad" opinion posts (unless they reveal specific behavior changes)
- Prompt engineering tips (unless they demonstrate a new capability)
- Outages lasting less than 30 minutes
- Subscription pricing complaints (unless pricing actually changed)

## Priority Watchlist

Always search for these specifically:
- `"Claude Code" new version OR release OR update`
- `"Claude 4" OR "Claude Opus" OR "Claude Sonnet" new`
- `"Anthropic" announcement OR launch OR release`
- `"MCP" new server OR protocol update`
- `"Claude" new feature OR capability`

## Output JSON

Same schema as RESEARCH_BRIEF.md. Content types: `release`, `announcement`, `analysis`, `discussion`, `paper`.
