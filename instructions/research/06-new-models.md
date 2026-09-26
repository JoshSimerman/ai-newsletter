# Section 06: New Models & Benchmarks — Research

> **Phase:** Research
> **Timing:** Every digest (daily)

---

## Purpose

Track new AI model releases, benchmark results, distillations, and significant research papers. Covers the full landscape: frontier labs (Google, Meta, Alibaba, Mistral, Cohere, etc.), open-source community models, and academic research.

## Deduplication Check

Follow the dedup + persistence workflow in `RESEARCH_BRIEF.md`: write all candidates to `tmp/06-new-models-research.json`, run one `check-batch`, drop/justify DUPEs, then `save-research` + `record-batch`.

## Data Sources

| Source | Method | What to Pull |
|--------|--------|-------------|
| HuggingFace Blog | `web_search "huggingface.co/blog {this week}"` | New model releases, datasets |
| HuggingFace Trending | `web_search "huggingface trending model {today}"` | Community models gaining traction |
| r/LocalLLaMA | `web_fetch https://www.reddit.com/r/LocalLLaMA/hot.json?limit=30` | Model releases, benchmarks, comparisons |
| r/MachineLearning | `web_fetch https://www.reddit.com/r/MachineLearning/hot.json?limit=20` | Research papers, SOTA results |
| arXiv cs.AI | `web_search "arxiv.org cs.AI {today}" notable OR breakthrough` | Important papers |
| Papers With Code | `web_search "paperswithcode.com SOTA {this week}"` | New state-of-the-art results |
| Google AI Blog | `web_search "blog.google AI {today}"` OR `"ai.google/research {this week}"` | Gemini 3.1+ updates, new Gemini models |
| Meta AI | `web_search "ai.meta.com blog {this week}"` | Llama 4 Behemoth, Llama 5, research |
| Mistral | `web_search "mistral.ai news {this week}"` | Mistral Large/Small updates, Voxtral, Forge |
| Alibaba/Qwen | `web_search "qwenlm OR Qwen new model {this week}"` | Qwen 3.5+ / Qwen 4 updates |
| DeepSeek | `web_search "deepseek new model OR V4 {this week}"` | DeepSeek V4 launch, R1 updates |
| Cohere | `web_search "cohere.com blog {this week}"` | Command models |
| xAI/Grok | `web_search "xAI Grok new {this week}"` | Grok 4.20 updates, Grok 5 launch |
| MiniMax | `web_search "minimax AI model OR M2.7 OR M3 {this week}"` | MiniMax M2.7+, self-evolving models |
| Moonshot/Kimi | `web_search "moonshot AI OR kimi K2.5 OR K3 {this week}"` | Kimi K2.5+ updates, Cursor-Kimi news |
| Xiaomi/MiMo | `web_search "xiaomi MiMo AI model {this week}"` | MiMo-V2-Pro, MiMo-V3 |
| 01.AI/Yi | `web_search "01.AI Yi model new {this week}"` | Yi model family |

## What to Include

- **New model releases** — name, parameter count, key capabilities, where to access
- **Benchmark results** — MMLU, HumanEval, MATH, Arena Elo, etc. Only if they represent a meaningful change
- **Distillations/quantizations** — smaller versions of frontier models that can run on consumer hardware
- **Significant papers** — papers that introduce new techniques or architectures (not incremental improvements)
- **Model availability changes** — models becoming open-source, changing licenses, new API access

## What to Exclude

- Minor benchmark improvements (< 2% on established benchmarks)
- Papers that are purely theoretical with no practical implementation
- Model "vibes" posts without concrete data
- Duplicate coverage of models already tracked in Claude/OpenAI sections

## Priority Watchlist (Always Check)

### Current frontier (as of March 2026) — watch for updates/successors:
- `Llama 4 Behemoth` — Meta's 288B-active MoE, still training. Also watch for Llama 5
- `Gemini 3.5` / `Gemini 4` — Google's next after Gemini 3.1 Pro/Flash-Lite
- `Qwen 4` — Alibaba's next after Qwen 3.5 (397B, 201 languages)
- `Mistral Large 4` — Mistral's next after Large 3 (675B MoE). Also track Mistral Small updates and Voxtral
- `DeepSeek V4` — repeatedly delayed, still unreleased. Current: V3-0324 + R1
- `MiniMax M3` — next after M2.7 (self-evolving, March 2026). M2.7 scored 56.2% SWE-Pro
- `Kimi K3` — Moonshot's next after K2.5 (1T MoE, Jan 2026). Note: Cursor's coding model is built on Kimi
- `Grok 5` — xAI training 6T-parameter model. Current: Grok 4.20 (March 2026, 2M context)
- `MiMo V3` / `Xiaomi AI` — next after MiMo-V2-Pro (Hunter Alpha, 1T+ MoE)

### Always watch for:
- Any model claiming #1 on Chatbot Arena
- Any open model that matches/beats GPT-5 class models
- Any new frontier model from Chinese labs (Baichuan, StepFun, Zhipu/GLM)
- New modalities: speech (Voxtral TTS), video, multimodal reasoning

## Output JSON

Same schema as RESEARCH_BRIEF.md. Additional `details` field for models:

```json
{
  "details": {
    "parameter_count": "235B (MoE, 22B active)",
    "license": "Apache 2.0",
    "benchmarks": {
      "MMLU": 89.2,
      "HumanEval": 85.1
    },
    "availability": "HuggingFace, Ollama",
    "hardware_requirements": "Runs on RTX 4090 with 4-bit quantization"
  }
}
```
