#!/usr/bin/env node
/**
 * scripts/test-youtube-key.mjs
 *
 * Diagnoses YouTube Data API v3 key issues.
 * Tests: key validity, API enabled, quota, restrictions.
 *
 * Usage: node scripts/test-youtube-key.mjs
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

const KEY = process.env.YOUTUBE_API_KEY;

if (!KEY) {
  console.error("❌ YOUTUBE_API_KEY not set in .env or .env.local");
  process.exit(1);
}

console.log(`🔑 Testing YouTube API key: ${KEY.slice(0, 8)}...${KEY.slice(-4)}`);
console.log(`   Key length: ${KEY.length} chars`);
console.log(`   Format check: ${KEY.startsWith("AIzaSy") ? "✅ Standard Google API key format" : "⚠️  Unexpected prefix (should start with AIzaSy)"}`);
console.log();

// Test 1: videos.list (cheapest — 1 quota unit)
async function testVideosList() {
  console.log("Test 1: videos.list (1 quota unit)");
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ&key=${KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();

    if (res.ok && data.items) {
      console.log(`  ✅ PASS — API key is valid, YouTube Data API v3 is enabled`);
      console.log(`  Response: ${data.items.length} video(s) returned`);
      return true;
    } else if (data.error) {
      const err = data.error;
      console.log(`  ❌ FAIL — HTTP ${err.code}: ${err.message}`);
      diagnosisError(err);
      return false;
    }
  } catch (e) {
    console.log(`  ❌ FAIL — Network error: ${e.message}`);
    return false;
  }
}

// Test 2: search.list (100 quota units — only if test 1 fails)
async function testSearchList() {
  console.log("\nTest 2: search.list (100 quota units)");
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&type=video&key=${KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();

    if (res.ok && data.items) {
      console.log(`  ✅ PASS — Search works`);
      return true;
    } else if (data.error) {
      const err = data.error;
      console.log(`  ❌ FAIL — HTTP ${err.code}: ${err.message}`);
      diagnosisError(err);
      return false;
    }
  } catch (e) {
    console.log(`  ❌ FAIL — Network error: ${e.message}`);
    return false;
  }
}

// Test 3: Channel search (what we actually need)
async function testChannelSearch() {
  console.log("\nTest 3: Channel video search (actual use case)");
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  // Use a known active channel: @mkbhd
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=UCBJycsmduvYEL83R_U4JriQ&order=date&maxResults=3&publishedAfter=${yesterday}&type=video&key=${KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();

    if (res.ok) {
      console.log(`  ✅ PASS — Channel search works (${data.items?.length || 0} videos found in last 24h)`);
      return true;
    } else if (data.error) {
      const err = data.error;
      console.log(`  ❌ FAIL — HTTP ${err.code}: ${err.message}`);
      diagnosisError(err);
      return false;
    }
  } catch (e) {
    console.log(`  ❌ FAIL — Network error: ${e.message}`);
    return false;
  }
}

function diagnosisError(err) {
  const msg = err.message?.toLowerCase() || "";
  const reasons = err.errors?.[0]?.reason || "";

  if (msg.includes("api key not valid") || reasons === "badRequest") {
    console.log("\n  📋 Diagnosis: API key is INVALID or RESTRICTED");
    console.log("  Possible causes:");
    console.log("  1. Key has API restrictions — only allowed for specific APIs (not YouTube)");
    console.log("     → Fix: Google Cloud Console > Credentials > Edit key > API restrictions > Add 'YouTube Data API v3'");
    console.log("  2. Key has application restrictions (HTTP referrer, IP address)");
    console.log("     → Fix: Credentials > Edit key > Application restrictions > Set to 'None' or add your IP");
    console.log("  3. YouTube Data API v3 is not enabled in this Google Cloud project");
    console.log("     → Fix: APIs & Services > Library > Search 'YouTube Data API v3' > Enable");
    console.log("  4. Key was deleted or regenerated");
    console.log("     → Fix: Create a new key in Google Cloud Console");
  } else if (msg.includes("quota") || reasons === "quotaExceeded") {
    console.log("\n  📋 Diagnosis: QUOTA EXCEEDED");
    console.log("  Default YouTube quota: 10,000 units/day");
    console.log("  Each search.list call costs 100 units");
    console.log("  → Fix: Wait until midnight PT or request quota increase");
  } else if (msg.includes("has not been used") || msg.includes("not been enabled")) {
    console.log("\n  📋 Diagnosis: YouTube Data API v3 NOT ENABLED");
    console.log("  → Fix: Google Cloud Console > APIs & Services > Library > Enable 'YouTube Data API v3'");
  } else if (msg.includes("forbidden")) {
    console.log("\n  📋 Diagnosis: ACCESS FORBIDDEN");
    console.log("  The API is enabled but access is denied. Check:");
    console.log("  1. API key restrictions in Google Cloud Console");
    console.log("  2. Billing status of the Google Cloud project");
  }
}

async function main() {
  const pass1 = await testVideosList();
  if (!pass1) {
    await testSearchList();
  } else {
    await testChannelSearch();
  }

  console.log("\n" + "─".repeat(50));
  if (pass1) {
    console.log("✅ YouTube API key is working. Pipeline should use it successfully.");
  } else {
    console.log("❌ YouTube API key is NOT working. See diagnosis above for fixes.");
    console.log("   The pipeline will fall back to web search (less reliable).");
  }
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });
