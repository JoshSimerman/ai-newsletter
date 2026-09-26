# Token Optimization Plan — 2026-03-28

## Problem Statement

The Sift daily digest pipeline produces high-quality output but consumes 3-5% of the Claude Max weekly token budget per run. At 5% daily, we'd exhaust ~35% of the weekly budget on digests alone, leaving insufficient capacity for other tasks.

**Target:** 1-3% weekly budget per daily run (10-20% weekly for all 7 editions)

**Current:** ~3-5% per run (~21-35% weekly if run daily)

---

## Current Architecture (Token Costs)

| Phase | Sub-agents | Estimated Token Load | Notes |
|-------|------------|---------------------|-------|
| Research Batch 1 | 10 parallel | HIGH | Each agent: reads instructions, searches web, fetches URLs, writes JSON |
| Research Batch 2 | 1 (exec summary) | MEDIUM | Reads all Batch 1 output |
| Design Batch 1 | 1 (header) | LOW | Simple template fill |
| Design Batch 2 | 10+ parallel | HIGH | Each reads research JSON + design instructions + writes HTML |
| Design Batch 3 | 1 (footer) | LOW | Simple template fill |
| Assembly | Main agent | MEDIUM | Reads all HTML fragments, assembles, validates |
| Deploy | Main agent | LOW | Git commands, curl verification |

**Major token sinks:**
1. **Instruction re-reading:** Every sub-agent reads the same instruction files
2. **Context duplication:** Research agents each carry full context
3. **Design redundancy:** 10 design agents each read similar instructions

---

## Key Finding: Context Accumulation Risk

**Subagents cannot clear context mid-task.** Each subagent runs in its own context window until completion, with no built-in way to reset context between sections.

**Why single-agent-per-phase is risky:**
- Agent researches section 1, 2, 3... by section 7-8, it has accumulated 7+ research outputs, web searches, and fetched articles in context
- Hallucination risk increases as context fills with similar-looking news items
- Cross-contamination between sections becomes likely

**The current architecture's hidden benefit:**
- Each sub-agent: read instructions → search → fetch → write JSON → done
- Context never exceeds what's needed for ONE section
- No cross-contamination between sections

**Conclusion:** We need a middle ground that reduces overhead but preserves isolation.

---

## Recommended Hybrid Approach

### Strategy: Batch 2 Sections Per Agent + Sonnet + Instruction Compression

Combine three optimizations for maximum savings while preserving quality:

| Change | Expected Savings | Risk |
|--------|-----------------|------|
| Batch 2 sections per agent (5 agents vs 10) | ~40-50% instruction overhead | Low - only 2 sections per context |
| Use Sonnet for research | ~40-60% per-token cost | Low - search/extract tasks |
| Instruction compression | ~30-40% per instruction read | Low - keep all rules, cut prose |

**Combined expected savings: 60-75%**

---

## Implementation Details

### 1. Research Phase Batching

**Current:** 10 research agents (1 per section)
**Proposed:** 5 research agents (2 sections each)

#### Batch Assignments (fixed, deterministic)

| Agent | Sections | Rationale |
|-------|----------|-----------|
| Research Agent 1 | `03-top-stories`, `08-business-deals` | General news grouping |
| Research Agent 2 | `04-claude-anthropic`, `05-openai` | AI company news |
| Research Agent 3 | `06-new-models`, `07-local-ai` | Model/technical news |
| Research Agent 4 | `09-dev-tools`, `10-open-source` | Developer ecosystem |
| Research Agent 5 | `11-youtube`, `13-openclaw` | Community/video content |

**Why this grouping works:**
- Related topics in same batch (reduces context confusion)
- Each agent handles exactly 2 sections (predictable load)
- No overlap - each section assigned to exactly one agent
- Agent processes sections sequentially within its batch

#### Agent Prompt Template

```
You are researching sections for today's Sift digest.

Process these sections IN ORDER:
1. {section_a} - Read instructions/research/{section_a}.md, execute, save JSON
2. {section_b} - Read instructions/research/{section_b}.md, execute, save JSON

For EACH section:
- Read the section-specific instructions
- Execute research (web search, fetch, extract)
- Write JSON to tmp/{section}-research.json
- Save to D1: node scripts/d1-save.mjs save-research ...
- Log completion to tmp/pipeline-log.md

Complete section 1 fully before starting section 2.
```

### 2. Design Phase Batching

**Current:** 10+ design agents
**Proposed:** 5 design agents (2 sections each, same grouping as research)

Design is simpler than research (no web fetching), so 2 sections per agent is very safe.

### 3. Use Sonnet for Research Agents

Set `model: "sonnet"` when spawning research sub-agents:

```javascript
Task({
  prompt: "...",
  subagent_type: "general-purpose",
  model: "sonnet"  // Sonnet for research
})
```

