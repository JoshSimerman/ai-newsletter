# CLAUDE.md — Sift AI Daily Digest

## 1. Project Overview

**Sift** is a daily AI news digest delivered as a single-page, dark-themed HTML file. It aggregates the most important developments across the AI industry — Claude/Anthropic updates, OpenAI news, new model releases, local AI developments, business deals, developer tools, open source highlights, and YouTube creator content — into a scannable, categorized format with an executive summary.

### Tech Stack

- **Pipeline:** Claude Code sub-agents do research + writing; a deterministic Node renderer produces all HTML
- **Database:** Cloudflare D1 (all pipeline state, content index, deduplication) via `scripts/d1-save.mjs`
- **Hosting:** Cloudflare Pages (auto-deploys `site/` on push to `main`); public URL set as `SITE_URL` in `.env.local`
- **Newsletter Output:** Self-contained single-file HTML with inlined CSS

---

## 2. Architecture & Structure

```
Sift/
├── instructions/
│   ├── DAILY-DIGEST-CREATOR.md       # The complete pipeline prompt (orchestrator reads ONLY this)
│   ├── RESEARCH_BRIEF.md             # Compressed research rules (every research agent reads this)
│   └── research/                     # Per-section research instructions (02-15)
├── template/
│   └── css/sift.css                  # Digest stylesheet (dark theme) — inlined by the assembler
├── site/                             # Cloudflare Pages site root (auto-deployed)
│   ├── index.html                    # Homepage — latest digest + navigation
│   ├── favicon.svg
│   ├── _headers
│   ├── robots.txt
│   └── issues/
│       ├── index.html                # Archive page (month/year grouped)
│       └── YYYY-MM-DD/index.html     # Per-day digest
├── scripts/
│   ├── d1-save.mjs                   # D1 CLI (editions, research, dedup incl. batch commands)
│   ├── d1-init.mjs                   # D1 schema initialization
│   ├── assemble-digest.mjs           # Renders the full digest HTML from tmp/*-research.json
│   ├── check-deploy.mjs              # Confirms an edition is live at SITE_URL (content check)
│   ├── render-demo.mjs               # Builds a demo site from examples/demo-edition.json
│   ├── screenshots.mjs               # Playwright screenshots of the demo site → docs/screenshots/
│   ├── cross-section-dedup.mjs       # Removes duplicate stories across sections
│   ├── update-index.mjs              # Regenerates homepage + archive index
│   ├── validate-research.mjs         # Phase 1.5 research validation gate
│   ├── verify-links.mjs              # HEAD-checks all external URLs in a digest
│   ├── reading-time.mjs              # Word count + reading time
│   ├── youtube-check.mjs             # YouTube Data API recent-upload check
│   ├── test-youtube-key.mjs          # YouTube API key diagnostics
│   ├── mcp-server.mjs                # MCP wrapper around the D1 CLI (main session only)
│   └── shared/fuzzy.mjs              # Entity-weighted fuzzy title matching (+ tests)
├── data/entities.json                # Entity dictionary for fuzzy dedup
├── examples/demo-edition.json        # Fictional research data for the demo, screenshots, and tests
├── tmp/                              # Pipeline temp files (gitignored)
├── docs/
│   ├── CONTENT-POLICY.md             # Editorial voice guide (read by the exec-summary agent)
│   ├── CLOUDFLARE-SETUP.md
│   └── *token-optimization*.md       # Historical optimization plans
└── .env.example
```

### Pipeline Flow

```
Research (6 Sonnet sub-agents, 2 sections each; WebSearch/WebFetch/RSS)
   → tmp/{key}-research.json + D1 (save-research, record-batch)
   → validate-research.mjs gate → cross-section-dedup.mjs
   → exec-summary agent (Opus, synthesis)
   → assemble-digest.mjs  (deterministic HTML — NO AI design phase)
   → update-index.mjs → git push → Cloudflare Pages
```

