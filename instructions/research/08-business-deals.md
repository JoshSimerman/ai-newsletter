# Section 08: Business & Funding — Research

> **Phase:** Research
> **Timing:** Every digest (daily)

---

## Purpose

Track AI industry business activity — funding rounds, acquisitions, partnerships, IPO activity, layoffs, leadership changes, and market-moving developments.

## Deduplication Check

Follow the dedup + persistence workflow in `RESEARCH_BRIEF.md`: write all candidates to `tmp/08-business-deals-research.json`, run one `check-batch`, drop/justify DUPEs, then `save-research` + `record-batch`.

## Data Sources

| Source | Method | What to Pull |
|--------|--------|-------------|
| TechCrunch AI | `web_search "techcrunch AI funding OR acquisition {today}"` | Funding rounds, M&A |
| Crunchbase News | `web_search "crunchbase.com/discover/funding AI {this week}"` | Funding data |
| The Information | `web_search "theinformation.com AI {today}"` | Scoops, deals |
| Bloomberg | `web_search "bloomberg AI startup funding {today}"` | Market analysis |
| Reuters Tech | `web_search "reuters technology AI {today}"` | Business news |
| VentureBeat | `web_search "venturebeat.com AI {today}"` | Industry moves |
| Axios | `web_search "axios.com AI deal OR funding {today}"` | Quick-hit deal coverage |
| Semafor | `web_search "semafor.com AI {today}"` | Business analysis |

## What to Include

- **Funding rounds** — Series A+ for AI companies. Include: company name, amount, valuation (if known), lead investors, what the company does
- **Acquisitions** — AI company M&A. Include: acquirer, target, price (if known), strategic rationale
- **Partnerships** — Major strategic partnerships (e.g., Microsoft + Anthropic scale)
- **IPO activity** — filings, pricing, first-day performance for AI companies
- **Leadership changes** — CEO/CTO changes at notable AI companies
- **Layoffs/restructuring** — significant headcount changes at AI companies
- **Earnings/revenue** — notable AI revenue data (e.g., OpenAI ARR milestones)

## What to Exclude

- Seed/pre-seed rounds (too early-stage unless the company is notable)
- Non-AI tech funding (even if the company uses some AI)
- General tech industry news that isn't specifically AI-focused
- Stock market movements for AI-adjacent companies unless dramatic (>10% move)

## Priority: Include Dollar Amounts

For funding rounds, always try to include:
- Round size (e.g., "$450M Series B")
- Valuation (e.g., "at a $5.8B valuation")
- Lead investor(s)
- What the company does in one sentence

## Output JSON

Same schema as RESEARCH_BRIEF.md. Additional `details` field:

```json
{
  "details": {
    "deal_type": "Series B",
    "amount": "$450M",
    "valuation": "$5.8B",
    "lead_investors": ["Andreessen Horowitz", "Lightspeed"],
    "company_description": "Enterprise AI agent platform for customer service"
  }
}
```
