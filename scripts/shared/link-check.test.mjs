import test from 'node:test';
import assert from 'node:assert/strict';
import { checkUrl, extractContentUrls } from './link-check.mjs';

test('extracts content anchors but ignores font and preconnect link elements', () => {
  const html = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="stylesheet" href="https://fonts.example/styles.css">
    <a href="https://example.com/story">Story</a>
    <a href="/issues/">Archive</a>
  `;

  assert.deepEqual(extractContentUrls(html), ['https://example.com/story']);
});

test('retries a blocked HEAD response with a ranged GET', async () => {
  const methods = [];
  const fetchImpl = async (_url, options) => {
    methods.push(options.method);
    return { status: options.method === 'HEAD' ? 403 : 200 };
  };

  const result = await checkUrl('https://example.com/story', 1000, fetchImpl);

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.deepEqual(methods, ['HEAD', 'GET']);
});

test('returns the GET failure when both verification methods fail', async () => {
  const fetchImpl = async (_url, options) => ({
    status: options.method === 'HEAD' ? 405 : 404,
  });

  const result = await checkUrl('https://example.com/missing', 1000, fetchImpl);

  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
});

test('retries transient GET failures with bounded backoff', async () => {
  const methods = [];
  const delays = [];
  const responses = [503, 503, 200];
  const fetchImpl = async (_url, options) => {
    methods.push(options.method);
    return { status: responses.shift() };
  };

  const result = await checkUrl('https://example.com/transient', 1000, fetchImpl, {
    retries: 2,
    retryDelayMs: 10,
    sleep: async delay => delays.push(delay),
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.deepEqual(methods, ['HEAD', 'GET', 'GET']);
  assert.deepEqual(delays, [10]);
});

test('does not retry a hard 404 response', async () => {
  const methods = [];
  const fetchImpl = async (_url, options) => {
    methods.push(options.method);
    return { status: options.method === 'HEAD' ? 405 : 404 };
  };

  await checkUrl('https://example.com/missing', 1000, fetchImpl, {
    retries: 2,
    sleep: async () => {},
  });

  assert.deepEqual(methods, ['HEAD', 'GET']);
});
