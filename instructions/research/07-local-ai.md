# Section 07: Local AI & Hardware — Research

> **Phase:** Research
> **Timing:** Every digest (daily)

---

## Purpose

Track developments in running AI models locally — new tools, quantization techniques, hardware guides, Ollama/LM Studio updates, and community guides for self-hosted AI. For the reader who wants to run models on their own hardware.

## Deduplication Check

Follow the dedup + persistence workflow in `RESEARCH_BRIEF.md`: write all candidates to `tmp/07-local-ai-research.json`, run one `check-batch`, drop/justify DUPEs, then `save-research` + `record-batch`.

## Data Sources

| Source | Method | What to Pull |
|--------|--------|-------------|
| r/LocalLLaMA | `web_fetch https://www.reddit.com/r/LocalLLaMA/hot.json?limit=30` | Guides, hardware, quantization, benchmarks |
| r/SelfHosted | `web_fetch https://www.reddit.com/r/selfhosted/hot.json?limit=20` | Filter for AI/LLM posts only |
| Ollama | `web_search "ollama.com blog" OR "github.com/ollama/ollama releases {this week}"` | New model support, features |
| LM Studio | `web_search "lmstudio.ai new" OR "LM Studio update {this week}"` | Updates, new features |
| llama.cpp | `web_search "github.com/ggml-org/llama.cpp release {this week}"` | Performance improvements, new formats |
| Jan.ai | `web_search "jan.ai update {this week}"` | Updates |
| Open WebUI | `web_search "open-webui update {this week}"` | UI updates for local AI |
| llamafile | `web_search "llamafile new {this week}"` | Single-file model distribution |
| MLX (Apple) | `web_search "mlx apple silicon LLM {this week}"` | Apple Silicon ML framework |
| Hacker News | HN API filtered for: ollama, local LLM, self-hosted AI | Community discussion |

## What to Include

- **Tool releases** — new versions of Ollama, LM Studio, llama.cpp, Jan, Open WebUI, etc.
- **Quantization news** — new GGUF quants, AWQ/GPTQ developments, EXL2 updates
- **Hardware guides** — "How to run X on Y hardware" posts
- **Performance breakthroughs** — faster inference, lower VRAM requirements, new optimization techniques
- **New model availability** — models newly available in Ollama/LM Studio format
- **Community guides** — well-received tutorials for local AI setup

## What to Exclude

- "What GPU should I buy?" posts without new information
- Generic model comparison discussions
- Posts about cloud API usage (this section is specifically about local/self-hosted)

## Filter for r/SelfHosted

Only include posts from r/selfhosted that contain keywords: `LLM`, `AI`, `Ollama`, `llama`, `GPT`, `model`, `inference`, `whisper`, `stable diffusion`, `comfyui`. Skip everything else — it's a broad subreddit.

## Output JSON

Same schema as RESEARCH_BRIEF.md. Content types: `release`, `tutorial`, `tool`, `discussion`.
