#!/usr/bin/env node
/**
 * scripts/youtube-check.mjs
 *
 * Checks YouTube creator watchlist for videos published in the last 24 hours.
 * Loads YOUTUBE_API_KEY from .env.local automatically.
 *
 * Usage:
 *   node scripts/youtube-check.mjs                    # check all creators
 *   node scripts/youtube-check.mjs --handle @MarkKashef  # check one creator
 *   node scripts/youtube-check.mjs --json             # machine-readable output
 *
 * Sub-agents should use this script instead of calling the YouTube API directly,
 * since they cannot access .env.local environment variables.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load env
for (const envFile of [".env", ".env.local"]) {
  const envPath = path.join(ROOT, envFile);
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  }
}

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("❌ YOUTUBE_API_KEY not set in .env or .env.local");
  process.exit(1);
}

// Creator watchlist — keep in sync with instructions/research/11-youtube.md
const CREATORS = [
  { name: "Mark Kashef", handle: "@MarkKashef" },
  { name: "DIY Smart Code", handle: "@DIYSmartCode" },
  { name: "Chase AI", handle: "@ChaseAI" },
  { name: "Alex Finn", handle: "@AlexFinnAI" },
  { name: "David Ondrej", handle: "@DavidOndrej" },
  { name: "Simon Scrapes", handle: "@SimonScrapes" },
  { name: "Goda Go", handle: "@GodaGo" },
  { name: "Brian Casel", handle: "@BrianCasel" },
  { name: "Clearmud", handle: "@Clearmud" },
  { name: "Zubair Trabzada", handle: "@ZubairTrabzada" },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].replace("--", "");
      flags[key] = (args[i + 1] && !args[i + 1].startsWith("--")) ? args[i + 1] : true;
      if (flags[key] !== true) i++;
    }
  }
  return flags;
}

async function resolveChannelId(handle) {
  // Try forHandle first (YouTube API v3)
  const cleanHandle = handle.replace("@", "");
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id,snippet&forHandle=${cleanHandle}&key=${API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const snippet = data.items[0].snippet;
      return { channelId: data.items[0].id, title: snippet?.title, avatarUrl: snippet?.thumbnails?.default?.url };
    }
  } catch {}

  // Fallback: search for the channel
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(cleanHandle)}&type=channel&maxResults=1&key=${API_KEY}`;
  try {
    const res = await fetch(searchUrl);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      return { channelId: data.items[0].snippet?.channelId, title: data.items[0].snippet?.title };
    }
  } catch {}

  return null;
}

async function getRecentVideos(channelId, hoursAgo = 24) {
  const publishedAfter = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=5&publishedAfter=${publishedAfter}&type=video&key=${API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(`YouTube API error: ${data.error.message}`);
  }

  if (!data.items || data.items.length === 0) return [];

  // Get video details (duration, view count)
  const videoIds = data.items.map(i => i.id.videoId).join(",");
  const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${API_KEY}`;
  const detailsRes = await fetch(detailsUrl);
  const detailsData = await detailsRes.json();

  const detailsMap = {};
  for (const v of (detailsData.items || [])) {
    detailsMap[v.id] = {
      duration: v.contentDetails?.duration,
      viewCount: parseInt(v.statistics?.viewCount || "0"),
    };
  }

  return data.items.map(item => {
    const videoId = item.id.videoId;
    const details = detailsMap[videoId] || {};
    return {
      videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      description: item.snippet.description?.slice(0, 200),
      duration: details.duration || null,
      viewCount: details.viewCount || 0,
    };
  });
}

function formatDuration(iso) {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;
  const h = parseInt(match[1] || "0");
  const m = parseInt(match[2] || "0");
  const s = parseInt(match[3] || "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function main() {
  const flags = parseArgs();
  const jsonOutput = flags.json === true;
  const singleHandle = flags.handle;
  const hoursLookback = flags.hours ? parseInt(flags.hours, 10) : 24;

  const creators = singleHandle
    ? CREATORS.filter(c => c.handle === singleHandle || c.handle === `@${singleHandle}`)
    : CREATORS;

  if (creators.length === 0) {
    console.error(`No creator found matching ${singleHandle}`);
    process.exit(1);
  }

  const allVideos = [];
  const errors = [];

  for (const creator of creators) {
    try {
      const resolved = await resolveChannelId(creator.handle);
      if (!resolved) {
        errors.push({ creator: creator.name, error: "Could not resolve channel ID" });
        if (!jsonOutput) console.log(`  ⚠️  ${creator.name} (${creator.handle}) — could not resolve channel ID`);
        continue;
      }

      const videos = await getRecentVideos(resolved.channelId, hoursLookback);

      if (videos.length === 0) {
        if (!jsonOutput) console.log(`  ○  ${creator.name} (${creator.handle}) — no videos in last 24h`);
      } else {
        for (const v of videos) {
          // Skip shorts (< 60 seconds)
          if (v.duration) {
            const match = v.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            const totalSec = (parseInt(match?.[1] || "0") * 3600) + (parseInt(match?.[2] || "0") * 60) + parseInt(match?.[3] || "0");
            if (totalSec < 60) continue;
          }

          allVideos.push({
            ...v,
            creatorName: creator.name,
            creatorHandle: creator.handle,
            creatorAvatarUrl: resolved.avatarUrl || null,
            formattedDuration: formatDuration(v.duration),
          });

          if (!jsonOutput) {
            console.log(`  ✅ ${creator.name}: "${v.title}" (${formatDuration(v.duration) || "?"}) — ${v.videoUrl}`);
          }
        }
      }
    } catch (e) {
      errors.push({ creator: creator.name, error: e.message });
      if (!jsonOutput) console.log(`  ❌ ${creator.name} — ${e.message}`);
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ videos: allVideos, errors, checkedAt: new Date().toISOString() }, null, 2));
  } else {
    console.log(`\n${allVideos.length} videos found from ${creators.length} creators`);
    if (errors.length) console.log(`${errors.length} errors`);
  }
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });
