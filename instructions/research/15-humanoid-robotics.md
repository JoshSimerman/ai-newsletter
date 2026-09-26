# Section 15: Humanoid Robotics — Research

> **Phase:** Research
> **Timing:** Every digest

---

## Purpose

Track progress toward lifelike, human-passing humanoid robots — the "Westworld" frontier. This section focuses exclusively on realism: realistic skin, eyes, facial expressions, biological motion, and LLM integration into humanoid bodies for natural interaction.

## Scope — What Qualifies

**Include:**
- Robots with realistic human-like appearance (silicone skin, realistic eyes, facial expressions)
- Synthetic musculoskeletal systems (artificial muscles/tendons rather than servos)
- LLM/VLA integration into humanoid bodies for natural interaction
- Advances in facial expression fidelity, gait naturalness, skin texture
- Academic breakthroughs in human-passing robotics
- Funding rounds or acquisitions for lifelike humanoid companies

**Exclude:**
- Industrial humanoids that look clearly robotic (Boston Dynamics Atlas, Figure, Tesla Optimus, Agility Digit, AgiBot)
- Drone, wheeled, or quadruped robots
- Soft robotics that isn't humanoid-shaped
- General factory automation news
- VR avatars or digital humans (must be a physical robot)

### Key Companies to Track

| Company | Robot | Focus |
|---------|-------|-------|
| Engineered Arts | Ameca | Most expressive humanoid face, 51+ facial actuators, silicone skin |
| Clone Robotics | Clone | Synthetic musculoskeletal system, artificial muscles/tendons |
| Ex-Robots | Various | Ultra-realistic silicone faces, museum-quality lifelike humanoids (China) |
| Hanson Robotics | Sophia, others | Realistic facial skin, conversational AI |
| Sanctuary AI | Phoenix | Human-like dexterity, Carbon AI control system (include when relevant to realism) |

## Deduplication Check

Follow the dedup + persistence workflow in `RESEARCH_BRIEF.md`: write all candidates to `tmp/15-humanoid-robotics-research.json`, run one `check-batch`, drop/justify DUPEs, then `save-research` + `record-batch`.

## Data Sources

| Source | Method | Priority |
|--------|--------|----------|
| humanoid.press | `web_fetch` homepage or RSS | High — dedicated aggregator |
| Humanoids Daily | `web_search "humanoids daily"` | High — daily coverage |
| The Robot Report | `web_search "humanoid robot" site:therobotreport.com` | Medium |
| IEEE Spectrum | `web_search "humanoid robot" site:spectrum.ieee.org` | Medium |
| Engineered Arts blog | `web_search "Engineered Arts Ameca"` | High — key company |
| Clone Robotics | `web_search "Clone Robotics"` | High — key company |
| Ex-Robots | `web_search "Ex-Robots humanoid"` | Medium |
| Hanson Robotics | `web_search "Hanson Robotics"` | Medium |
| r/robotics | `https://www.reddit.com/r/robotics/hot.json?limit=25` | Low — filter for lifelike |

## Research Process

1. **Search for lifelike humanoid news** — `web_search "lifelike humanoid robot news {date range}"` and `web_search "realistic humanoid robot 2026"`
2. **Check key companies** — search for each company in the watchlist
3. **Check humanoid.press** — `web_fetch` for recent headlines
4. **Filter strictly** — only include items that match the "What Qualifies" criteria above
5. **Deduplicate** against D1

## Freshness

Uses the dynamic lookback window from `tmp/lookback-config.json`. Reject items outside the window.

## Empty Section Handling

If no lifelike humanoid news exists within the lookback window, return an empty items array:
```json
{ "section_key": "15-humanoid-robotics", "research_date": "YYYY-MM-DD", "item_count": 0, "items": [], "editorial_notes": "No lifelike humanoid developments this week." }
```
This is normal and expected — the section may appear only 2-3 times per month. The section will be omitted from the digest.

## Output JSON

Standard Sift news item format (same schema as sections 03-10). See `instructions/RESEARCH_BRIEF.md`.
