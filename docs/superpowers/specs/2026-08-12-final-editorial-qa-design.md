# Final Editorial QA Design

## Objective

Add a conservative, recoverable deduplication workflow and a required final editorial gate so Sift cannot publish an edition with false-positive removals, same-event headline duplication, stale summary copy, or inconsistent rendered metadata.

## Root Causes

The current fuzzy score assigns 40% of its weight to entity overlap and removes every cross-section pair scoring at least `0.40`. Two unrelated Anthropic or OpenAI headlines can therefore be removed with zero shared words and zero shared bigrams. The dedup script also skips same-section pairs, deletes the losing item without a recovery manifest, and runs before link verification. If the retained URL later fails, no fallback remains.

Separately, the renderer estimates reading time from story count while `reading-time.mjs` counts rendered words. Its item counter also counts YouTube cards twice because they are both `<article>` elements and `.youtube-card` elements.

## Design

### Conservative deterministic deduplication

`cross-section-dedup.mjs` will automatically remove only exact URL or exact stable-ID duplicates. Fuzzy matches at or above `0.40` become review candidates rather than destructive removals. Entity-only matches are explicitly labeled as related-entity candidates, never confirmed duplicates.

The scan will include same-section pairs. Every exact duplicate and fuzzy review candidate will be written to `tmp/dedup-report.json`, including both complete item payloads, their sections, component scores, the selected winner for exact duplicates, and the action taken. Removed items therefore remain recoverable if a retained URL later fails.

### Required final editorial gate

`instructions/DAILY-DIGEST-CREATOR.md` will add Phase 3.5 after final link remediation and assembly but before indexes, metrics, finalization, and deployment. One editorial agent will read the final research JSON, rendered issue, content policy, pipeline log, and dedup report.

The agent will classify pairs as `SAME_EVENT`, `RELATED_EVENT`, or `ROUNDUP_CANDIDATE`; review large section attrition; check winner survival; remove pipeline mechanics from reader-facing copy; check source/product concentration; and reconcile counts, reading time, and singular/plural labels. It edits research JSON only. If content changes, it re-saves affected sections, regenerates the executive summary, reassembles, and reruns validation, link verification, reading-time metrics, and one final editorial check.

Publication is blocked by unresolved `FAIL` findings. Warnings are allowed when explicitly justified in `tmp/editorial-review.json`.

### Canonical rendered metrics

A shared metrics module will strip style/script content, count `<article>` story cards once, and calculate reading minutes from rendered words at 200 WPM. Both the renderer and `reading-time.mjs` will use this module. Section labels will render `1 item` and pluralize only other counts.

## August 11 Repair

Restore unique August 11 Anthropic, OpenAI, Open Source, and YouTube candidates that the entity-only fuzzy gate removed. Consolidate the two consecutive Claude Code patch releases, combine the MAI-Code 1.1 launch and 1.0 retirement into one migration card, and treat the Daybreak launch/Bedrock availability as one event using the best verified source. Rewrite the executive summary from the corrected final content, reassemble, validate, verify links, update indexes, finalize D1, commit, push, and verify the live issue and homepage.

## Safety and Scope

- Never hand-edit generated digest HTML.
- Preserve unrelated user files and changes.
- Do not auto-remove fuzzy pairs solely because they share a company, model family, or product entity.
- Preserve unique bullets when merging confirmed duplicates.
- Run at most one editorial correction loop before surfacing an unresolved failure.
- Maintain graceful degradation for genuinely quiet sections.

## Acceptance Criteria

- Entity-only pairs with zero lexical overlap are not automatically removed.
- Exact URL and stable-ID duplicates are removed and recoverable from the report.
- Same-section fuzzy candidates appear in the report.
- The final editorial gate is mandatory in the documented pipeline.
- Renderer and metrics CLI report identical story counts and reading minutes.
- Singular section labels use `item`.
- The corrected August 11 issue contains no same-event duplicate cards, contains no pipeline-status prose, passes research validation and story-link verification, and is live after push.
