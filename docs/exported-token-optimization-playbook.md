# Token Optimization Playbook for Claude Code Pipelines

*A reusable guide for optimizing multi-agent Claude Code pipelines. Extracted from a production AI newsletter system.*

---

## When to Use This

You have a Claude Code pipeline that:
- Spawns multiple sub-agents (5+)
- Each agent reads shared instruction files
- Consumes more context/tokens than you'd like
- Runs autonomously (scheduled or triggered)

---

## The Problem

Multi-agent pipelines have a hidden tax: **instruction overhead**.

Every sub-agent independently reads:
- Shared instruction files
- Per-section/task config files
- Context files (templates, schemas)

With 10 agents each reading 15KB of instructions = 150KB+ just for instructions, before any actual work.

---

## Key Finding: Context Accumulation Risk

**Subagents cannot clear context mid-task.** Each runs in its own context window until completion.

**Why single-agent-per-phase is risky for multi-task work:**
- Agent processes task 1, 2, 3... by task 7-8, context is full of prior outputs
- Hallucination risk increases as context fills with similar content
- Cross-contamination between tasks becomes likely

**The benefit of multiple agents:**
- Each sub-agent has fresh context
- Only carries what's needed for its task(s)
- No cross-contamination

---

## The Optimization Strategy

### Three-Pronged Approach

| Optimization | Savings | Risk |
|-------------|---------|------|
| Batch 2 tasks per agent (halve agent count) | ~40-50% instruction overhead | Low |
| Use cheaper model for simpler tasks | ~40-60% per-token | Low |
| Compress instructions | ~30-40% per instruction read | Low |

**Combined expected savings: 60-75%**

---

## Implementation Guide

### 1. Task Batching

**Before:** 10 agents (1 task each)
**After:** 5 agents (2 tasks each)

#### Batch Assignment Rules

1. **Fixed, deterministic assignments** - no dynamic allocation
2. **Group related tasks** - reduces context confusion
3. **Sequential processing within batch** - complete task A before task B
4. **Equal distribution** - each agent handles same number of tasks

#### Example Groupings (adapt to your domain)

```
Agent 1: [task_a, task_b]  // Related category A
Agent 2: [task_c, task_d]  // Related category B
Agent 3: [task_e, task_f]  // Related category C
```

#### Prompt Template

```
You are processing tasks for [pipeline name].

Process these tasks IN ORDER:
1. {task_a} - Read instructions/{task_a}.md, execute, save output
2. {task_b} - Read instructions/{task_b}.md, execute, save output

For EACH task:
- Read task-specific instructions
- Execute the task
- Save output to tmp/{task}-output.json
- Log completion to tmp/pipeline-log.md

Complete task 1 FULLY before starting task 2.
```

### 2. Model Selection

Use the cheaper model for tasks that are:
- Search and extract (not synthesis)
- Following explicit instructions
- Producing structured output (JSON)

Use the more capable model for:
- Synthesis and summarization
- Creative/nuanced writing
- Final assembly and quality control

```javascript
// Example dispatch with model selection
Task({
  prompt: "...",
  subagent_type: "general-purpose",
  model: "sonnet"  // or "haiku" for simpler tasks
})
```

### 3. Instruction Compression

Create production-mode instruction files.

#### Remove
- Explanatory "why" paragraphs
- Redundant examples (one per concept is enough)
- Multi-paragraph prose that can be bullets
- Lengthy descriptions already shown in examples

#### Keep (100% fidelity)
- All rules and constraints
- Schema definitions with required fields
- Error handling instructions
- One concrete example per concept
- All field names and types

#### Compression Example

**Before (~150 tokens):**
```markdown
### Publication Date Rules (CRITICAL)

> **Every article MUST have an accurate publication date.** This is non-negotiable.

When researching articles, you need to find the actual publication date. This is
important because we want to ensure freshness and accuracy. Look for meta tags
and visible date indicators. The date format should be YYYY-MM-DD.
```

**After (~50 tokens, same rules):**
```markdown
### Publication Dates (REQUIRED)

- Every item MUST have `published_date` (YYYY-MM-DD)
- Find via: meta tags, `<time datetime>`, JSON-LD
- No date found = reject item
- Never fabricate dates
```

#### Target Compression Ratios

| Content Type | Target | Method |
|--------------|--------|--------|
| Main instructions | 40-50% of original | Cut explanatory prose |
| Per-task configs | 50-60% of original | One example per concept |
| Policy/style guides | 50% of original | Bullet points only |

---

## Architecture Before/After

### Before

```
Orchestrator
├── Phase 1: N parallel agents (expensive model)
│   └── Each reads: full instructions (~15KB each)
├── Phase 2: M parallel agents (expensive model)
│   └── Each reads: full instructions (~6KB each)
└── Final: 1 agent (expensive model)
```

### After

```
Orchestrator
├── Phase 1: N/2 parallel agents (cheaper model)
│   └── Each reads: compressed instructions (~8KB each)
│   └── Each processes 2 tasks sequentially
├── Phase 2: M/2 parallel agents (expensive model)
│   └── Each reads: compressed instructions (~4KB each)
└── Final: 1 agent (expensive model)
```

---

## Timing Adjustments

Batched agents need more time. Adjust timeouts:

| Agent Type | Original Timeout | Batched Timeout |
|------------|-----------------|-----------------|
| Single-task | 5 min | N/A |
| Two-task batch | N/A | 8 min |

Adjust pipeline budget accordingly:
- Original: 20 min hard cap
- Batched: 45 min hard cap (allows for sequential processing)

---

## Validation Changes

With batched agents, validation needs adjustment:

**Before:** Expect N log entries (one per agent)
**After:** Expect N log entries (each batched agent logs per-task)

A missing batched agent = 2 missing log entries. Detect this pattern.

---

## Rollback Plan

If quality degrades:

1. **First:** Reduce batch size from 2 to 1 for problem areas
2. **Second:** Revert to expensive model for specific task types
3. **Third:** Revert instruction compression if rules were lost

Keep original instruction files as backups (e.g., `*_FULL.md`).

---

## Checklist

### Phase 1: Instruction Compression
- [ ] Create compressed main instruction file
- [ ] Create compressed per-task instruction variants
- [ ] Verify all rules preserved (diff check against originals)

### Phase 2: Update Pipeline Config
- [ ] Change from N agents to N/2
- [ ] Define fixed batch assignments
- [ ] Add model selection for different phases
- [ ] Update timeouts (single vs batched)
- [ ] Update pipeline budget

### Phase 3: Test Run
- [ ] Run pipeline with new architecture
- [ ] Compare token usage vs baseline
- [ ] Verify output quality
- [ ] Check for cross-task contamination

### Phase 4: Measure & Iterate
- [ ] If still over budget, apply additional compression
- [ ] If quality issues, reduce batch size for problem areas
- [ ] Document final architecture

---

## Constraints to Remember

| Constraint | Recommendation |
|------------|----------------|
| Max tasks per agent | 2 (preserves context isolation) |
| Instructions per task | 1 compressed file + 1 task config |
| Expensive model usage | Synthesis, writing, final assembly |
| Cheap model usage | Search, extract, structured output |
| Instruction fidelity | 100% rules, 0% fluff |

---

*This playbook was extracted from a production system that achieved 60-75% token reduction while maintaining output quality.*
