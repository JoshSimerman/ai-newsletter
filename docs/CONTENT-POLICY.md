# Sift — Content Policy & Editorial Voice

> **Purpose:** Defines how content is written, rewritten, and presented across every section. This is the editorial DNA of Sift — every research agent and design agent must follow these rules.

---

## The Sift Voice

Sift is **Techmeme's clarity meets a well-edited morning briefing.** Every word earns its place. The reader should be able to scan the entire digest in 3 minutes and know exactly what happened in AI today — without clicking a single link unless they want depth.

### Core Principles

1. **Strip the clickbait.** Source headlines are marketing. Rewrite every headline to state what actually happened. No questions, no hype, no "just," no "finally," no exclamation marks.

2. **Lead with the fact.** The first sentence of every summary is the news. Not background, not context, not "In a move that..." — the thing that happened.

3. **One story, one point.** Each item communicates exactly one development. If a story has two newsworthy things, it's two items.

4. **Specifics over adjectives.** "Qwen3-235B scores 89.2 on MMLU" not "Alibaba releases impressive new model." Numbers, versions, dates, names — these are what matter.

5. **No editorializing in news items.** Save opinion for the executive summary (where light synthesis is appropriate). Individual items are factual reports.

6. **Respect the reader's intelligence.** Don't explain what an LLM is. Don't explain what open source means. The reader is a software engineer who works with AI daily.

---

## Headline Rewriting Rules

Every headline in the digest is **rewritten by Claude** — never copied verbatim from the source. The goal is maximum information density in minimum words.

### Examples

| Source Headline (bad) | Sift Headline (good) |
|----------------------|----------------------|
| "We're excited to announce the latest update to Claude Code!" | Claude Code 1.0.22 adds MCP auto-discovery |
| "OpenAI Just Made a HUGE Change to ChatGPT That Changes Everything" | ChatGPT adds persistent memory across conversations |
| "You Won't Believe How Fast This New AI Model Is" | DeepSeek V4 hits 150 tokens/sec on consumer GPUs |
| "The Future of AI Coding is Here" | Cursor 0.46 ships multi-file edit with preview diff |
| "Breaking: Major AI Company Raises Massive Round" | Mistral closes $450M Series B at $5.8B valuation |
| "This Open Source Project is Taking the AI World by Storm" | browser-use hits 5K GitHub stars in 48 hours — browser automation via LLM agents |
| "Exciting news for developers!" | Anthropic API adds streaming tool use for all models |

### Headline Formula

**[Subject] [verb] [specific detail]**

- Start with the thing (product, company, model, tool)
- Use active present tense ("adds," "ships," "closes," "scores," "launches")
- End with the specific detail that makes this newsworthy
- Target: 8-15 words. Never exceed 20.

### Words to Never Use in Headlines

`just`, `finally`, `exciting`, `huge`, `massive`, `incredible`, `amazing`, `game-changing`, `groundbreaking`, `revolutionary`, `breaking`, `you won't believe`, `everything you need to know`, `here's why`, `this is why`, `the future of`, `is here`

---

## Summary Writing Rules

Each item gets a 1-3 sentence summary written by Claude. This is not a copy of the source's description — it's a distilled, rewritten explanation of what matters.

### Summary Formula

**Sentence 1:** What happened. (The news.)
**Sentence 2:** Why it matters or what's different. (The significance.)
**Sentence 3 (optional):** A concrete detail — numbers, availability, timeline.

### Examples

**Bad (copied from source):**
> "We're thrilled to share that we've been working hard on bringing you the best possible experience with our latest model update. After months of research and development, our team has created something truly special that we think you'll love."

**Good (Sift rewrite):**
> Anthropic releases Claude Sonnet 4.5 with 40% faster response times and improved code generation accuracy. Available now on the API at the same price as Sonnet 4. Early benchmarks show a 12-point jump on SWE-bench.

**Bad (vague):**
> "A new AI coding tool launched today with some interesting features."

**Good (specific):**
> Aider 0.82 adds support for Claude's extended thinking mode, letting it reason through complex refactors before generating code. Compatible with any model that supports the thinking API.

### Summary Rules

