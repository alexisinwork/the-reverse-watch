# "Find a cheaper alternative": research (2026-10-01)

The idea: a subscriber names a watch (reference optional) and a budget; we
find watches that look and work like it for less, new or pre-owned.

## Owner decisions

1. **No homages**: watches that copy another brand's design are excluded.
2. **New and pre-owned** prices both count.
3. **Fourth card on the home page**, in the subscriber row (live as "Coming
   soon").
4. **Budget**: an exact price, searched within ±USD 1,000 of it, *or* one
   of the main quiz's price ranges.
5. The owner will provide a set of popular examples; they become the
   quality test set before launch.

## What we tested, and what we found

### 1. The catalogue already holds most of the "works like" facts

Across 3,105 catalogue watches:

| Fact | Coverage |
| --- | --- |
| Style (dive, dress, sport, field, travel, everyday) | 100% |
| Movement type | 100% |
| Case diameter | 97% |
| Water resistance | 96% |
| Functions (date, dive bezel, GMT, chronograph, …) | 92% |
| Case and strap material | 89% |
| Case thickness | 55% |
| Photo | 93% |
| Price | 96% |

Homage brands: only one Steinhart entry is in the catalogue today.

### 2. A first prototype with only those facts already gives sensible picks

Black Bay 58 (39 mm, 200 m, no date, dive bezel), new, under USD 2,000:
87 watches pass the strict rules. Top picks: Vulcain Skindiver Nautique,
Baltic Aquascaphe (black and blue gilt), Lorier Hydra Series III Black/Gilt,
Seiko Prospex 1965 re-interpretations: the watches enthusiasts actually
name. But it also ranks a tactical-looking Vaer D5 as high as the gilt
ones: **facts alone can't tell how a watch looks.**

### 3. The look must come from the product photo, not the maker's page

- Reading design details from maker page text fails often: many pages
  build their content with scripts (no text), some return 404.
- Reading the **product photo** with a vision model works well. On the
  Black Bay 58 it correctly reported black dial, snowflake hands, gold
  bezel numerals with a red triangle, cream lume and a steel bracelet; on
  the Lorier, gilt-style details and cream lume. About 6–9 s and a
  fraction of a cent per photo.
- "Vintage-inspired vs modern" from a photo is subjective (it called the
  Seiko 1965 re-interpretation "modern"), so it should weigh little.

### 4. Pre-owned prices are obtainable and fast

One web search for "Black Bay 58, M79030N-0001, used" returned five real
dealer listings in 3 s (Chrono24, Tourneau): about USD 3,000–3,600. Prices
come in several currencies and are converted with the day's ECB rates.
Each lookup costs under one cent.

## The design

### Step 1: identify the watch the person named

Catalogue first (brand, model, reference; tolerant of spelling). If it is
ambiguous, ask: "Did you mean Black Bay 58 (39 mm) or Black Bay 54
(37 mm)?" If it isn't in the catalogue: one web search, facts confirmed on
the maker's page (the catalogue's existing rule), then it is added to the
catalogue as pending.

### Step 2: its fingerprint

| Must match (strict) | Scored (how alike it looks and feels) |
| --- | --- |
| Style (diver stays diver, dress stays dress) | Dial colour and texture |
| Key functions: GMT, chronograph, dive bezel, world time | Hands and index style (snowflake, broad arrow, baton) |
| Case diameter within ±2 mm | Bezel insert colour and markings |
| Water-resistance class (a 200 m diver stays ≥ 200 m) | Lume colour (cream/gilt vs white) |
| Mechanical stays mechanical (unless the person allows quartz) | Bracelet or strap, case material |
| Price inside the budget (new or pre-owned) | Date or no date, thickness, vintage vs modern |
| Not a homage, not the same brand's cheaper copy of itself? *(see question)* | |

The score is a fixed, versioned table of points, so results are
explainable and repeatable (no model decides the ranking).

### Step 3: find and rank

1. Filter the catalogue with the strict rules; rank by score.
2. Pre-owned: for strict matches whose new price is above the budget but
   within about twice it, look up the pre-owned price (cached 90 days).
   The named watch itself gets one too: "A used Black Bay 58 is about
   USD 3,000–3,600."
3. Fewer than 3 good matches: a live web search for watches like it,
   every suggestion checked against the same strict rules and the maker's
   page before it is shown, then added to the catalogue.
4. Homage filter: a maintained list of homage brands, plus a rule that
   rejects a model whose name or description copies another brand's
   model name.

### Step 4: show it honestly

Each card: "Shares: 39 mm · 200 m · no date · black dial · gilt-style
details" and "Differs: rubber strap, broad-arrow hands", the price (new or
pre-owned, labelled), and the existing "Manufacturer reference not
confirmed" tag where it applies.

### Budget

- **Exact price** → search from (price − 1,000) to (price + 1,000), in the
  chosen currency; shown as "around USD 2,000".
- **Quiz range** → the same ranges and dropdown as the main quiz.

## Build plan and costs

| Phase | What | One-off cost | Effort |
| --- | --- | --- | --- |
| 1 | Page, name → catalogue lookup, strict rules + score with existing facts, budget input, subscriber gate, results with "Shares / Differs" | none | 1–2 days |
| 2 | Read design traits from every catalogue photo (dial, hands, bezel, lume, bracelet, era), stored per watch; add them to the score | about USD 10–15 | 1 day |
| 3 | Pre-owned prices on demand (cached 90 days) and for the named watch | under 1 cent per lookup | 1 day |
| 4 | Named watches outside the catalogue, live fallback search, homage filter | cents per new search | 1–2 days |
| 5 | Owner's example set as the quality test; tune the score until the top 5 are right in most cases | none | 1 day |

New database fields (additive migration): design traits per watch, and a
pre-owned price with its date and evidence.

## Open questions for the owner

1. **The same brand's cheaper model** (Tudor Black Bay 58 → Tudor Ranger):
   allow it? It's often the honest answer.
2. **Quartz alternatives** to a mechanical watch: never, or only when the
   person ticks "quartz is fine"?
3. **Pre-owned trust**: only established dealers (Chrono24 dealers,
   Watchfinder, Bob's, Tourneau/WatchBox), or private-seller listings too?
