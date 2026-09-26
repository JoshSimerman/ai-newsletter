# Section 10: Open Source Highlights — Research

> **Phase:** Research
> **Timing:** Every digest (daily)

---

## Purpose

Surface the most interesting new or trending open source AI projects — repos that developers should know about, community tools gaining traction, and notable contributions.

## Deduplication Check

Follow the dedup + persistence workflow in `RESEARCH_BRIEF.md`: write all candidates to `tmp/10-open-source-research.json`, run one `check-batch`, drop/justify DUPEs, then `save-research` + `record-batch`.

## Data Sources

| Source | Method | What to Pull |
|--------|--------|-------------|
| GitHub Trending | `web_search "github.com/trending today AI OR LLM OR machine-learning"` | Today's trending AI repos |
| Hacker News Show HN | HN API: `Show HN` + AI keywords, last 24h | New open source tools |
| r/MachineLearning | Reddit JSON, filtered for `[Project]` or `[R]` tags | Community projects |
| r/LocalLLaMA | Reddit JSON, filtered for tool/project posts | Local AI tools |
| HuggingFace Spaces | `web_search "huggingface.co/spaces trending {today}"` | Popular new spaces |
| Product Hunt Open Source | `web_search "producthunt open source AI {today}"` | OSS launches |

## What to Include

- **Trending repos** — AI repos that are newly trending on GitHub (high star velocity)
- **New tool launches** — open source AI tools getting their first major attention
- **Significant releases** — major version bumps of established AI open source projects
- **Community projects** — creative or useful tools built by individuals
- **Datasets** — notable new open datasets for AI/ML

## What to Exclude

- Repos that have been trending for multiple consecutive days (dedup check)
- Forks or minor variations of existing projects
- Tutorial/course repositories (unless they're exceptionally popular)
- Repos with < 50 stars (too early unless exceptionally interesting)

## Selection Criteria

Rank by a combination of:
- **Star velocity** — how fast it's gaining stars
- **Utility** — does it solve a real problem?
- **Novelty** — is it a new approach or just another wrapper?
- **Community engagement** — comments, discussions, PRs

Include 3-7 items per day. Quality over quantity.

## Output JSON

Same schema as RESEARCH_BRIEF.md. Additional `details` field:

```json
{
  "details": {
    "repo_url": "https://github.com/owner/repo",
    "stars": 1250,
    "star_velocity": "+340 today",
    "language": "Python",
    "description": "Framework for building multi-agent AI systems with memory"
  }
}
```
