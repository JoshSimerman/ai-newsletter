# Section 09: Developer Tools & Infra — Research

> **Phase:** Research
> **Timing:** Every digest (daily)

---

## Purpose

Track new AI developer tools, IDE integrations, MCP servers, frameworks, SDKs, and infrastructure developments. For the reader who builds with AI tools daily.

## Deduplication Check

Follow the dedup + persistence workflow in `RESEARCH_BRIEF.md`: write all candidates to `tmp/09-dev-tools-research.json`, run one `check-batch`, drop/justify DUPEs, then `save-research` + `record-batch`.

## Data Sources

| Source | Method | What to Pull |
|--------|--------|-------------|
| GitHub Blog | `web_search "github.blog {this week}" AI OR Copilot` | Copilot updates, AI features |
| VS Code Blog | `web_search "code.visualstudio.com blog AI {this week}"` | AI extensions, updates |
| Dev.to AI tag | `web_search "dev.to AI tools {today}"` | New tool announcements |
| Product Hunt | `web_search "producthunt.com AI developer tool {today}"` | New AI product launches |
| Hacker News | HN API: `Show HN` + AI/LLM keywords | New tool launches |
| LangChain Blog | `web_search "blog.langchain.dev {this week}"` | Framework updates |
| LlamaIndex | `web_search "llamaindex.ai blog {this week}"` | Framework updates |
| Cursor | `web_search "cursor.com changelog {this week}"` | AI IDE updates |
| Windsurf/Codeium | `web_search "codeium.com blog {this week}"` | AI coding tool updates |
| Vercel AI SDK | `web_search "vercel AI SDK {this week}"` | SDK updates |
| MCP ecosystem | `web_search "MCP server new {this week}"` OR `"model context protocol {today}"` | New MCP servers, protocol updates |
| Aider | `web_search "aider.chat new {this week}"` | AI coding assistant updates |

## What to Include

- **AI coding tools** — Cursor, Windsurf, Aider, Continue, Copilot, Claude Code updates
- **Framework updates** — LangChain, LlamaIndex, Vercel AI SDK, CrewAI, AutoGen, etc.
- **MCP servers** — new servers, protocol changes, notable implementations
- **IDE extensions** — VS Code, JetBrains, Neovim AI extensions
- **Infrastructure** — vector databases, embedding services, inference platforms
- **SDKs/libraries** — new client libraries, wrappers, utilities for AI APIs
- **Notable Show HN posts** — developer tools getting traction on HN

## What to Exclude

- AI products for end-users (not developers)
- Marketing/sales AI tools (unless they have a developer API angle)
- Generic SaaS products that happen to use AI
- AI art/image generation tools (unless specifically for developers)

## Output JSON

Same schema as RESEARCH_BRIEF.md. Content types: `tool`, `release`, `announcement`, `tutorial`.
