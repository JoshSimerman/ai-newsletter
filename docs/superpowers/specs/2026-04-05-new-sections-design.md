# Design Spec: Model Leaderboard + Humanoid Robotics Sections

**Date:** 2026-04-05
**Status:** Approved
**Scope:** Add two new sections to the Sift digest pipeline and update KICKOFF.md for variable frequency

---

## 1. Section 14: Model Leaderboard (`14-model-leaderboard`)

### Purpose

A visual leaderboard showing the top-performing AI models across three axes: overall quality (Arena.ai ELO), open-weight models, and real-world usage (OpenRouter traffic). Pure CSS bar charts — no JavaScript.

### Design Tokens

- **Key:** `14-model-leaderboard`
- **Accent color:** `--accent-leaderboard: #a885ff` (lavender)
- **Icon:** `⊡`
- **Section class:** `model-leaderboard`
- **Order:** After `06-new-models`, before `07-local-ai`

### Sub-Rankings

#### 1. Arena.ai — Top 10 Overall
- Source: `https://arena.ai/leaderboard/text`
- Metric: ELO rating from human preference pairwise battles
- Data access: Model names are in static HTML; ELO scores require JS rendering. Research agent should use `web_search "arena.ai leaderboard top models April 2026"` as primary strategy, supplemented by `web_fetch` on the page to extract model names from HTML.
- Display: Ranked list with CSS bar chart. Top 3 get full bars with accent color gradient; ranks 4-10 are compact single-line rows.
- Bar width: Proportional to ELO relative to #1 (e.g., if #1 is 1547 and #5 is 1498, #5 bar = 1498/1547 = 96.8%).

#### 2. Top 5 Open-Weight Models
- Source: Arena.ai filtered to open-weight, cross-referenced with Artificial Analysis (`https://artificialanalysis.ai`)
- Criteria: Apache 2.0, MIT, or other permissive open-weight license
- Metric: Arena.ai ELO (primary), Artificial Analysis Intelligence Index (secondary reference)
- Display: Same ranked bar format, green accent (`#34d399`), with `OPEN` badge
- Top 3 get bars; ranks 4-5 compact rows

#### 3. OpenRouter — Top 10 by Usage
- Source: `https://openrouter.ai/rankings`
- Metric: Token throughput (total tokens processed)
- Data access: Top 10 model names and token counts are in static HTML — scrapeable via `web_fetch`
- Display: Same ranked bar format, blue accent (`#3b82f6`), with `TRAFFIC` badge
- Top 3 get bars; ranks 4-10 compact rows
- Token counts formatted as T/B (e.g., "4.6T tok", "980B tok")

#### Editorial Note
One-liner at the bottom summarizing notable movements: who moved up/down, new entrants, surprises. Written by the research agent.

### Research Phase

- **Type:** `standard` (research → design)
- **Instructions file:** `instructions/research/14-model-leaderboard.md`
- **Data sources:**
  1. `web_search` for current arena.ai rankings
  2. `web_fetch` on `https://openrouter.ai/rankings` to extract top 10 from static HTML
  3. `web_fetch` on `https://artificialanalysis.ai` for Intelligence Index scores (embedded JSON in HTML)
  4. `web_search` for open-weight model rankings
- **Output schema:** Custom JSON (not standard news items):

```json
{
  "section_key": "14-model-leaderboard",
  "research_date": "YYYY-MM-DD",
  "arena_top_10": [
    { "rank": 1, "model": "Claude Opus 4.6 (thinking)", "elo": 1547, "provider": "Anthropic", "change": "—" }
  ],
  "open_top_5": [
    { "rank": 1, "model": "Gemma 4 31B Dense", "elo": 1452, "license": "Apache 2.0", "provider": "Google" }
  ],
  "openrouter_top_10": [
    { "rank": 1, "model": "Qwen 3.6 Plus (free)", "tokens": "4.6T", "provider": "Alibaba", "is_free": true }
  ],
  "editorial_note": "One-liner summary of notable movements"
}
```

- **Deduplication:** Not applicable — leaderboard data is a snapshot, not news items. No `record` or `check-url` calls needed.
- **Freshness:** Rankings are current as of research date — no lookback window applies.

### Design Phase

