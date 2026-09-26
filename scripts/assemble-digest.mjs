#!/usr/bin/env node
/**
 * Sift Digest Assembler
 * Reads research JSON files and generates the complete HTML digest.
 * Usage: node scripts/assemble-digest.mjs --date YYYY-MM-DD [--research-dir DIR] [--out-dir DIR]
 *
 *   --research-dir  where {section}-research.json files live (default: tmp/)
 *   --out-dir       site root to write issues/{date}/index.html into (default: site/)
 *
 * SITE_URL (from .env / .env.local) sets the canonical and og:url tags; they are omitted when unset.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatCount, formatItemCount, readingStatsFromHtml } from './shared/reading-metrics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load env
for (const envFile of ['.env', '.env.local']) {
  const envPath = path.join(ROOT, envFile);
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').replace(/\r/g, '').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim();
    }
  }
}
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');

const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const now = new Date();
const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const DATE = argValue('--date') || localToday;
const RESEARCH_DIR = path.resolve(ROOT, argValue('--research-dir') || 'tmp');
const OUT_SITE_DIR = path.resolve(ROOT, argValue('--out-dir') || 'site');

// Format date for display
const dateObj = new Date(DATE + 'T12:00:00Z');
const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const formattedDate = `${dayNames[dateObj.getUTCDay()]}, ${monthNames[dateObj.getUTCMonth()]} ${dateObj.getUTCDate()}, ${dateObj.getUTCFullYear()}`;
const shortDate = `${monthNames[dateObj.getUTCMonth()].slice(0,3)} ${dateObj.getUTCDate()}, ${dateObj.getUTCFullYear()}`;

// Read CSS
const css = fs.readFileSync(path.join(ROOT, 'template/css/sift.css'), 'utf8');

// Read research JSON from the research directory (tmp/ by default)
function readResearch(sectionKey) {
  const filename = `${sectionKey}-research.json`;
  const primaryPath = path.join(RESEARCH_DIR, filename);
  try {
    const data = JSON.parse(fs.readFileSync(primaryPath, 'utf8'));
    // Leaderboard uses arena_top_10/open_top_5/openrouter_top_10 instead of items
    if (sectionKey === '14-model-leaderboard') return data;
    if (data.items && data.items.length > 0) return data;
  } catch {}
  // Return empty
  return { section_key: sectionKey, items: [] };
}

// Format date for cards
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00Z');
  if (isNaN(dt.getTime())) return esc(d);
  return `${monthNames[dt.getUTCMonth()].slice(0,3)} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;
}

// Escape HTML
function esc(s) {
  if (!s) return '';
  if (typeof s !== 'string') s = String(s);
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Generate a news card
function renderCard(item) {
  const isoDate = item.published_date || item.date || '';
  let html = `    <article class="news-card">
      <div class="card-meta">
        <span class="card-source">${esc(item.source)}</span>
        <span class="card-sep">·</span>
        <time class="card-date"${isoDate ? ` datetime="${esc(isoDate)}"` : ''}>${fmtDate(isoDate)}</time>
        <span class="card-type">${esc(item.content_type || '')}</span>
      </div>
      <h3 class="card-title">
        <a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a>
      </h3>\n`;

  // Summary + optional bullets
  if (item.summary_bullets && item.summary_bullets.length > 0) {
    // First sentence — a period only ends a sentence when followed by whitespace/EOL
    // (keeps "GPT-5.6" and version numbers intact)
    const sentenceMatch = item.summary ? item.summary.match(/^[\s\S]*?[.!?](?=\s|$)/) : null;
    const introText = sentenceMatch ? sentenceMatch[0].trim() : (item.summary || '');
    if (introText) html += `      <p class="card-summary">${esc(introText)}</p>\n`;
    html += `      <ul class="card-bullets">\n`;
    for (const b of item.summary_bullets) {
      // Escape scraped text first, then convert **bold** — text to <strong>bold</strong> — text
      const formatted = esc(b).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html += `        <li>${formatted}</li>\n`;
    }
    html += `      </ul>\n`;
  } else if (item.summary) {
    html += `      <p class="card-summary">${esc(item.summary)}</p>\n`;
  }

  // Details block for funding/models
  if (item.details) {
    const d = item.details;
    let detailParts = [];
    if (d.amount) detailParts.push(`<span class="detail-label">Amount:</span> <span class="detail-value">${esc(d.amount)}</span>`);
    if (d.valuation) detailParts.push(`<span class="detail-label">Valuation:</span> <span class="detail-value">${esc(d.valuation)}</span>`);
    if (d.deal_type) detailParts.push(`<span class="detail-label">Type:</span> <span class="detail-value">${esc(d.deal_type)}</span>`);
    if (d.lead_investors && d.lead_investors.length) detailParts.push(`<span class="detail-label">Lead:</span> <span class="detail-value">${esc(d.lead_investors.join(', '))}</span>`);
    if (d.parameter_count) detailParts.push(`<span class="detail-label">Params:</span> <span class="detail-value">${esc(d.parameter_count)}</span>`);
    if (d.availability) detailParts.push(`<span class="detail-label">Available:</span> <span class="detail-value">${esc(d.availability)}</span>`);
    if (d.license) detailParts.push(`<span class="detail-label">License:</span> <span class="detail-value">${esc(d.license)}</span>`);
    if (d.stars) detailParts.push(`<span class="detail-label">Stars:</span> <span class="detail-value">${d.stars.toLocaleString()}</span>`);
    if (d.language) detailParts.push(`<span class="detail-label">Language:</span> <span class="detail-value">${esc(d.language)}</span>`);
    if (d.version) detailParts.push(`<span class="detail-label">Version:</span> <span class="detail-value">${esc(d.version)}</span>`);
    if (detailParts.length) {
      html += `      <div class="card-details">${detailParts.join(' · ')}</div>\n`;
    }
  }

  // Tags
  if (item.tags && item.tags.length) {
    html += `      <div class="card-tags">\n`;
    for (const t of item.tags) {
      html += `        <span class="tag">${esc(t)}</span>\n`;
    }
    html += `      </div>\n`;
  }

  html += `    </article>`;
  return html;
}

// Section config
const sectionConfig = {
  '03-top-stories': { cssClass: 'top-stories', id: 'top-stories', name: 'Top Stories', icon: '◇', accent: 'top' },
  '04-claude-anthropic': { cssClass: 'claude-anthropic', id: 'claude-anthropic', name: 'Claude & Anthropic', icon: '▣', accent: 'claude' },
  '05-openai': { cssClass: 'openai', id: 'openai', name: 'OpenAI & ChatGPT', icon: '▢', accent: 'openai' },
  '06-new-models': { cssClass: 'new-models', id: 'new-models', name: 'New Models & Benchmarks', icon: '△', accent: 'models' },
  '07-local-ai': { cssClass: 'local-ai', id: 'local-ai', name: 'Local AI & Hardware', icon: '⬡', accent: 'local' },
  '08-business-deals': { cssClass: 'business-deals', id: 'business-deals', name: 'Business & Funding', icon: '◈', accent: 'deals' },
  '09-dev-tools': { cssClass: 'dev-tools', id: 'dev-tools', name: 'Developer Tools & Infra', icon: '⬢', accent: 'tools' },
  '10-open-source': { cssClass: 'open-source', id: 'open-source', name: 'Open Source Highlights', icon: '◎', accent: 'oss' },
  '15-humanoid-robotics': { cssClass: 'humanoid-robotics', id: 'humanoid-robotics', name: 'Humanoid Robotics', icon: '◉', accent: 'humanoid' },
};

// Render a standard news section
function renderNewsSection(sectionKey, data) {
  const cfg = sectionConfig[sectionKey];
  if (!cfg || !data.items || data.items.length === 0) return '';

  // Sort by relevance_score DESC
  const items = [...data.items].sort((a, b) => (b.relevance_score || b.score || 0) - (a.relevance_score || a.score || 0));

  let html = `<section class="section news-section ${cfg.cssClass}" id="${cfg.id}">
  <div class="section-header">
    <div class="section-label">
      <span class="section-icon" style="color: var(--accent-${cfg.accent})">${cfg.icon}</span>
      <h2 class="section-name">${cfg.name}</h2>
    </div>
    <span class="section-count">${formatItemCount(items.length)}</span>
  </div>
  <div class="news-cards">\n`;

  for (const item of items) {
    html += renderCard(item) + '\n';
  }

  html += `  </div>\n</section>`;
  return html;
}

// Render YouTube section
function renderYouTube(data) {
  if (!data.items || data.items.length === 0) return '';
  const items = [...data.items].sort((a, b) => (b.relevance_score || b.score || 0) - (a.relevance_score || a.score || 0));

  let html = `<section class="section youtube-section" id="youtube">
  <div class="section-header">
    <div class="section-label">
      <span class="section-icon" style="color: var(--accent-youtube)">▶</span>
      <h2 class="section-name">YouTube</h2>
    </div>
    <span class="section-count">${items.length} new video${items.length === 1 ? '' : 's'}</span>
  </div>
  <div class="youtube-grid">\n`;

  for (const item of items) {
    const d = item.details || {};
    const videoId = d.video_id || item.video_id || '';
    const thumbUrl = d.thumbnail_url || item.thumbnail || (videoId ? `https://img.youtube.com/vi/${esc(videoId)}/hqdefault.jpg` : '');
    const duration = esc(d.duration || item.duration || '');
    const channel = esc(d.channel_name || item.channel || item.source || '');
    const avatarUrl = item.creatorAvatarUrl || item.avatar_url || d.avatar_url || '';
    const publishedAt = item.published_at || item.publishedAt || d.published_at || item.published_date || '';
    // publishedAt rendered client-side via inline script for local timezone

    html += `    <article class="youtube-card">
      <a href="${esc(item.url)}" target="_blank" rel="noopener" class="youtube-thumb-link">
        <div class="youtube-thumb" style="background-image: url('${esc(thumbUrl)}')">
          ${duration ? `<span class="youtube-duration">${duration}</span>` : ''}
        </div>
      </a>
      <div class="youtube-info">
        <h3 class="youtube-title">
          <a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a>
        </h3>
        <div class="youtube-meta">
${avatarUrl ? `          <img class="youtube-avatar" src="${esc(avatarUrl)}" alt="${channel}" />\n` : ''}          <span class="youtube-channel">${channel}</span>
          ${publishedAt ? `<span class="card-sep">·</span>\n          <time class="youtube-published" datetime="${esc(publishedAt)}"></time>` : ''}
        </div>
      </div>
    </article>\n`;
  }

  html += `  </div>\n</section>`;
  return html;
}

// Render OpenClaw & Hermes section
function renderOpenClaw(data) {
  if (!data.items || data.items.length === 0) return '';
  const items = [...data.items].sort((a, b) => (b.relevance_score || b.score || 0) - (a.relevance_score || a.score || 0));

  let html = `<section class="section news-section openclaw" id="openclaw">
  <div class="section-header">
    <div class="section-label">
      <span class="section-icon" style="color: var(--accent-openclaw)">⬟</span>
      <h2 class="section-name">OpenClaw & Hermes</h2>
    </div>
    <span class="section-count">${formatItemCount(items.length)}</span>
  </div>
  <div class="news-cards">\n`;

  for (const item of items) {
    html += renderCard(item) + '\n';
  }

  html += `  </div>\n</section>`;
  return html;
}

// Render Model Leaderboard section
function renderLeaderboard(data) {
  if (!data || (!data.arena_top_10?.length && !data.open_top_5?.length && !data.openrouter_top_10?.length)) return '';

  const rankingCount = [data.arena_top_10, data.open_top_5, data.openrouter_top_10]
    .filter(r => r?.length).length;

  let html = `<section class="section news-section model-leaderboard" id="model-leaderboard">
  <div class="section-header">
    <div class="section-label">
      <span class="section-icon" style="color: var(--accent-leaderboard)">⊡</span>
      <h2 class="section-name">Model Leaderboard</h2>
    </div>
    <span class="section-count">${rankingCount} ranking${rankingCount === 1 ? '' : 's'}</span>
  </div>\n`;

  function renderRanking(items, label, badge, badgeCls, scoreFn, barCls, rank1Cls) {
    if (!items || !items.length) return '';
    let out = `  <div class="leaderboard-group">\n`;
    out += `    <div class="leaderboard-label">${label}${badge ? ` <span class="leaderboard-badge ${badgeCls}">${badge}</span>` : ''}</div>\n`;
    const maxScore = scoreFn(items[0]);
    for (const item of items) {
      const score = scoreFn(item);
      const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 100;
      const isTop3 = item.rank <= 3;
      const cls = isTop3 ? '' : ' compact';
      const r1 = item.rank === 1 ? ` ${rank1Cls}` : '';
      out += `    <div class="leaderboard-entry${cls}">\n`;
      out += `      <span class="rank-badge${r1}">${item.rank}</span>\n`;
      out += `      <span class="leaderboard-model">${esc(item.model)}</span>\n`;
      out += `      <span class="leaderboard-score">${esc(String(item.elo || item.tokens || ''))}</span>\n`;
      out += `    </div>\n`;
      if (isTop3) {
        out += `    <div class="leaderboard-bar"><div class="leaderboard-bar-fill ${barCls}" style="width:${pct}%"></div></div>\n`;
      }
    }
    out += `  </div>\n`;
    return out;
  }

  html += renderRanking(data.arena_top_10, `Arena.ai — Top ${data.arena_top_10?.length || 0} Overall`, null, '', i => i.elo || 0, '', 'rank-1');
  html += renderRanking(data.open_top_5, `Top ${data.open_top_5?.length || 0} Open-Weight Models`, 'OPEN', 'open', i => i.elo || 0, 'open', 'rank-1-open');
  html += renderRanking(data.openrouter_top_10, `OpenRouter — Top ${data.openrouter_top_10?.length || 0} by Usage`, 'TRAFFIC', 'usage', i => parseFloat(String(i.tokens || '0').replace(/[TB]/g,'')) || 0, 'usage', 'rank-1-usage');

  if (data.editorial_note) {
    html += `  <div class="leaderboard-note">${esc(data.editorial_note)}</div>\n`;
  }

  html += `</section>`;
  return html;
}

// ===== LOAD ALL RESEARCH DATA =====
const execData = readResearch('02-executive-summary');
const topStories = readResearch('03-top-stories');
const claude = readResearch('04-claude-anthropic');
const openai = readResearch('05-openai');
const models = readResearch('06-new-models');
const localAi = readResearch('07-local-ai');
const business = readResearch('08-business-deals');
const devTools = readResearch('09-dev-tools');
const openSource = readResearch('10-open-source');
const youtube = readResearch('11-youtube');
const openclaw = readResearch('13-openclaw');
const leaderboard = readResearch('14-model-leaderboard');
const humanoid = readResearch('15-humanoid-robotics');

// Count total items + distinct sources
const allSections = [topStories, claude, openai, models, localAi, business, devTools, openSource, youtube, openclaw, humanoid];
const totalItems = allSections.reduce((sum, s) => sum + (s.items?.length || 0), 0);
const activeSections = allSections.filter(s => s.items?.length > 0);
const sourceSet = new Set();
for (const s of allSections) {
  for (const it of s.items || []) {
    if (it.source) sourceSet.add(it.source);
  }
}

// ===== EXECUTIVE SUMMARY =====
const execItem = execData.items?.[0] || {};
const paragraphs = execItem.summary_paragraphs || [];
const highlightCount = execItem.highlight_count || {};

let execHtml = `<section class="section executive-summary" id="executive-summary">
  <div class="section-label">
    <span class="section-icon">◆</span>
    <span class="section-name">Today's Briefing</span>
  </div>
  <div class="summary-content">\n`;

for (const p of paragraphs) {
  execHtml += `    <p>${esc(p)}</p>\n`;
}

execHtml += `  </div>\n  <div class="summary-nav">\n`;

// Nav pills for active sections
const pillConfig = [
  { key: 'top_stories', href: '#top-stories', label: 'Top Stories', cls: '' },
  { key: 'claude_anthropic', href: '#claude-anthropic', label: 'Claude & Anthropic', cls: 'claude' },
  { key: 'openai', href: '#openai', label: 'OpenAI', cls: 'openai' },
  { key: 'new_models', href: '#new-models', label: 'New Models', cls: 'models' },
  { key: 'local_ai', href: '#local-ai', label: 'Local AI', cls: 'local' },
  { key: 'business_deals', href: '#business-deals', label: 'Business', cls: 'deals' },
  { key: 'dev_tools', href: '#dev-tools', label: 'Dev Tools', cls: 'tools' },
  { key: 'open_source', href: '#open-source', label: 'Open Source', cls: 'oss' },
  { key: 'openclaw', href: '#openclaw', label: 'OpenClaw & Hermes', cls: 'openclaw' },
  { key: 'humanoid_robotics', href: '#humanoid-robotics', label: 'Humanoid Robotics', cls: 'humanoid' },
  { key: 'youtube', href: '#youtube', label: 'YouTube', cls: 'youtube' },
];

// Use actual item counts from research data
const actualCounts = {
  top_stories: topStories.items?.length || 0,
  claude_anthropic: claude.items?.length || 0,
  openai: openai.items?.length || 0,
  new_models: models.items?.length || 0,
  local_ai: localAi.items?.length || 0,
  business_deals: business.items?.length || 0,
  dev_tools: devTools.items?.length || 0,
  open_source: openSource.items?.length || 0,
  openclaw: openclaw.items?.length || 0,
  humanoid_robotics: humanoid.items?.length || 0,
  youtube: youtube.items?.length || 0,
};

for (const pill of pillConfig) {
  const count = actualCounts[pill.key] || 0;
  if (count > 0) {
    execHtml += `    <a href="${pill.href}" class="nav-pill ${pill.cls}">${pill.label} <span class="pill-count">${count}</span></a>\n`;
  }
}

execHtml += `  </div>\n</section>`;

// ===== HEADER =====
const headerHtml = `<header class="digest-header">
  <nav class="header-nav">
    <h1 class="nav-brand"><a href="/">Sift</a></h1>
    <div class="nav-links">
      <a href="/issues/">Archive</a>
    </div>
  </nav>
  <div class="header-meta">
    <div class="header-date">
      <span class="date-label">Daily AI Digest</span>
      <time datetime="${DATE}">${formattedDate}</time>
    </div>
    <div class="header-stats">
      <span class="stat" title="Total items">${formatCount(totalItems, 'story', 'stories')}</span>
      <span class="stat-sep">·</span>
      <span class="stat" title="Distinct sources cited">${formatCount(sourceSet.size, 'source')}</span>
      <span class="stat-sep">·</span>
      <span class="stat" title="Estimated reading time">~__READING_MINUTES__ min read</span>
    </div>
  </div>
</header>`;

// ===== FOOTER =====
const footerHtml = `<footer class="digest-footer">
  <div class="footer-nav">
    <a href="/issues/">Browse Archive</a>
    <span class="footer-sep">·</span>
    <a href="/">Home</a>
  </div>
  <div class="footer-meta">
    <p class="footer-generated">Generated by Claude Code · ${DATE} · ~__READING_MINUTES__ min read</p>
    <p class="footer-disclaimer">Links point to original sources. Summaries are AI-generated from source content.</p>
  </div>
</footer>`;

// ===== ASSEMBLE =====
// The renderers above are the single source of truth for section markup.
// (AI design fragments are no longer used — see instructions/DAILY-DIGEST-CREATOR.md.)
const divider = `\n<div class="divider"></div>\n\n`;
let sections = [];

sections.push(headerHtml);
sections.push(execHtml);

// Standard news sections
const sectionOrder = [
  { key: '03-top-stories', data: topStories },
  { key: '04-claude-anthropic', data: claude },
  { key: '05-openai', data: openai },
  { key: '06-new-models', data: models },
];

for (const { key, data } of sectionOrder) {
  const html = renderNewsSection(key, data);
  if (html) sections.push(html);
}

// Model Leaderboard (custom renderer)
const leaderboardHtml = renderLeaderboard(leaderboard);
if (leaderboardHtml) sections.push(leaderboardHtml);

// Continue standard sections
const sectionOrder2 = [
  { key: '07-local-ai', data: localAi },
  { key: '08-business-deals', data: business },
  { key: '09-dev-tools', data: devTools },
  { key: '10-open-source', data: openSource },
];

for (const { key, data } of sectionOrder2) {
  const html = renderNewsSection(key, data);
  if (html) sections.push(html);
}

// OpenClaw
const openclawHtml = renderOpenClaw(openclaw);
if (openclawHtml) sections.push(openclawHtml);

// Humanoid Robotics (standard news cards)
const humanoidHtml = renderNewsSection('15-humanoid-robotics', humanoid);
if (humanoidHtml) sections.push(humanoidHtml);

// YouTube
const youtubeHtml = renderYouTube(youtube);
if (youtubeHtml) sections.push(youtubeHtml);

// Footer
sections.push(footerHtml);

// Join with dividers between content sections
let body = sections[0] + '\n\n'; // header
body += sections[1]; // exec summary
for (let i = 2; i < sections.length - 1; i++) {
  body += divider + sections[i];
}
body += '\n\n' + sections[sections.length - 1]; // footer

// Final HTML
const metaDescription = esc(
  (paragraphs[0] || `Sift — the daily AI digest for ${formattedDate}: ${totalItems} stories across Claude, OpenAI, new models, dev tools, and more.`)
    .replace(/\s+/g, ' ')
    .slice(0, 200)
);
const canonicalUrl = SITE_URL ? `${SITE_URL}/issues/${DATE}/` : '';
let finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
<meta name="description" content="${metaDescription}">
<meta name="theme-color" content="#0a0a0c">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Sift">
<meta property="og:title" content="Sift — ${formattedDate}">
<meta property="og:description" content="${metaDescription}">
${canonicalUrl ? `<meta property="og:url" content="${canonicalUrl}">
` : ''}<meta name="twitter:card" content="summary">
${canonicalUrl ? `<link rel="canonical" href="${canonicalUrl}">
` : ''}<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<title>Sift — ${DATE}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
${css}
</style>
</head>
<body>

${body}

<script>
document.querySelectorAll('.youtube-published[datetime]').forEach(el => {
  const attr = el.getAttribute('datetime');
  const dateOnly = attr.length <= 10;
  const d = new Date(dateOnly ? attr + 'T12:00:00' : attr);
  if (isNaN(d)) return;
  const mon = d.toLocaleString(undefined, { month: 'short' });
  const day = d.getDate();
  if (dateOnly) { el.textContent = mon + ' ' + day; return; }
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  el.textContent = mon + ' ' + day + ', ' + h + ':' + String(m).padStart(2, '0') + ' ' + ap;
});
</script>
</body>
</html>`;

const readingStats = readingStatsFromHtml(finalHtml);
finalHtml = finalHtml.replaceAll('__READING_MINUTES__', String(readingStats.minutes));

// Output
const outDir = path.join(OUT_SITE_DIR, 'issues', DATE);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'index.html');
fs.writeFileSync(outPath, finalHtml, 'utf8');

console.log(`✅ Digest assembled: ${outPath}`);
console.log(`   Total items: ${totalItems}`);
console.log(`   Reading time: ~${readingStats.minutes} min (${readingStats.words} words)`);
console.log(`   Active sections: ${activeSections.length}`);
console.log(`   File size: ${(finalHtml.length / 1024).toFixed(1)} KB`);
