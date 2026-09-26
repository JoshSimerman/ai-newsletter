# Section 13: OpenClaw & Hermes — Research

> **Phase:** Research
> **Timing:** Every digest (daily)

---

## Purpose

Track every development related to two key open-source AI agent projects:

1. **OpenClaw** — the fastest-growing open source AI project in GitHub history. OpenClaw is a local-first personal AI assistant that connects to 50+ messaging integrations (WhatsApp, Telegram, Slack, Discord, Signal, iMessage). It's a key project for the reader.

2. **Hermes Agent** — an open-source agent harness by Nous Research. Hermes is a persistent personal AI agent with a built-in learning loop: it creates skills from experience, improves them during use, persists knowledge across sessions, and builds a deepening model of its user. Supports five backends (local, Docker, SSH, Singularity, Modal) with container hardening and namespace isolation.

## Deduplication Check

Follow the dedup + persistence workflow in `RESEARCH_BRIEF.md`: write all candidates to `tmp/13-openclaw-research.json`, run one `check-batch`, drop/justify DUPEs, then `save-research` + `record-batch`.

## Data Sources

### Official Sources (Check First)

| Source | Method | What to Pull |
|--------|--------|-------------|
| OpenClaw GitHub | `web_fetch https://github.com/openclaw/openclaw/releases` | New releases, changelogs |
| OpenClaw Blog | `web_search "openclaw.dev blog" OR "openclaw.com blog" {this week}` | Official announcements |
| OpenClaw Discord/Community | `web_search "openclaw announcement {today}"` | Community announcements |

### Community Sources

| Source | Method | What to Pull |
|--------|--------|-------------|
| r/OpenClaw | `web_search "reddit.com/r/openclaw {this week}"` | Community discussion, tips, plugins |
| r/LocalLLaMA | `web_fetch https://www.reddit.com/r/LocalLLaMA/hot.json?limit=30` (filter for OpenClaw) | OpenClaw posts, integrations |
| Hacker News | `web_search "site:news.ycombinator.com OpenClaw {this week}"` | Technical discussion |
| X/Twitter | `web_search "openclaw announcement site:x.com {today}"` | Breaking news |

### Hermes Agent Sources (Check Second)

| Source | Method | What to Pull |
|--------|--------|-------------|
| Hermes GitHub | `web_fetch https://github.com/NousResearch/hermes-agent/releases` | New releases, changelogs |
| Nous Research Blog | `web_search "nousresearch.com hermes agent {this week}"` | Official announcements |
| Hermes Docs | `web_search "hermes-agent.nousresearch.com {this week}"` | Documentation updates |
| r/LocalLLaMA | `web_fetch https://www.reddit.com/r/LocalLLaMA/hot.json?limit=30` (filter for Hermes) | Hermes posts, integrations |
| Hacker News | `web_search "site:news.ycombinator.com Hermes Agent Nous {this week}"` | Technical discussion |
| X/Twitter | `web_search "hermes agent nousresearch site:x.com {today}"` | Breaking news |

### Notable Coverage

| Source | Method | What to Pull |
|--------|--------|-------------|
| TechCrunch | `web_search "techcrunch openclaw OR hermes agent {this week}"` | Major coverage |
| The Verge | `web_search "theverge openclaw OR hermes agent {this week}"` | Product coverage |
| YouTube | `web_search "(openclaw OR hermes agent) new video site:youtube.com {this week}"` | Tutorial/review videos |

## What to Include

### OpenClaw
- **Releases** — every version bump, include version number + key changes + breaking changes
- **New integrations** — new messaging platform support, new AI model backends
- **Plugin ecosystem** — notable new plugins, plugin API changes
- **Community milestones** — star counts, download milestones, contributor milestones
- **Architecture changes** — significant technical updates, performance improvements
- **Security advisories** — any security-related updates
- **Third-party integrations** — other tools adding OpenClaw support
- **Tutorials/guides** — well-received setup guides, deployment tutorials (score 6+ only)

### Hermes Agent
- **Releases** — version bumps, new features, breaking changes
- **Skill system updates** — new built-in skills, skill creation improvements, skill sharing
- **Memory system** — multi-level memory updates, conversation persistence changes
- **Backend support** — new compute backends, container/isolation improvements
- **Partnerships/integrations** — MiniMax or other partner integrations, third-party tool support
- **Community milestones** — star counts (64k+), adoption metrics, migration guides
- **Tutorials/guides** — well-received setup guides, comparison articles (score 6+ only)

## What to Exclude

- Generic "OpenClaw is great" or "Hermes is great" opinion posts
- Basic setup questions for either project
- Feature requests without implementation
- Issues/bugs without resolution (unless critical/widespread)
- OpenClaw-vs-Hermes flamewars without substantive technical comparison

## Priority Watchlist

Always search for these specifically:
- `"OpenClaw" new version OR release OR update`
- `"OpenClaw" plugin OR integration new`
- `"OpenClaw" breaking change OR migration`
- `"OpenClaw" security OR vulnerability`
- `"OpenClaw" self-hosted setup guide`
- `"Hermes Agent" new version OR release OR update`
- `"Hermes Agent" skill OR memory OR learning`
- `"Hermes Agent" backend OR Docker OR Modal`
- `"Nous Research" "Hermes" announcement`
- `"Hermes Agent" vs "OpenClaw"` (comparison pieces)

## Output JSON

Same schema as RESEARCH_BRIEF.md. Content types: `release`, `announcement`, `analysis`, `discussion`, `tutorial`, `tool`.

Additional `details` field for OpenClaw releases:
```json
{
  "details": {
    "version": "v2.4.0",
    "release_url": "https://github.com/openclaw/openclaw/releases/tag/v2.4.0",
    "breaking_changes": false,
    "new_integrations": ["Signal", "Matrix"],
    "github_stars": 215000
  }
}
```

Additional `details` field for Hermes Agent releases:
```json
{
  "details": {
    "version": "v1.2.0",
    "release_url": "https://github.com/NousResearch/hermes-agent/releases/tag/v1.2.0",
    "breaking_changes": false,
    "new_skills": ["web-browse", "code-review"],
    "github_stars": 64200
  }
}
```