**There is no design phase.** `scripts/assemble-digest.mjs` is the single source of truth for all markup; AI agents never write HTML. The only external API is **YouTube Data API v3** (`YOUTUBE_API_KEY`).

---

## 3. Commands

### D1 CLI (`scripts/d1-save.mjs`)

```bash
node scripts/d1-save.mjs create-edition --date YYYY-MM-DD
node scripts/d1-save.mjs save-research --date YYYY-MM-DD --section KEY --file tmp/KEY-research.json
node scripts/d1-save.mjs check-batch --file tmp/KEY-research.json [--threshold 0.4]   # url+id+fuzzy dedup, one call
node scripts/d1-save.mjs record-batch --date YYYY-MM-DD --section KEY --file tmp/KEY-research.json
node scripts/d1-save.mjs check --type TYPE --id ID              # single-item variants
node scripts/d1-save.mjs check-url --url URL
node scripts/d1-save.mjs check-fuzzy --title "Title" [--threshold 0.4]
node scripts/d1-save.mjs record --date ... --section ... --type ... --id ... --title ... --url ... --source ... --tier 1-4
node scripts/d1-save.mjs read-research --date YYYY-MM-DD --section KEY   # prints saved JSON
node scripts/d1-save.mjs list --type TYPE [--section KEY] [--last N]
node scripts/d1-save.mjs start-timer --date YYYY-MM-DD
node scripts/d1-save.mjs save-metrics --date YYYY-MM-DD --tokens N
node scripts/d1-save.mjs finalize --date YYYY-MM-DD             # mark published
node scripts/d1-save.mjs reset-edition --date YYYY-MM-DD        # wipe edition from D1 + delete HTML
node scripts/d1-save.mjs purge-old [--days 30]
node scripts/d1-save.mjs status [--date YYYY-MM-DD]
node scripts/d1-save.mjs save-design ...                        # legacy — design phase removed, unused
```

### Pipeline tools

```bash
node scripts/validate-research.mjs --date YYYY-MM-DD [--json]   # Phase 1.5 gate
node scripts/cross-section-dedup.mjs --date YYYY-MM-DD [--dry-run]
node scripts/assemble-digest.mjs --date YYYY-MM-DD              # renders the digest from tmp/*-research.json
node scripts/update-index.mjs                                   # regenerates homepage + archive (never hand-edit)
node scripts/verify-links.mjs --date YYYY-MM-DD
node scripts/check-deploy.mjs --date YYYY-MM-DD                  # post-push: is the edition live at SITE_URL?
node scripts/reading-time.mjs --date YYYY-MM-DD
node scripts/youtube-check.mjs --hours H --json
node scripts/test-youtube-key.mjs
npm test                                                        # unit tests + demo render tests
npm run demo                                                    # render dist/demo/site from fictional data
npm run screenshots                                             # regenerate docs/screenshots/*.png
```

### MCP Server (main session only)

`scripts/mcp-server.mjs` (configured in `.mcp.json`) exposes the D1 commands as `sift_*` tools. **MCP tools are available only in the main Claude Code session — sub-agents must use the `node scripts/d1-save.mjs` CLI via Bash.**

---

## 4. Sections

15 section records exist per edition in D1; 13 carry research (01-header and 12-footer are rendered directly by the assembler with no research or DB content).

| Key | Name | Role | Order |
|-----|------|------|-------|
| `01-header` | Header | rendered by assembler | 1 |
| `02-executive-summary` | Executive Summary | research-last (Opus synthesis) | 2 |
| `03-top-stories` | Top Stories | research | 3 |
| `04-claude-anthropic` | Claude & Anthropic | research | 4 |
| `05-openai` | OpenAI & ChatGPT | research | 5 |
| `06-new-models` | New Models & Benchmarks | research | 6 |
| `14-model-leaderboard` | Model Leaderboard | research (ranking arrays, not items[]) | 7 |
| `07-local-ai` | Local AI & Hardware | research | 8 |
| `08-business-deals` | Business & Funding | research | 9 |
| `09-dev-tools` | Developer Tools & Infra | research | 10 |
| `10-open-source` | Open Source Highlights | research | 11 |
| `13-openclaw` | OpenClaw & Hermes | research | 12 |
| `15-humanoid-robotics` | Humanoid Robotics | research | 13 |
| `11-youtube` | YouTube Creators | research | 14 |
| `12-footer` | Footer | rendered by assembler | 15 |

