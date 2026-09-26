#!/usr/bin/env node
/**
 * scripts/mcp-server.mjs
 *
 * MCP (Model Context Protocol) server that exposes Sift's D1 operations
 * as typed tools for Claude Code sub-agents.
 *
 * Instead of: node scripts/d1-save.mjs check-url --url "https://..."
 * Agents call: sift_check_url({ url: "https://..." })
 *
 * Setup: Add to .claude/settings.local.json:
 *   "mcpServers": {
 *     "sift": {
 *       "command": "node",
 *       "args": ["scripts/mcp-server.mjs"],
 *       "cwd": "<project-root>"
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── Load environment ───
for (const envFile of [".env", ".env.local"]) {
  const envPath = path.join(ROOT, envFile);
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").replace(/\r/g, "").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  }
}

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const API_TOKEN = process.env.CF_API_TOKEN;
const DATABASE_ID = process.env.CF_D1_DATABASE_ID;
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}`;

// ─── D1 query helper ───
async function query(sql, params = []) {
  const res = await fetch(`${BASE_URL}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const data = await res.json();
  if (!data.success) {
    const errors = data.errors?.map((e) => e.message).join(", ");
    throw new Error(`D1 error: ${errors}`);
  }
  return data.result?.[0] || { results: [] };
}

async function getEditionId(date) {
  const result = await query("SELECT id FROM editions WHERE edition_date = ?", [date]);
  return result.results.length > 0 ? result.results[0].id : null;
}

// ─── Tool definitions ───
const TOOLS = [
  {
    name: "sift_check_url",
    description: "Check if a URL has appeared in Sift within the last 7 days (deduplication)",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to check" },
      },
      required: ["url"],
    },
  },
  {
    name: "sift_check_fuzzy",
    description: "Fuzzy title match against recent Sift content (entity-weighted similarity). Returns matches above threshold.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title to check for similarity" },
        threshold: { type: "number", description: "Minimum similarity score (default: 0.4)" },
      },
      required: ["title"],
    },
  },
  {
    name: "sift_check_id",
    description: "Check if a content ID (slug) has appeared in Sift within the last 7 days",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Content type (e.g., story, video, repo)" },
        id: { type: "string", description: "Content ID / slug" },
      },
      required: ["type", "id"],
    },
  },
  {
    name: "sift_record",
    description: "Record a content item in the dedup index after including it in a digest",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Edition date (YYYY-MM-DD)" },
        section: { type: "string", description: "Section key (e.g., 04-claude-anthropic)" },
        type: { type: "string", description: "Content type (story, video, repo, etc.)" },
        id: { type: "string", description: "Content ID / slug" },
        title: { type: "string", description: "Item title" },
        url: { type: "string", description: "Source URL" },
        source: { type: "string", description: "Source name" },
        tier: { type: "number", description: "Source tier 1-4 (1=authoritative, 4=blog)" },
      },
      required: ["date", "section", "type", "id"],
    },
  },
  {
    name: "sift_save_research",
    description: "Save research JSON data for a section to D1",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Edition date (YYYY-MM-DD)" },
        section: { type: "string", description: "Section key" },
        data: { type: "string", description: "Research JSON as string" },
      },
      required: ["date", "section", "data"],
    },
  },
  {
    name: "sift_save_design",
    description: "Save designed HTML fragment for a section to D1",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Edition date (YYYY-MM-DD)" },
        section: { type: "string", description: "Section key" },
        html: { type: "string", description: "HTML fragment" },
      },
      required: ["date", "section", "html"],
    },
  },
  {
    name: "sift_read_research",
    description: "Read research JSON for a section from D1",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Edition date (YYYY-MM-DD)" },
        section: { type: "string", description: "Section key" },
      },
      required: ["date", "section"],
    },
  },
  {
    name: "sift_status",
    description: "Get edition status showing section completion, timing, and token usage",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Edition date (YYYY-MM-DD). Omit for all editions overview." },
      },
    },
  },
  {
    name: "sift_create_edition",
    description: "Create a new edition record with all section placeholders",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Edition date (YYYY-MM-DD)" },
      },
      required: ["date"],
    },
  },
  {
    name: "sift_start_timer",
    description: "Record the pipeline start time for an edition",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Edition date (YYYY-MM-DD)" },
      },
      required: ["date"],
    },
  },
  {
    name: "sift_save_metrics",
    description: "Record pipeline completion time and optional token count",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Edition date (YYYY-MM-DD)" },
        tokens: { type: "number", description: "Total tokens used (optional)" },
      },
      required: ["date"],
    },
  },
  {
    name: "sift_finalize",
    description: "Mark an edition as published",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Edition date (YYYY-MM-DD)" },
      },
      required: ["date"],
    },
  },
  {
    name: "sift_list",
    description: "List recent content index entries with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter by content type" },
        section: { type: "string", description: "Filter by section key" },
        last: { type: "number", description: "Number of items to return (default: 50)" },
      },
    },
  },
];

// ─── Tool handlers ───
async function handleTool(name, args) {
  switch (name) {
    case "sift_check_url": {
      const result = await query(
        `SELECT ci.content_id, ci.title, e.edition_date, ci.section_key
         FROM content_index ci JOIN editions e ON ci.edition_id = e.id
         WHERE ci.url = ? AND ci.created_at > datetime('now', '-7 days')
         ORDER BY ci.created_at DESC LIMIT 5`,
        [args.url]
      );
      if (result.results.length === 0) {
        return { seen: false, message: "URL not seen in last 7 days" };
      }
      return {
        seen: true,
        matches: result.results.map((r) => ({
          date: r.edition_date,
          section: r.section_key,
          title: r.title,
        })),
      };
    }

    case "sift_check_fuzzy": {
      const { compositeScore, loadEntities, formatFuzzyResults } = await import("./shared/fuzzy.mjs");
      const entities = loadEntities();
      const minScore = args.threshold || 0.4;

      const result = await query(
        `SELECT ci.title, ci.source_tier, ci.section_key, e.edition_date
         FROM content_index ci JOIN editions e ON ci.edition_id = e.id
         WHERE ci.title IS NOT NULL AND ci.created_at > datetime('now', '-7 days')
         ORDER BY ci.created_at DESC`
      );

      const matches = [];
      for (const row of result.results) {
        if (!row.title) continue;
        const score = compositeScore(args.title, row.title, entities);
        if (score.total >= minScore) {
          matches.push({
            title: row.title,
            date: row.edition_date,
            section: row.section_key,
            tier: row.source_tier || 3,
            score: score.total,
          });
        }
      }
      matches.sort((a, b) => b.score - a.score);

      return {
        query: args.title,
        threshold: minScore,
        match_count: matches.length,
        matches: matches.slice(0, 10),
      };
    }

    case "sift_check_id": {
      const result = await query(
        `SELECT ci.content_id, ci.title, e.edition_date, ci.section_key
         FROM content_index ci JOIN editions e ON ci.edition_id = e.id
         WHERE ci.content_type = ? AND ci.content_id = ?
           AND ci.created_at > datetime('now', '-7 days')
         ORDER BY ci.created_at DESC LIMIT 5`,
        [args.type, args.id]
      );
      if (result.results.length === 0) {
        return { seen: false, message: `${args.type}/${args.id} not seen in last 7 days` };
      }
      return {
        seen: true,
        matches: result.results.map((r) => ({
          date: r.edition_date,
          section: r.section_key,
          title: r.title,
        })),
      };
    }

    case "sift_record": {
      const editionId = await getEditionId(args.date);
      if (!editionId) throw new Error(`Edition ${args.date} not found`);

      await query(
        `INSERT INTO content_index (edition_id, section_key, content_type, content_id, title, url, source, source_tier)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [editionId, args.section, args.type, args.id, args.title || null, args.url || null, args.source || null, args.tier || 3]
      );
      return { recorded: true, id: args.id, section: args.section };
    }

    case "sift_save_research": {
      const editionId = await getEditionId(args.date);
      if (!editionId) throw new Error(`Edition ${args.date} not found`);

      const sectionResult = await query(
        "SELECT id FROM sections WHERE edition_id = ? AND section_key = ?",
        [editionId, args.section]
      );
      if (sectionResult.results.length === 0) throw new Error(`Section ${args.section} not found`);

      await query(
        "UPDATE sections SET research_data = ?, status = 'researched' WHERE id = ?",
        [args.data, sectionResult.results[0].id]
      );

      const parsed = JSON.parse(args.data);
      return { saved: true, section: args.section, items: parsed.item_count || parsed.items?.length || 0 };
    }

    case "sift_save_design": {
      const editionId = await getEditionId(args.date);
      if (!editionId) throw new Error(`Edition ${args.date} not found`);

      const sectionResult = await query(
        "SELECT id FROM sections WHERE edition_id = ? AND section_key = ?",
        [editionId, args.section]
      );
      if (sectionResult.results.length === 0) throw new Error(`Section ${args.section} not found`);

      await query(
        "UPDATE sections SET html_fragment = ?, status = 'designed' WHERE id = ?",
        [args.html, sectionResult.results[0].id]
      );
      return { saved: true, section: args.section, chars: args.html.length };
    }

    case "sift_read_research": {
      const editionId = await getEditionId(args.date);
      if (!editionId) throw new Error(`Edition ${args.date} not found`);

      const result = await query(
        "SELECT research_data FROM sections WHERE edition_id = ? AND section_key = ?",
        [editionId, args.section]
      );
      if (result.results.length === 0 || !result.results[0].research_data) {
        return { found: false, message: `No research data for ${args.section} on ${args.date}` };
      }
      return { found: true, data: JSON.parse(result.results[0].research_data) };
    }

    case "sift_status": {
      if (args.date) {
        const editionId = await getEditionId(args.date);
        if (!editionId) return { found: false, message: `No edition for ${args.date}` };

        const edition = await query("SELECT * FROM editions WHERE id = ?", [editionId]);
        const sections = await query(
          "SELECT section_key, status, LENGTH(research_data) as research_len, LENGTH(html_fragment) as html_len FROM sections WHERE edition_id = ? ORDER BY section_key",
          [editionId]
        );

        const e = edition.results[0];
        let elapsed = null;
        if (e.started_at && e.completed_at) {
          const diffMs = new Date(e.completed_at + "Z") - new Date(e.started_at + "Z");
          elapsed = `${Math.floor(diffMs / 60000)}m ${Math.floor((diffMs % 60000) / 1000)}s`;
        }

        return {
          date: e.edition_date,
          number: e.edition_number,
          status: e.status,
          elapsed,
          tokens: e.total_tokens,
          sections: sections.results.map((s) => ({
            key: s.section_key,
            status: s.status,
            research_bytes: s.research_len || 0,
            html_bytes: s.html_len || 0,
          })),
        };
      }

      const result = await query(
        "SELECT edition_date, edition_number, status, started_at, completed_at, total_tokens FROM editions ORDER BY edition_date DESC LIMIT 15"
      );
      return {
        editions: result.results.map((e) => {
          let elapsed = null;
          if (e.started_at && e.completed_at) {
            const diffMs = new Date(e.completed_at + "Z") - new Date(e.started_at + "Z");
            elapsed = `${Math.floor(diffMs / 60000)}m ${Math.floor((diffMs % 60000) / 1000)}s`;
          }
          return {
            date: e.edition_date,
            number: e.edition_number,
            status: e.status,
            elapsed,
            tokens: e.total_tokens,
          };
        }),
      };
    }

    case "sift_create_edition": {
      const existing = await getEditionId(args.date);
      if (existing) return { created: false, message: `Edition ${args.date} already exists` };

      const countResult = await query("SELECT COALESCE(MAX(edition_number), 0) as maxnum FROM editions");
      const editionNumber = (countResult.results[0]?.maxnum || 0) + 1;

      await query(
        "INSERT INTO editions (edition_date, edition_number, status) VALUES (?, ?, 'draft')",
        [args.date, editionNumber]
      );

      const editionId = await getEditionId(args.date);
      const sections = [
        "01-header", "02-executive-summary", "03-top-stories",
        "04-claude-anthropic", "05-openai", "06-new-models",
        "07-local-ai", "08-business-deals", "09-dev-tools",
        "10-open-source", "11-youtube", "12-footer", "13-openclaw",
        "14-model-leaderboard", "15-humanoid-robotics",
      ];
      for (const key of sections) {
        await query(
          "INSERT INTO sections (edition_id, section_key, status) VALUES (?, ?, 'pending')",
          [editionId, key]
        );
      }

      return { created: true, date: args.date, number: editionNumber, sections: sections.length };
    }

    case "sift_start_timer": {
      const editionId = await getEditionId(args.date);
      if (!editionId) throw new Error(`Edition ${args.date} not found`);

      await query("UPDATE editions SET started_at = datetime('now') WHERE id = ?", [editionId]);
      return { started: true, date: args.date };
    }

    case "sift_save_metrics": {
      const editionId = await getEditionId(args.date);
      if (!editionId) throw new Error(`Edition ${args.date} not found`);

      const updates = ["completed_at = datetime('now')"];
      const params = [];
      if (args.tokens) {
        updates.push("total_tokens = ?");
        params.push(args.tokens);
      }
      params.push(editionId);

      await query(`UPDATE editions SET ${updates.join(", ")} WHERE id = ?`, params);

      const edition = await query("SELECT started_at, completed_at FROM editions WHERE id = ?", [editionId]);
      const e = edition.results[0];
      let elapsed = null;
      if (e.started_at && e.completed_at) {
        const diffMs = new Date(e.completed_at + "Z") - new Date(e.started_at + "Z");
        elapsed = `${Math.floor(diffMs / 60000)}m ${Math.floor((diffMs % 60000) / 1000)}s`;
      }

      return { saved: true, date: args.date, elapsed, tokens: args.tokens || null };
    }

    case "sift_finalize": {
      const editionId = await getEditionId(args.date);
      if (!editionId) throw new Error(`Edition ${args.date} not found`);

      await query(
        "UPDATE editions SET status = 'published', published_at = datetime('now') WHERE id = ?",
        [editionId]
      );
      return { finalized: true, date: args.date };
    }

    case "sift_list": {
      const limit = args.last || 50;
      let sql = `SELECT ci.content_type, ci.content_id, ci.title, ci.url, ci.source,
                        e.edition_date, ci.section_key
                 FROM content_index ci JOIN editions e ON ci.edition_id = e.id WHERE 1=1`;
      const params = [];
      if (args.type) { sql += " AND ci.content_type = ?"; params.push(args.type); }
      if (args.section) { sql += " AND ci.section_key = ?"; params.push(args.section); }
      sql += " ORDER BY ci.created_at DESC LIMIT ?";
      params.push(limit);

      const result = await query(sql, params);
      return {
        count: result.results.length,
        items: result.results.map((r) => ({
          date: r.edition_date,
          section: r.section_key,
          type: r.content_type,
          id: r.content_id,
          title: r.title,
          url: r.url,
        })),
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Server setup ───
const server = new Server(
  { name: "sift-d1", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleTool(name, args || {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ─── Start ───
const transport = new StdioServerTransport();
await server.connect(transport);