Keep Opus for:
- Executive summary (needs synthesis quality)
- Design agents (nuanced writing)
- Assembly (final output quality)

### 4. Instruction Compression

Create production-mode instruction files that maintain full fidelity but reduce tokens.

#### Compression Rules

**Remove:**
- Explanatory "why" paragraphs (agent needs rules, not rationale)
- Redundant examples (one example per concept is enough)
- Lengthy formatting descriptions already shown in templates
- Multi-paragraph prose that can be bullet points

**Keep (100% fidelity):**
- All rules and constraints
- Schema definitions with required fields
- Error handling instructions
- Quality checklist items
- One concrete example per concept
- All field names and types

#### Target Sizes

| File | Current | Target | Method |
|------|---------|--------|--------|
| RESEARCH_MAIN.md | ~9KB | ~5KB | Cut explanatory prose |
| Section instructions | ~2-3KB each | ~1.5KB each | Trim examples |
| Design instructions | ~4KB | ~2KB | Remove redundant styling notes |
| CONTENT-POLICY.md | ~4KB | ~2KB | Bullet points |

#### Example Compression

**Before (verbose):**
```markdown
### Publication Date Rules (CRITICAL)

> **Every article MUST have an accurate publication date.** This is non-negotiable.

When researching articles, you need to find the actual publication date. This is
important because we want to ensure freshness and accuracy. Look for various
meta tags and visible indicators...
```

**After (compressed, same rules):**
```markdown
### Publication Dates (REQUIRED)

- Every item MUST have `published_date` (YYYY-MM-DD)
- Find via: `article:published_time`, `<time datetime>`, ld+json `datePublished`
- No date found → reject item
- Date older than 24h → reject item (freshness violation)
- Never fabricate or guess dates
```

Same rules, ~60% fewer tokens.

---

## Architecture Summary

### Before (Current)

```
Orchestrator
├── Research: 10 parallel agents (Opus)
│   └── Each reads: RESEARCH_MAIN + section + CONTENT-POLICY (~15KB each)
├── Design: 10+ parallel agents (Opus)
│   └── Each reads: design instructions + research JSON (~6KB each)
└── Assembly: 1 agent (Opus)
```

**Total instruction reads:** ~210KB+ per run

### After (Optimized)

```
Orchestrator
├── Research: 5 parallel agents (Sonnet)
│   └── Each reads: RESEARCH_BRIEF + 2 section briefs (~8KB each)
│   └── Each processes 2 sections sequentially
├── Design: 5 parallel agents (Opus)
│   └── Each reads: design brief + 2 research JSONs (~4KB each)
└── Assembly: 1 agent (Opus)
```

**Total instruction reads:** ~60KB per run (~70% reduction)
**Plus:** Sonnet vs Opus for research (~50% additional cost savings)

---

## Constraints

| Constraint | Value | Notes |
|------------|-------|-------|
| Wall-clock time | Up to ~1 hour | Runs at 1 AM, read in morning |
| Quality | Must maintain current | No hallucinations, no missing dates |
| Context per agent | Max 2 sections | Preserve isolation benefits |
| Model for research | Sonnet | Cost savings |
| Model for design/assembly | Opus | Quality preservation |
| Instruction fidelity | 100% rules | Only cut explanatory prose |

---

## Implementation Checklist

### Phase 1: Instruction Compression
- [ ] Create `RESEARCH_BRIEF.md` (~5KB vs ~9KB)
- [ ] Create compressed section instruction variants
- [ ] Create `DESIGN_BRIEF.md`
- [ ] Verify all rules preserved (diff check)

### Phase 2: Update Pipeline
- [ ] Modify DAILY-DIGEST-CREATOR.md:
  - [ ] Change from 10 research agents to 5
  - [ ] Define fixed batch assignments
  - [ ] Add `model: "sonnet"` to research agent dispatch
  - [ ] Change from 10 design agents to 5
- [ ] Update pipeline budget (20 min → 45 min hard cap)
- [ ] Update validation to expect 5 research log entries instead of 10

### Phase 3: Test Run
- [ ] Run one digest with new architecture
- [ ] Compare token usage vs baseline
- [ ] Verify output quality (dates, sources, no hallucinations)
- [ ] Check for cross-section contamination

### Phase 4: Measure & Iterate
- [ ] If still over 3%, apply additional compression
- [ ] If quality issues, reduce to 1 section per agent for problem areas
- [ ] Document final architecture

---

## Rollback Plan

If quality degrades:
1. First: Reduce batch size from 2 to 1 for affected sections
2. Second: Revert to Opus for research if Sonnet causes issues
3. Third: Revert instruction compression if rules were accidentally lost

Keep original instruction files as `*_FULL.md` backups.
