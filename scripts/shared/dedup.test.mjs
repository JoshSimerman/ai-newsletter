import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDedupPairs, mergeUniqueBullets, selectWinner } from './dedup.mjs';

const entities = {
  anthropic: ['anthropic', 'claude', 'claude code'],
  microsoft: ['microsoft', 'copilot', 'github copilot'],
};

function entry(section, index, item) {
  return { section, index, item };
}

test('entity-only title match is reviewable and never an automatic duplicate', () => {
  const items = [
    entry('03-top-stories', 0, {
      id: 'theseus',
      title: 'Anthropic Forms Theseus Venture for Data Centers',
      url: 'https://example.com/theseus',
    }),
    entry('04-claude-anthropic', 0, {
      id: 'watermarks',
      title: 'Claude adds text watermarks and C2PA provenance',
      url: 'https://example.com/watermarks',
    }),
  ];

  const result = analyzeDedupPairs(items, entities);

  assert.equal(result.exactDuplicates.length, 0);
  assert.equal(result.reviewCandidates.length, 1);
  assert.equal(result.reviewCandidates[0].classification, 'RELATED_ENTITY_REVIEW');
  assert.equal(result.reviewCandidates[0].score.word, 0);
  assert.equal(result.reviewCandidates[0].score.bigram, 0);
});

test('exact URL or stable ID creates an automatic duplicate', () => {
  const items = [
    entry('03-top-stories', 0, {
      id: 'same-event',
      title: 'Primary report about one launch',
      url: 'https://example.com/event',
    }),
    entry('05-openai', 0, {
      id: 'same-event',
      title: 'Another headline for the launch',
      url: 'https://example.com/event',
    }),
  ];

  const result = analyzeDedupPairs(items, entities);

  assert.equal(result.exactDuplicates.length, 1);
  assert.equal(result.reviewCandidates.length, 0);
  assert.equal(result.exactDuplicates[0].urlMatch, true);
  assert.equal(result.exactDuplicates[0].idMatch, true);
});

test('same-section fuzzy matches are included for editorial review', () => {
  const items = [
    entry('09-dev-tools', 0, {
      id: 'mai-launch',
      title: 'GitHub Copilot adds MAI-Code-1.1-Flash at 0.25x multiplier',
      url: 'https://example.com/launch',
    }),
    entry('09-dev-tools', 1, {
      id: 'mai-retirement',
      title: 'GitHub retires MAI-Code-1-Flash from Copilot September 10',
      url: 'https://example.com/retirement',
    }),
  ];

  const result = analyzeDedupPairs(items, entities);

  assert.equal(result.exactDuplicates.length, 0);
  assert.equal(result.reviewCandidates.length, 1);
  assert.equal(result.reviewCandidates[0].sameSection, true);
  assert.equal(result.reviewCandidates[0].a.item.id, 'mai-launch');
  assert.equal(result.reviewCandidates[0].b.item.id, 'mai-retirement');
});

test('winner selection prefers section priority and retains full loser payload', () => {
  const a = entry('03-top-stories', 0, {
    id: 'top',
    title: 'Top headline',
    url: 'https://example.com/event',
    summary_bullets: ['Top fact'],
  });
  const b = entry('05-openai', 0, {
    id: 'specific',
    title: 'Specific headline',
    url: 'https://example.com/event',
    summary: 'Full recoverable summary',
  });

  const decision = selectWinner(a, b, { '03-top-stories': 10, '05-openai': 8 });

  assert.equal(decision.winner.item.id, 'top');
  assert.equal(decision.loser.item.summary, 'Full recoverable summary');
});

test('bullet merge preserves distinct facts that share a long prefix', () => {
  const winner = {
    summary_bullets: ['Anthropic signed a long-term infrastructure agreement worth $9.1 billion.'],
  };
  const loser = {
    summary_bullets: ['Anthropic signed a long-term infrastructure agreement lasting 20 years.'],
  };

  const added = mergeUniqueBullets(winner, loser);

  assert.equal(added.length, 1);
  assert.deepEqual(winner.summary_bullets, [
    'Anthropic signed a long-term infrastructure agreement worth $9.1 billion.',
    'Anthropic signed a long-term infrastructure agreement lasting 20 years.',
  ]);
});
