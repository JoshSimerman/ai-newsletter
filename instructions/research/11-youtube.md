# Section 11: YouTube Creators — Research

> **Phase:** Research
> **Timing:** Every digest (daily)

---

## Purpose

Check a curated list of AI-focused YouTube creators for videos published within the lookback window (see tmp/lookback-config.json). List all new uploads so the reader can see at a glance what their favorite creators have published.

## Deduplication Check

Follow the dedup + persistence workflow in `RESEARCH_BRIEF.md`: write all candidates to `tmp/11-youtube-research.json`, run one `check-batch`, drop/justify DUPEs, then `save-research` + `record-batch`.

## Data Sources

### Primary: YouTube Check Script (ALWAYS USE THIS)

The project includes a helper script that loads the YouTube API key from `.env.local` and checks all creators automatically. **Sub-agents MUST use this script** — do NOT call the YouTube API directly (sub-agents cannot access environment variables).

```bash
# Check all creators, get JSON output. ALWAYS pass --hours from tmp/lookback-config.json
# (without it the script defaults to a 24h window and silently ignores multi-day lookbacks)
node scripts/youtube-check.mjs --hours {H} --json > tmp/youtube-raw.json

# Check a single creator
node scripts/youtube-check.mjs --hours {H} --handle @MarkKashef
```

The script:
- Resolves channel IDs from handles automatically
- Queries YouTube Data API v3 for videos within the lookback window (see tmp/lookback-config.json)
- Gets video details (duration, view count)
- Filters out Shorts (< 60 seconds)
- Outputs structured JSON with all data needed for the research JSON

### Fallback: Web Search (only if script fails)

If the YouTube check script fails (API key issue, network error), fall back in this order:

1. **Channel videos page:** `web_fetch https://www.youtube.com/{handle}/videos` — relative dates ("1 hour ago", "1 day ago") filter recency
2. **Web search with date filter:** `web_search site:youtube.com "@{handle}"` — check results for upload dates within the lookback window

**CRITICAL: lookback filter rule**
- After finding videos via ANY method, verify the upload date is within the lookback window (see tmp/lookback-config.json)
- If a video's upload date cannot be confirmed, do NOT include it
- Do NOT include older videos just because they appeared in search results

## YouTube Creator Watchlist

Check these channels daily for new uploads. Only include videos published within the lookback window (see tmp/lookback-config.json).

| Creator | YouTube Handle | Focus Area |
|---------|---------------|------------|
| Mark Kashef | @MarkKashef | Claude Code, AI agents, n8n automation |
| DIY Smart Code | @DIYSmartCode | AI coding tutorials, app building |
| Chase AI | @ChaseAI | AI tools, automation, workflows |
| Alex Finn | @AlexFinnAI | iOS/web app building with AI, Claude Code |
| David Ondrej | @DavidOndrej | AI agents, business automation, n8n |
| Simon Scrapes | @SimonScrapes | AI agents, scraping, automation |
| Goda Go | @GodaGo | AI tutorials, coding |
| Brian Casel | @BrianCasel | SaaS, AI tools, indie business |
| Clearmud | @Clearmud | AI development, tutorials |
| Zubair Trabzada | @ZubairTrabzada | AI tools, tutorials |

> **Channel ID Resolution:** On the first run, the research agent should resolve each handle to a YouTube channel ID by fetching the channel page or using the YouTube API's `forUsername` / `forHandle` parameter. Store resolved IDs in D1 for reuse:
> ```bash
> node scripts/d1-save.mjs record --date {YYYY-MM-DD} --section 11-youtube --type channel --id "{handle}" --title "{creator name}" --url "https://www.youtube.com/{handle}"
> ```
>
> **To add a creator:** Add their name and YouTube handle to this table. The agent resolves the channel ID on next run.
>
> **No YouTube API key?** Use `web_search "{creator name}" new video site:youtube.com` filtered to last 24 hours.

## What to Include

For each video found within the lookback window (see tmp/lookback-config.json):
- **Video title**
- **Channel name**
- **Video URL** (`https://www.youtube.com/watch?v={VIDEO_ID}`)
- **Thumbnail URL** (`https://img.youtube.com/vi/{VIDEO_ID}/hqdefault.jpg`) — always use `hqdefault.jpg`
- **Duration** (from contentDetails)
- **View count** (from statistics, if available)
- **Published date/time**
- **Brief description** — first 1-2 sentences of the video description, or a one-line summary

## What to Exclude

- Shorts (< 60 seconds) — unless they're particularly noteworthy
- Livestream replays (unless they contain significant news)
- Non-AI content from creators who also cover other topics

## Empty Section Handling

If no creators published within the lookback window (see tmp/lookback-config.json), return an empty items array. This is normal — not every creator posts daily. The section will be omitted from the digest.

## Output JSON

```json
{
  "section_key": "11-youtube",
  "research_date": "2026-03-25",
  "item_count": 4,
  "items": [
    {
      "id": "abc123def",
      "title": "Claude Code Just Changed Everything — MCP Auto-Discovery",
      "url": "https://www.youtube.com/watch?v=abc123def",
      "source": "Matthew Berman",
      "source_url": "https://www.youtube.com/@matthewberman",
      "published_date": "2026-03-25",
      "summary": "Walkthrough of Claude Code's new MCP auto-discovery feature and what it means for developer workflows.",
      "relevance_score": 8,
      "tags": ["claude-code", "mcp", "tutorial"],
      "content_type": "video",
      "details": {
        "video_id": "abc123def",
        "channel_name": "Matthew Berman",
        "channel_id": "UCnQrVOEa1BjGtbOBzp-qVQ",
        "thumbnail_url": "https://img.youtube.com/vi/abc123def/hqdefault.jpg",
        "duration": "PT14M32S",
        "view_count": 12500
      }
    }
  ],
  "editorial_notes": "4 creators posted today. Heavy Claude coverage."
}
```
