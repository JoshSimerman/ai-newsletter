import { compositeScore } from './fuzzy.mjs';

export function selectWinner(a, b, priorities = {}) {
  const priorityA = priorities[a.section] || 5;
  const priorityB = priorities[b.section] || 5;

  if (priorityA !== priorityB) {
    return priorityA > priorityB
      ? { winner: a, loser: b }
      : { winner: b, loser: a };
  }

  const contentLength = entry =>
    (entry.item.summary_bullets?.length || 0) + (entry.item.summary?.length || 0);

  return contentLength(a) >= contentLength(b)
    ? { winner: a, loser: b }
    : { winner: b, loser: a };
}

function normalizeBullet(bullet) {
  return String(bullet).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function mergeUniqueBullets(winnerItem, loserItem) {
  const existing = new Set((winnerItem.summary_bullets || []).map(normalizeBullet));
  const added = (loserItem.summary_bullets || []).filter(bullet => {
    const normalized = normalizeBullet(bullet);
    if (!normalized || existing.has(normalized)) return false;
    existing.add(normalized);
    return true;
  });

  if (added.length > 0) {
    winnerItem.summary_bullets = [...(winnerItem.summary_bullets || []), ...added];
  }
  return added;
}

export function analyzeDedupPairs(items, entities, threshold = 0.4) {
  const exactDuplicates = [];
  const reviewCandidates = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const urlMatch = Boolean(a.item.url && b.item.url && a.item.url === b.item.url);
      const idMatch = Boolean(a.item.id && b.item.id && a.item.id === b.item.id);
      const score = compositeScore(a.item.title || '', b.item.title || '', entities);
      const sameSection = a.section === b.section;
      const pair = { a, b, urlMatch, idMatch, sameSection, score };

      if (urlMatch || idMatch) {
        exactDuplicates.push({ ...pair, classification: 'EXACT_DUPLICATE' });
      } else if (score.total >= threshold) {
        const entityOnly = score.word === 0 && score.bigram === 0 && score.entity > 0;
        reviewCandidates.push({
          ...pair,
          classification: entityOnly ? 'RELATED_ENTITY_REVIEW' : 'FUZZY_REVIEW',
        });
      }
    }
  }

  return { exactDuplicates, reviewCandidates };
}
