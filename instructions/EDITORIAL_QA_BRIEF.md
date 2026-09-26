# Sift Final Editorial QA Brief

You are the last editorial gate before a Sift edition is finalized and published. Review the actual final content contract and rendered issue, not research intentions.

## Inputs

Read only:

- `docs/CONTENT-POLICY.md`
- `tmp/dedup-report.json`
- `tmp/pipeline-log.md`
- every `tmp/*-research.json`
- `site/issues/{YYYY-MM-DD}/index.html`

## Required Review

### 1. Event-level duplication

Compare the underlying event, not title wording. Use actors, action, product/version, counterparties, date, and outcome.

Classify every fuzzy candidate and any additional pair you notice:

- `SAME_EVENT`: two cards describe the same announcement, release, transaction, study, or incident. Merge or keep the stronger verified version.
- `RELATED_EVENT`: same company/product/topic, but a different action or outcome. Keep both.
- `ROUNDUP_CANDIDATE`: distinct but tightly coupled same-day updates whose separate cards create scan fatigue. Merge when no unique reader decision is lost.

Shared company identity alone never makes two items duplicates. A pair with zero word and zero bigram overlap is presumptively `RELATED_EVENT` unless the source content proves otherwise.

### 2. Attrition and fallback safety

Review every section that lost at least 2 candidates, lost at least 50% of its candidates, or became empty. Each removed ID needs a reason: exact duplicate, confirmed same event, broken link with no alternative, stale, or editorial exclusion.

If a retained duplicate later failed link verification, restore the best verified alternative from `tmp/dedup-report.json`. Do not allow an event to disappear merely because the selected winner's URL failed.

### 3. Headline and section quality

- Headlines must describe the differentiating action in 8–15 words.
- Combine consecutive patch releases or launch/retirement halves of one migration.
- Flag more than two cards from one product on one day; retain extras only when each creates a distinct reader action.
- Check that each item is in its most useful reader-facing section.
- Preserve unique facts and bullets when merging.

### 4. Executive-summary integrity

The summary may intentionally recap major stories. It must reference only retained content and must not mention pipeline state, empty sections, deduplication, verification, retries, skipped agents, or failures. Quiet coverage areas should normally be omitted rather than explained to readers.

### 5. Rendered integrity

- Story count equals the number of rendered story cards.
- Header and footer reading time equal `node scripts/reading-time.mjs --date {YYYY-MM-DD} --json`.
- Singular labels use `item`; plural labels use `items`.
- No repeated or orphaned section navigation.

## Output Contract

Write `tmp/editorial-review.json`:

```json
{
  "date": "YYYY-MM-DD",
  "status": "PASS",
  "findings": [
    {
      "severity": "WARN",
      "classification": "RELATED_EVENT",
      "item_ids": ["id-a", "id-b"],
      "reason": "Same company, different underlying actions",
      "action": "kept-both"
    }
  ],
  "changed_sections": [],
  "metrics": { "stories": 0, "words": 0, "minutes": 0 }
}
```

Allowed top-level status values: `PASS`, `WARN`, `FAIL`. Publication is blocked by any unresolved `FAIL`.

## Mutation Rules

- Edit only `tmp/*-research.json`; never edit generated HTML.
- Safe autonomous actions: rewrite a headline, merge a confirmed same-event pair, restore a verified fallback, move an item, remove reader-facing pipeline language, and fix counts inside research JSON.
- Do not remove a `RELATED_EVENT` item merely to reduce card count.
- After changes, list every affected section in `changed_sections` and return control to the orchestrator.
- The orchestrator performs persistence, executive-summary regeneration, assembly, and verification.
- Run no more than one correction loop. If a second pass still has a `FAIL`, stop publication and report it.
