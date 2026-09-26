export function extractContentUrls(html) {
  const urls = new Set();
  const anchorRegex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const url = match[1];
    if (url.startsWith('http://') || url.startsWith('https://')) urls.add(url);
  }
  return [...urls];
}

async function request(url, method, timeout, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const headers = { 'User-Agent': 'Sift-LinkChecker/1.1' };
    if (method === 'GET') headers.Range = 'bytes=0-1023';
    const response = await fetchImpl(url, {
      method,
      signal: controller.signal,
      redirect: 'follow',
      headers,
    });
    return { status: response.status, ok: response.status < 400 };
  } finally {
    clearTimeout(timer);
  }
}

function isTransient(result) {
  return !result || result.status === 408 || result.status === 429 || result.status >= 500;
}

const defaultSleep = delay => new Promise(resolve => setTimeout(resolve, delay));

export async function checkUrl(url, timeout, fetchImpl = fetch, options = {}) {
  const {
    retries = 2,
    retryDelayMs = 250,
    sleep = defaultSleep,
  } = options;
  let headResult;
  try {
    headResult = await request(url, 'HEAD', timeout, fetchImpl);
    if (headResult.ok) return { url, ...headResult };
  } catch {
    // GET below is the authoritative fallback for blocked or unsupported HEAD.
  }

  let lastResult;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      lastResult = await request(url, 'GET', timeout, fetchImpl);
      lastError = null;
      if (lastResult.ok || !isTransient(lastResult)) return { url, ...lastResult };
    } catch (error) {
      lastError = error;
    }

    if (attempt < retries) await sleep(retryDelayMs * (2 ** attempt));
  }

  return {
    url,
    status: lastResult?.status || headResult?.status || 0,
    ok: false,
    ...(lastError && {
      error: lastError.name === 'AbortError' ? 'timeout' : lastError.message,
    }),
  };
}
