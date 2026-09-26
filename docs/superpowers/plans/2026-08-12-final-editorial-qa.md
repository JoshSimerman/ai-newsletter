# Final Editorial QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make deduplication conservative and recoverable, add a mandatory final editorial gate, unify rendered metrics, and repair the August 11 edition.

**Architecture:** Extract pure dedup-analysis and rendered-metrics helpers so behavior can be regression-tested without D1 or network access. The pipeline script consumes the helpers, writes a recovery report, and leaves semantic decisions to a final editorial agent. Research JSON remains the only editable content contract; HTML remains deterministic output.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, Cloudflare D1 CLI, deterministic HTML renderer, Firecrawl CLI for source recovery.

## Global Constraints

- Never hand-edit generated digest HTML.
- Preserve unrelated `.codex/` and `AGENTS.md` files.
- Automatically remove only exact URL or stable-ID duplicates.
- Fuzzy pairs are review candidates and must retain both complete items.
- Final editorial QA runs before indexes, finalization, commit, and deployment.
- Reading time uses 200 words per minute from rendered visible text.

---

### Task 1: Conservative dedup analysis and recovery report

**Files:**
- Create: `scripts/shared/dedup.mjs`
- Create: `scripts/shared/dedup.test.mjs`
- Modify: `scripts/cross-section-dedup.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `analyzeDedupPairs(items, entities)` returning `{ exactDuplicates, reviewCandidates }`.
- Produces: `selectWinner(a, b, priorities)` returning `{ winner, loser }`.
- Produces: `tmp/dedup-report.json` with full pair payloads and actions.

- [ ] Write tests proving entity-only pairs are review candidates, exact URL/ID pairs are automatic duplicates, and same-section fuzzy pairs are included.
- [ ] Run the focused tests and confirm they fail because the helper does not exist.
- [ ] Implement the minimal pure helper.
- [ ] Run focused tests and confirm they pass.
- [ ] Refactor `cross-section-dedup.mjs` to consume the helper, auto-remove only exact duplicates, preserve unique bullets, and always write the report.
- [ ] Run the full test suite.

### Task 2: Canonical reading metrics and count grammar

**Files:**
- Create: `scripts/shared/reading-metrics.mjs`
- Create: `scripts/shared/reading-metrics.test.mjs`
- Modify: `scripts/reading-time.mjs`
- Modify: `scripts/assemble-digest.mjs`

**Interfaces:**
- Produces: `readingStatsFromHtml(html, wpm = 200)` returning `{ words, minutes, items }`.
- Produces: `formatItemCount(count)` returning `1 item` or `${count} items`.

- [ ] Write tests proving a YouTube `<article class="youtube-card">` counts once, style/script text is excluded, reading minutes use ceiling division, and singular labels are grammatical.
- [ ] Run focused tests and confirm they fail because the helpers do not exist.
- [ ] Implement the metrics helpers.
- [ ] Update the CLI and renderer to use the shared metrics and placeholder replacement.
- [ ] Run focused and full tests.
- [ ] Assemble August 11 and confirm the page and CLI report identical metrics.

### Task 3: Document the final editorial gate

**Files:**
- Create: `instructions/EDITORIAL_QA_BRIEF.md`
- Modify: `instructions/DAILY-DIGEST-CREATOR.md`

**Interfaces:**
- Consumes: final research JSON, `tmp/dedup-report.json`, pipeline log, content policy, and rendered issue.
- Produces: `tmp/editorial-review.json` with `PASS`, `WARN`, or `FAIL` findings and applied actions.

- [ ] Add the editorial-review rubric, classification vocabulary, output schema, mutation limits, and one-loop rule.
- [ ] Insert Phase 3.5 before index updates and make unresolved failures a publication blocker.
- [ ] Amend the earlier dedup phase to describe exact-only automatic removal and fuzzy semantic review.
- [ ] Extend the quality checklist with editorial gate, attrition, summary-integrity, and metric reconciliation checks.
- [ ] Scan the instructions for contradictory old dedup claims and fix them.

### Task 4: Repair the August 11 research contract

**Files:**
- Modify: `tmp/02-executive-summary-research.json`
- Modify: affected `tmp/*-research.json` files
- Regenerate: `site/issues/2026-08-11/index.html`
- Regenerate: `site/index.html`
- Regenerate: `site/issues/index.html`

**Interfaces:**
- Consumes: August 11 D1 content records and verified original sources.
- Produces: corrected research JSON and rendered edition.

- [ ] Recover source details for candidates incorrectly removed by entity-only fuzzy matching.
- [ ] Merge same-event release clusters while retaining unique facts and the strongest verified URL.
- [ ] Save changed research sections to D1.
- [ ] Rewrite and save the executive summary from final retained content.
- [ ] Write `tmp/editorial-review.json` documenting every merge, restoration, and intentional related-story retention.
- [ ] Reassemble and update indexes.

### Task 5: Verify, publish, and confirm deployment

**Files:**
- Commit only the approved docs, scripts, tests, instructions, package manifest, and generated site files.

**Interfaces:**
- Consumes: completed tasks 1–4.
- Produces: pushed `main`, published D1 edition, and live HTTP verification.

- [ ] Run `npm test` and require zero failures.
- [ ] Run research validation and require no `FAIL` sections.
- [ ] Run link verification and require all story links to pass; ignore only known bare preconnect origins.
- [ ] Run reading-time and compare it to the rendered header/footer and story count.
- [ ] Run the editorial checklist against the final HTML and JSON.
- [ ] Run `git diff --check`, inspect the staged diff, and preserve unrelated files.
- [ ] Finalize D1, commit, and push `main`.
- [ ] Poll the live issue until HTTP 200 and verify the homepage references `2026-08-11`.