1. **Never start with "In a move that..."** or "In what appears to be..." or "According to sources..."
2. **Never use the phrase "it remains to be seen"**
3. **Include version numbers** when relevant (v1.0.22, not "the latest version")
4. **Include dollar amounts** for funding (not "a significant round")
5. **Include benchmark numbers** for model releases (not "impressive results")
6. **Include availability** — where can someone use/get this? (API, HuggingFace, npm, etc.)
7. **Use present tense** for today's developments
8. **No self-referential language** — never "we," never "our readers," never "as we reported"

---

## Formatting for Scannability

Sift is not a wall of text. Every piece of content is styled for fast scanning. The reader should be able to glance at an item and absorb the key facts in seconds.

### Bullet Points Are Your Friend

When a story has multiple distinct details — features in a release, terms of a deal, benchmark results — **use bullet points** instead of cramming everything into a dense paragraph. This is the single biggest readability improvement over Techmeme-style aggregators.

**Bad (wall of text):**
> Claude Code 1.0.22 adds MCP auto-discovery, which reads .mcp.json files at the project root and connects to defined servers on startup. It also includes a new /compact command for context management and fixes a bug where file edits in monorepos would target the wrong workspace.

**Good (scannable):**
> Claude Code 1.0.22 ships three notable changes:
> - **MCP auto-discovery** — reads .mcp.json at project root, connects to servers on startup
> - **`/compact` command** — new context management for long sessions
> - **Monorepo fix** — file edits now correctly target the active workspace

### When to Use Bullets

- **Release notes** with 3+ features → always bullets
- **Funding rounds** with multiple data points → bullets for amount, valuation, investors, use of funds
- **Model releases** with specs → bullets for parameters, benchmarks, hardware requirements, availability
- **Comparison items** — when noting what's different from a predecessor

### When NOT to Use Bullets

- **Single-fact stories** — one sentence is fine, no need to bulletize
- **Executive summary** — this section flows as prose paragraphs, not bullets
- **Context/background** — explanatory text reads better as sentences

### Bullet Style Rules

- **Bold the key term** at the start of each bullet, then explain after an em dash
- Keep each bullet to one line when possible (two max)
- Use `—` (em dash) not `-` (hyphen) as the separator after the bold term
- 3-5 bullets per item is ideal. More than 7 means you should split into multiple items
- No period at the end of bullets unless they're full sentences

---

## Section-Specific Voice

### Executive Summary
- **Slightly warmer** than individual items — this is the one place where light synthesis and connecting threads is appropriate
- Still factual, still concise, but can note patterns ("Heavy day for developer tooling" or "Three model releases in 24 hours, all targeting the local inference market")
- Can note when something is quiet ("No major OpenAI news today")

### Top Stories
- **Most neutral, most concise** — wire-service tone
- Just the facts, no interpretation

### Claude & Anthropic / OpenAI
- **Precise product language** — use the exact feature names, version numbers, API endpoint names
- Link to the official source (blog post, changelog, release notes)

### New Models & Benchmarks
- **Data-forward** — parameter counts, benchmark scores, hardware requirements
- Note the practical implication: "Runs on a single RTX 4090" is more useful than "efficient"

### Local AI
- **Practical tone** — what can you do with this today, on what hardware?
- Community-aware — reference r/LocalLLaMA consensus where relevant

### Business & Funding
- **Bloomberg tone** — dollars, valuations, investors, strategic rationale
- One sentence on what the company does if it's not well-known

### Developer Tools
- **Show, don't tell** — what does this tool do, specifically?
- Include the install/access method when relevant (npm, pip, VS Code marketplace)

### Open Source
- **GitHub-native language** — stars, language, license
- Focus on what problem it solves

### YouTube
- **Minimal** — channel name, title (rewritten if clickbait), duration
- Let the thumbnail and title do the work

---

## Formatting Standards

### Dates
- In metadata: `Mar 25, 2026` (short)
- In executive summary prose: `March 25` (natural)
- In machine-readable attributes: `2026-03-25` (ISO)

### Numbers
- Use K/M/B for large numbers: `$450M`, `235B parameters`, `5K stars`
- Use exact numbers when small and meaningful: `12-point improvement`, `3 new endpoints`

### Source Attribution
- Always present, always linked
- Format: source name as text, linked to the specific article
- Never "via" — just the source name

### Links
- Every headline links to the original source
- Links open in new tab (`target="_blank"`)
- No tracking parameters — clean URLs only