- **Instructions file:** `instructions/design/14-model-leaderboard.md`
- **HTML structure:** Custom layout (not standard news cards):
  - Section wrapper: `<section class="section news-section model-leaderboard" id="model-leaderboard">`
  - Section header with icon, name, "3 rankings" count
  - Three sub-ranking blocks, each with:
    - Sub-heading label (uppercase mono)
    - Ranked entries: rank badge + model name + score + CSS bar
    - Top 3 get full treatment (bar + accent); 4+ get compact rows
  - Editorial note div at bottom (italic, muted)

### CSS Additions

```css
--accent-leaderboard: #a885ff;

.model-leaderboard .section-name { color: var(--accent-leaderboard); }
.news-section.model-leaderboard .section-header { border-bottom-color: rgba(168, 133, 255, 0.4); }

.leaderboard-bar {
  background: var(--surface-3);
  border-radius: 4px;
  height: 6px;
  margin-left: 39px;
  margin-bottom: 10px;
}
.leaderboard-bar-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--accent-leaderboard), #c4b5fd);
}
.leaderboard-bar-fill.open { background: linear-gradient(90deg, #34d399, #6ee7b7); }
.leaderboard-bar-fill.usage { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
```

### Empty Section Handling

This section should never be empty — rankings always exist. If all three sources fail during research, fall back to `web_search` for "top AI models ranking April 2026" and use whatever data is available.

---

## 2. Section 15: Humanoid Robotics (`15-humanoid-robotics`)

### Purpose

Track progress toward lifelike, human-passing humanoid robots — the "Westworld" frontier. Focus on realism (skin, eyes, facial expressions, biological motion), not industrial utility robots.

### Design Tokens

- **Key:** `15-humanoid-robotics`
- **Accent color:** `--accent-humanoid: #fb923c` (warm orange — evokes human skin tone)
- **Icon:** `◉`
- **Section class:** `humanoid-robotics`
- **Order:** After `13-openclaw`, before `11-youtube`

### Scope — What Qualifies

**Include:**
- Robots with realistic human-like appearance (silicone skin, realistic eyes, facial expressions)
- Synthetic musculoskeletal systems (artificial muscles/tendons vs servos)
- LLM/VLA integration into humanoid bodies for natural interaction
- Advances in facial expression, gait naturalness, skin texture
- Companies: Engineered Arts (Ameca), Clone Robotics, Ex-Robots, Hanson Robotics (Sophia), Sanctuary AI (when relevant to realism)
- Academic breakthroughs in human-passing robotics

**Exclude:**
- Industrial humanoids that look clearly robotic (Boston Dynamics Atlas, Figure, Tesla Optimus, Agility Digit)
- Drone/wheeled robots
- Soft robotics that isn't humanoid
- General automation news

### Research Phase

- **Type:** `standard` (research → design)
- **Instructions file:** `instructions/research/15-humanoid-robotics.md`
- **Data sources:**

| Source | Method | Priority |
|--------|--------|----------|
| humanoid.press | `web_fetch` RSS or homepage | High — dedicated aggregator |
| Humanoids Daily | `web_search` | High — daily coverage |
| The Robot Report | `web_search "humanoid robot"` | Medium — industry standard |
| IEEE Spectrum Humanoid Robots | `web_search` | Medium — quality analysis |
| Clone Robotics blog/social | `web_search "Clone Robotics"` | High — key company |
| Engineered Arts blog | `web_search "Engineered Arts Ameca"` | High — key company |
| Ex-Robots | `web_search "Ex-Robots humanoid"` | Medium — Chinese realism leader |
| Hanson Robotics | `web_search "Hanson Robotics Sophia"` | Medium |
| r/robotics | Reddit JSON | Low — filter for lifelike humanoid |

- **Output schema:** Standard Sift news item JSON (same as other sections)
- **Deduplication:** Standard `check-url` and `check-fuzzy` against 7-day window
- **Freshness:** Uses the dynamic lookback window from `tmp/lookback-config.json`
- **Expected volume:** 0-3 items per week. Empty weeks are normal and expected.

### Design Phase

- **Instructions file:** No dedicated file needed — uses the standard news card format defined in `instructions/DESIGN_BRIEF.md`. The design agent reads the brief + research JSON and applies the standard card template with the humanoid accent color.
- **HTML structure:** Standard news section with news cards, identical to sections 03-10
- **Section header accent:** warm orange border