Research instructions live at `instructions/research/{NN}-{name}.md`. Section markup lives in `scripts/assemble-digest.mjs` (`sectionConfig` + renderers).

---

## 5. Key Decisions & Constraints

- **Single-file HTML delivery** — inlined CSS, minimal JS, no external assets beyond Google Fonts
- **AI researches and writes; code renders** — research JSON is the contract between the two. Changing the digest's look = edit `template/css/sift.css` or `scripts/assemble-digest.mjs`, never a prompt
- **Content integrity** — every link to the real page, every source attributed, no fabricated URLs/dates
- **Autonomous operation** — designed to run daily with zero human intervention
- **7-day dedup window** — URL match + entity-weighted fuzzy title match (word Jaccard 30% + bigram 30% + entity overlap 40%, threshold 0.4, dictionary in `data/entities.json`) + source tiers (1=official … 4=community)
- **Techmeme-grade clarity** — headlines rewritten to strip clickbait; `docs/CONTENT-POLICY.md` is the voice guide
- **Token discipline** — orchestrator reads only DAILY-DIGEST-CREATOR.md; research agents read RESEARCH_BRIEF.md + their 2 section files; batch D1 commands (one call per section, not per item)

### Naming Conventions

- Section keys: `NN-kebab-name` (e.g., `04-claude-anthropic`)
- Edition folders: `YYYY-MM-DD`
- CSS classes: kebab-case; section CSS classes are the unprefixed names from `sectionConfig` (e.g. `claude-anthropic`, never `04-claude-anthropic`)

### CSS Custom Properties (from `template/css/sift.css`)

```css
--bg: #0a0a0c;  --surface: #111114;  --surface-2: #18181c;  --surface-3: #1f1f24;
--border: #2a2a30;  --border-dim: #1e1e22;
--text: #e8e6e3;  --text-dim: #a8a5a0;  --text-muted: #82807b;
--accent-top: #e8e6e3;         --accent-claude: #ff6b35;   --accent-openai: #10a37f;
--accent-models: #8b5cf6;      --accent-local: #06b6d4;    --accent-deals: #f59e0b;
--accent-tools: #3b82f6;       --accent-oss: #34d399;      --accent-openclaw: #ec4899;
--accent-leaderboard: #a885ff; --accent-humanoid: #fb923c; --accent-youtube: #ff0000;
```

### Fonts (Google Fonts CDN)

- **Space Grotesk** — headings (400, 500, 600, 700)
- **Inter** — body (400, 500)
- **JetBrains Mono** — metadata, timestamps, badges (400)

---

## 6. Build & Run

Prerequisites: Node.js 22+, Cloudflare account with D1.

```bash
npm install
cp .env.example .env.local   # fill in credentials
```

| Variable | Purpose |
|----------|---------|
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `CF_API_TOKEN` | Cloudflare API token (D1 access) |
| `CF_D1_DATABASE_ID` | D1 database UUID |
| `SITE_URL` | Public site URL (canonical tags + deploy check); optional |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |

Digest generation runs through Claude Code — see `instructions/DAILY-DIGEST-CREATOR.md` (kickoff: `KICKOFF.md`).

---

## 7. Reader Profile (for content curation — customize for your audience)

| Attribute | Value |
|-----------|-------|
| Primary interests | Claude Code, Anthropic products, AI coding tools, new model releases |
| Secondary interests | OpenAI, local AI/self-hosted, open source AI, AI business/funding |
| Technical level | Software engineer — comfortable with code, APIs, terminal |
| Reading style | Scan headlines, read summaries, click through only for deep interest |
| YouTube preference | AI-focused creators, coding tutorials, model demos, industry commentary |
