import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCount, formatItemCount, readingStatsFromHtml } from './reading-metrics.mjs';

test('counts each article once including YouTube cards', () => {
  const html = `
    <article><p>First story.</p></article>
    <article class="youtube-card"><p>Second story.</p></article>
  `;

  assert.equal(readingStatsFromHtml(html).items, 2);
});

test('excludes style and script content from reading words', () => {
  const html = `
    <style>these words must never count</style>
    <article>one two three four</article>
    <script>nor should these script words</script>
  `;

  assert.deepEqual(readingStatsFromHtml(html), { words: 4, minutes: 1, items: 1 });
});

test('rounds reading time up at 200 words per minute', () => {
  const words = Array.from({ length: 201 }, () => 'word').join(' ');
  const stats = readingStatsFromHtml(`<article>${words}</article>`);

  assert.equal(stats.words, 201);
  assert.equal(stats.minutes, 2);
});

test('formats singular and plural item labels', () => {
  assert.equal(formatItemCount(1), '1 item');
  assert.equal(formatItemCount(0), '0 items');
  assert.equal(formatItemCount(2), '2 items');
});

test('formats arbitrary singular and plural count labels', () => {
  assert.equal(formatCount(1, 'story'), '1 story');
  assert.equal(formatCount(2, 'story', 'stories'), '2 stories');
  assert.equal(formatCount(1, 'source'), '1 source');
});