### CSS Additions

```css
--accent-humanoid: #fb923c;

.humanoid-robotics .section-name { color: var(--accent-humanoid); }
.news-section.humanoid-robotics .section-header { border-bottom-color: rgba(251, 146, 60, 0.4); }
.humanoid-robotics .card-title a:hover { color: var(--accent-humanoid); }
```

### Empty Section Handling

0 items = section omitted entirely. This is expected behavior — the section may appear only 2-3 times per month.

---

## 3. Section Order Update

The template (`template/sift_template.html`) section order becomes:

| Order | Key | Name |
|-------|-----|------|
| 1 | `01-header` | Header |
| 2 | `02-executive-summary` | Executive Summary |
| 3 | `03-top-stories` | Top Stories |
| 4 | `04-claude-anthropic` | Claude & Anthropic |
| 5 | `05-openai` | OpenAI & ChatGPT |
| 6 | `06-new-models` | New Models & Benchmarks |
| 7 | `14-model-leaderboard` | Model Leaderboard |
| 8 | `07-local-ai` | Local AI & Hardware |
| 9 | `08-business-deals` | Business & Funding |
| 10 | `09-dev-tools` | Developer Tools & Infra |
| 11 | `10-open-source` | Open Source Highlights |
| 12 | `13-openclaw` | OpenClaw |
| 13 | `15-humanoid-robotics` | Humanoid Robotics |
| 14 | `11-youtube` | YouTube Creators |
| 15 | `12-footer` | Footer |

---

## 4. KICKOFF.md Update

Change from:
```
Generate today's Sift daily edition. Read instructions/DAILY-DIGEST-CREATOR.md and execute the full pipeline — research, design, assemble, publish. No questions, no confirmations, just run it.
```

To:
```
Generate the next Sift edition. Read instructions/DAILY-DIGEST-CREATOR.md and execute the full pipeline — research, design, assemble, publish. No questions, no confirmations, just run it.
```

---

## 5. Pipeline Integration

### Files to Create
- `instructions/research/14-model-leaderboard.md` — research instructions
- `instructions/research/15-humanoid-robotics.md` — research instructions
- `instructions/design/14-model-leaderboard.md` — design instructions (custom layout)

### Files to Modify
- `template/sift_template.html` — add placeholders for both sections in correct order
- `template/css/sift.css` — add accent colors and leaderboard-specific CSS
- `instructions/DAILY-DIGEST-CREATOR.md` — add sections to batch assignments, update section table
- `instructions/MAIN.md` — update section definitions table
- `CLAUDE.md` — update section table and CSS custom properties
- `KICKOFF.md` — frequency-agnostic wording
- `scripts/d1-save.mjs` or D1 schema — register new sections (if sections are hardcoded)
- `scripts/assemble-digest.mjs` — may need update if section list is hardcoded

### Batch Assignment for Research
Add to existing batches or create new ones:
- **Research Agent 3** currently handles `06-new-models` + `07-local-ai`. Change to `06-new-models` + `14-model-leaderboard` (natural pairing).
- **New pairing for 07:** `07-local-ai` joins another batch or runs solo.
- **Research Agent 5** currently handles `11-youtube` + `13-openclaw`. Change to `11-youtube` + `15-humanoid-robotics` (both potentially sparse).
- `13-openclaw` joins another batch or runs solo.

Alternative: keep 5 agents but redistribute to 6 agents if the 2-section-per-agent budget allows. The model leaderboard is fast (no dedup, just fetching rankings), so pairing it with new-models is efficient.

### Design Batch Assignment
- `14-model-leaderboard` design can pair with `06-new-models` design
- `15-humanoid-robotics` uses standard news card design, can pair with `13-openclaw`

---

## 6. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Arena.ai ELO not in static HTML | High | Use web_search for rankings; fallback to Artificial Analysis Intelligence Index |
| Humanoid robotics has 0 items some weeks | High | Expected. Section omitted gracefully. |
| OpenRouter changes page structure | Low | Rankings are simple HTML table; fallback to web_search |
| Leaderboard data is stale/cached | Low | Rankings don't change dramatically week-to-week; any snapshot is useful |
| New CSS classes conflict with existing | Very Low | Namespaced under `.model-leaderboard` and `.humanoid-robotics` |
