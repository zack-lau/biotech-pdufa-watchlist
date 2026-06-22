# Biotech PDUFA Watchlist — Archived Scheduled Task Spec

This file is archival migration context from the old scheduled-task setup. The active Codex heartbeat instructions live in `AGENTS.md`; use `AGENTS.md` as the source of truth for refresh behavior, schema rules, tool fallbacks, and final reporting.

This file holds the schedule and the self-contained prompt for the recurring run. The dashboard scaffolding (`index.html`, `base.css`, `style.css`, `app.js`) lives in this folder and is **not** regenerated each run — runs only refresh `data.json` (and snapshot the prior `data.json` to `previous-data.json` for diff badges).

## Schedule
- **Cron:** `0 6 * * 1,3,5` (Mon/Wed/Fri at 06:00 local time)
- **Local timezone confirmed:** SGT / UTC+8
- **Task ID:** `biotech-pdufa-watchlist`
- **Description:** Mon/Wed/Fri 06:00 SGT — PDUFA sweep + per-ticker research + dashboard data refresh.

## How it works
1. Each run sweeps the public sources, deep-researches every ticker with a PDUFA in the next 90 days, then writes a new `data.json`.
2. Before overwriting `data.json`, the prior file is copied to `previous-data.json` so the renderer can compute run-over-run deltas (NEW, rating change, approval-odds Δ, short-interest Δ, date moved).
3. `index.html` fetches both `data.json` and `previous-data.json` and renders the dashboard with all features (timeline strip, filter/sort/search toolbar, gauge bars, .ics export, star/hide, print stylesheet).
4. The HTML/CSS/JS files **do not change** between runs. If a future run discovers any of them missing, it should leave that alone and just write the data files — the user will notice and re-seed manually.

## Prompt (use as the Codex automation prompt)

```
You are running an autonomous Biotech PDUFA Watchlist refresh. This run has no memory of any prior session — start fresh every time. Resolve today's date with `bash: date +%Y-%m-%d` at the start and reuse that value throughout the run.

WORKSPACE
- All output is saved into the user's workspace folder ONLY: `/Users/zack/Documents/Codex/PDUFA`.
- DO NOT save, copy, upload, or mirror any output to Google Drive, OneDrive, Dropbox, Box, iCloud, GitHub, or email. Project folder only. If a Drive/Box/Dropbox MCP tool is available at run time, do not use it for writes.
- The dashboard scaffolding (`index.html`, `base.css`, `style.css`, `app.js`) already exists in the folder. DO NOT regenerate, overwrite, or modify those files. Only write the data files described below.
- Use the Read/Write/Edit file tools (not bash) for creating and editing files.

TOOLS — exact MCP tool names installed in this environment
- **Perplexity MCP** (primary deep-research layer)
  - `mcp__perplexity__perplexity_research` — Sonar Deep Research. SLOW (30+ s). Use for synthesis: drug profile prose, bull/bear/risk thesis, competitive landscape, AdCom outcome lookup, manufacturing-issue check, approval-probability consensus. Always include "Return citations." in the prompt; persist citation URLs into the per-ticker `sources[]` array.
  - `mcp__perplexity__perplexity_ask` — Sonar Pro. Fast. Use for quick facts: confirming a PDUFA date, checking a single press release. Accepts `search_recency_filter: "month"` / `"week"` / `"day"`.
  - `mcp__perplexity__perplexity_search` — Returns ranked URLs with snippets. Use when you need to discover sources before pulling them with `markitdown__convert_to_markdown`.
- **xAI Search MCP** (X/Twitter, primary `xSentiment` layer)
  - `mcp__xai-search__x_search` — Query, optional `from_date`/`to_date` (YYYY-MM-DD), optional `handles[]` allowlist, optional `max_results` (default 20). For the watchlist, always pass `from_date` = today − 14 days and `max_results: 15`. Returns a markdown report with four sections — parse it as follows into `xSentiment`:
    - Section 1 "Overall sentiment" → `xSentiment.overall` = "Bullish" | "Bearish" | "Mixed" | "Neutral" | "Quiet" | "Unavailable" (use "Quiet" if the report explicitly notes thin volume / few posts; use "Unavailable" only when `x_search` fails — see Failure modes below).
    - Volume inference from the listed post count + confidence wording → `xSentiment.volume` = "Low" (≤5 posts or "low confidence") | "Medium" (6–12 posts) | "High" (>12 posts or explicit "heavy volume").
    - Section 2 "Key themes" → paraphrased one-sentence into `xSentiment.summary` (NEVER quote >15 words from any single post; the markdown report's paraphrases are safe to compress further).
  - `mcp__xai-search__x_resolve` — Resolve a specific X URL to author + content + engagement. Use only if a Perplexity citation points to an X post and you want the underlying numbers.
  - `mcp__xai-search__x_thread` — Fetch a full reply thread by tweet ID. Use sparingly.
- **Clinical Trials MCP** (primary clinical-data layer)
  - `mcp__f65ed1f4-bb81-4963-a52f-1d9dfbd84d23__search_trials` — Search by `condition`, `intervention`, `sponsor`, `phase`, `status`. Use `phase=["PHASE3"]` for the pivotal-trial lookup.
  - `mcp__f65ed1f4-bb81-4963-a52f-1d9dfbd84d23__get_trial_details` — Full trial detail by NCT ID. Use for primary endpoints, eligibility, enrollment, sponsor.
  - `mcp__f65ed1f4-bb81-4963-a52f-1d9dfbd84d23__analyze_endpoints` / `search_by_sponsor` / `search_by_eligibility` / `search_investigators` — available as needed.
- **searxng MCP** (meta-search across multiple engines)
  - `mcp__searxng__web_search` — Query, optional `language` (always pass `"en"` for this task), `result_count` (default 10), `time_range` (`"month"` / `"week"` / `"day"` / `"year"`), `categories` (use `"news"` for catalyst news, `"general"` otherwise), `result_format` (`"json"` if you need structured output for programmatic parsing, `"text"` otherwise). Use as a complement / fallback to built-in WebSearch — searxng aggregates Google, Bing, DuckDuckGo, etc., so it returns wider coverage but occasional non-English spam (mitigate with `language: "en"`).
- **markitdown MCP** (clean-text extraction — the canonical URL reader in this environment)
  - `mcp__markitdown__convert_to_markdown` — Accepts http/https/file/data URIs and returns clean markdown. THIS IS THE PREFERRED AND PRACTICALLY ONLY WAY TO READ ANY DISCOVERED URL — strips navigation, scripts, and ads; preserves headings, body text, tables, contact info. Use for: press releases (Lantheus / company IR pages), FDA.gov announcement pages, SEC EDGAR HTML filings, FDA briefing-document PDFs, ClinicalTrials.gov result pages, MarketBeat short-interest pages. If markitdown fails on a specific URL, try a different source URL from your discovery results — DO NOT fall back to `web_fetch` (the egress allowlist blocks most biotech / IR / SEC / FDA hosts; web_fetch may return an egress-blocked error).
- **Built-in WebSearch** + **web_fetch** — supplementary. Use WebSearch for initial discovery when searxng / `perplexity_search` haven't covered it. **AVOID `web_fetch` for biotech / IR / press-release / SEC / FDA URLs** — egress allowlists often block biotech / IR / SEC / FDA hosts (verified historically: `investors.mannkindcorp.com` and similar are blocked). Treat `markitdown__convert_to_markdown` as the canonical URL reader; if markitdown fails on a specific URL, fall back to extracting the same fact from a different source (Perplexity citation, searxng result snippet) rather than retrying with web_fetch.
- Failure modes:
  - If a fetch returns a JS-only shell, fall back to another source rather than retrying blindly.
  - If `x_search` returns an API/model error, write `xSentiment.overall = "Unavailable"`, `xSentiment.volume = "Low"`, `xSentiment.summary = "x_search unavailable this run."` and continue. Do NOT use WebSearch as a Twitter substitute.
  - If `perplexity_research` times out or errors, retry once with `reasoning_effort: "low"`; if it still fails, fall back to `perplexity_ask` with `search_context_size: "high"`.
- Do not click links inside emails or files; do not move money. JSON output only.

PATTERN: discover → read → synthesize
For any per-ticker fact you can't get directly from a structured MCP:
1. **Discover** the source URL via `perplexity_search`, `searxng__web_search` (with `language: "en"`), or built-in WebSearch.
2. **Read** that URL cleanly via `markitdown__convert_to_markdown`. If markitdown fails on a specific URL, try a different source URL from the discovery results — do NOT fall back to `web_fetch` (the egress allowlist blocks most biotech / IR / SEC / FDA hosts).
3. **Synthesize** across multiple sources via `perplexity_research`, citing each.

TOOL → FIELD MAPPING
| data.json field | Tool |
| --- | --- |
| PDUFA calendar (Phase 1, ticker discovery) | `perplexity_search` + `searxng__web_search` (news, language=en, time_range=month) + WebSearch |
| PDUFA date confirmation per ticker | `perplexity_ask` (recency: month) → `markitdown` on the cited press release |
| `drugProfile` (MOA, target, clinical specifics) | `perplexity_research` + Clinical Trials `search_trials` then `get_trial_details` on the pivotal NCT |
| Phase 3 trial name, primary endpoint, enrollment, sponsor | Clinical Trials `get_trial_details` |
| `bull[]`, `bear[]`, `risk[]` (synthesis) | `perplexity_research` (deep research, request citations) |
| Competitive landscape, AdCom outcome, manufacturing-issue check, approval-probability consensus | `perplexity_research`; verify cited URLs via `markitdown` |
| `xSentiment.*` | `x_search` (last 14 days; query: `$TICKER OR "{DRUG}" OR "{COMPANY}"`) |
| `redditSentiment.*` | `searxng__web_search` with `site:reddit.com {TICKER} {DRUG}` → `markitdown` on top threads |
| `googleTrends.*` | No MCP available to fetch Trends data (verified: perplexity_ask returns "no direct Google Trends access"; searxng returns generic stock pages). Always write `{ "signal": "Unavailable", "volume": "Low", "peakDate": "", "summary": "No Google Trends MCP available in this environment." }` until a Trends-capable MCP is installed. |
| `price`, 52-week, `marketCap` | `yfinance_get_ticker_info` (fields: `currentPrice`, `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`, `marketCap`) |
| `shortInterest`, `shortInterestAsOf` | MarketBeat via `markitdown` (URL: `https://www.marketbeat.com/stocks/NASDAQ/{TICKER}/short-interest/`) — no MCP available |
| `iv`, `ivAsOf` | `yfinance_get_option_chain` (closest listed expiry on or after PDUFA date; pull the ATM call's `impliedVolatility`). Set `ivAsOf = today`. |
| `analystPT`, `analystPTAsOf` | `yfinance_get_ticker_info` first (`targetMedianPrice`, `numberOfAnalystOpinions`, `recommendationKey` — these are conditional and may be absent on thinly-covered small caps); if absent, fall back to `perplexity_ask` ("median analyst price target for {TICKER}, return citations") |
| `insider.*` | SEC EDGAR Form 4 — `searxng__web_search` to find filings, then `markitdown` to parse |
| `sources[]` | Citations returned by `perplexity_research` + Clinical Trials NCT URLs (`https://clinicaltrials.gov/study/{NCT}`) + any URLs read via markitdown |
| NME, Priority Review, BTD, Fast Track | FDA press releases via `perplexity_ask`, confirmed via `markitdown` on the cited URL |
| `priceChange.*` (1D / 5D / 1M / 3M / 6M / YTD / 1Y, vs 50/200d avg, notable events) | yfinance `yfinance_get_price_history` (period=1y) + `yfinance_get_ticker_info` for 52w / averages |
| `cashRunway.*` (cash, debt, FCF, runway months, dilution risk) | yfinance `yfinance_get_financials` (quarterly), computed |
| `sponsorTrackRecord.*` (approvals 10y, CRLs, drug list) | `perplexity_ask` ("{company} FDA approval track record last 10 years…") |

==========================================================
STEP 1 — DISCOVER UPCOMING PDUFA TICKERS
==========================================================
Goal: produce a deduplicated, validated list of US-listed small- to mid-cap biotech tickers (market cap < $10B) with FDA PDUFA dates in the next 90 days. This is the foundation of the whole pipeline — be exhaustive, then filter.

**1A. PRIMARY DISCOVERY** — one `perplexity_research` call with a deep, exhaustive query. Substitute `{TODAY_ISO}` and `{NINETY_OUT_ISO}` (today + 90 days):

> "List every US-listed (NASDAQ or NYSE) small-cap and mid-cap biotech company (market capitalization under $10 billion USD) with an FDA PDUFA target action date occurring between {TODAY_ISO} and {NINETY_OUT_ISO}. Include new molecular entity NDAs, BLAs, sNDAs, sBLAs, and ANDAs where applicable. Exclude any sponsor with market cap above $10 billion. Be exhaustive — include obscure small-cap names that appear on aggregator calendars even if not widely covered. For each entry provide: ticker symbol (US exchange), company legal name, drug name (generic + brand if any), indication, exact PDUFA date in YYYY-MM-DD, NME status (Yes/No), application type (NDA/BLA/sNDA/sBLA/ANDA), and a primary-source citation URL (company IR press release, FDA.gov announcement, or SEC 8-K). Sort by PDUFA date ascending. Return citations."

Set `reasoning_effort: "high"` and persist every citation URL into a working list for Step 2's `sources[]`.

**1B. SECONDARY DISCOVERY** — calendar aggregator scrape (parallelizable):
- `markitdown__convert_to_markdown` on `https://www.biopharmacatalyst.com/calendars/fda-calendar` — this is the canonical biotech-catalyst calendar. Parse every ticker+date within the 90-day window.
- `searxng__web_search` queries (language="en", time_range="month", categories="news"), one call each:
  - `"biotech PDUFA calendar {THIS_MONTH_NAME} {YEAR}"`
  - `"biotech PDUFA calendar {NEXT_MONTH_NAME} {YEAR}"`
  - `"upcoming FDA approvals {THIS_MONTH_NAME} {YEAR} small cap"`
  - `site:fda.gov "PDUFA" "action date" {YEAR}`
  - `site:fiercebiotech.com "PDUFA action date"`
  - `site:sec.gov "PDUFA target action date" 8-K`
- For each useful URL surfaced by searxng (FDA pages, Fierce articles, recent 8-Ks), call `markitdown__convert_to_markdown` to read it and extract ticker+date pairs that fall in the 90-day window.

**1C. UNION + DEDUP**
Merge candidates from 1A and 1B by ticker (case-insensitive). When the same ticker appears in multiple sources:
- Use the MOST RECENT authoritative PDUFA date (rank: company press release / 8-K > FDA.gov > BioPharma Catalyst > Fierce Biotech > Perplexity narrative).
- If dates conflict by more than 7 days, append the alternate(s) to `pdufaDatesExtra[]` as labeled strings, e.g. `"2026-07-15 — alt source: FierceBiotech"`. The label prefix MUST start with `"alt source:"` so the renderer can distinguish disagreement entries from multi-drug entries.
- Combine source URLs into a per-ticker `sourceUrls[]` list (will become Step 2's `sources[]`).
- Drop exact duplicate rows.

**1D. VALIDATE EACH CANDIDATE** via `yfinance_get_ticker_info({symbol})`. For each candidate, fetch and apply these filters:

KEEP if and only if ALL of:
- `currency == "USD"`
- `exchange` ∈ {"NMS","NGM","NGS","NCM","NYQ","NYSE","NCS","ASE","AMEX"} (US exchanges)
- `50_000_000 <= marketCap < 10_000_000_000` ($50M floor excludes shell-like nano-caps; $10B ceiling excludes big pharma)
- `quoteType == "EQUITY"`
- yfinance returns valid data (not 404 / empty)

DROP if:
- Market cap ≥ $10B (big pharma — out of scope)
- Non-US listing (ADRs without underlying US trading)
- Ticker not resolvable on yfinance

PROMOTE TO `resolved[]` (do NOT drop) if:
- PDUFA date has already passed AND outcome is known — move the entry out of the tracked-tickers working list and into `resolved[]`. Step 1E details the carryover; Step 2's lightweight resolved-ticker recipe fills `outcome`, `outcomeNote`, `source`.

EDGE CASES:
- If a candidate's PDUFA date is unknown (only month given), set day=15 of that month and add `"monthOnly": true` to that ticker's object.
- If a candidate has multiple PDUFA dates within the 90-day window (e.g. two drugs at different action dates), pick the earliest as `pdufaDate` and append the rest to `pdufaDatesExtra[]` as labeled strings, e.g. `"2026-07-26 — FUROSCIX ReadyFlow autoinjector"`. Use the drug or program name as the label; do NOT use the `"alt source:"` prefix (that's reserved for source-disagreement entries from 1C).

**1E. RESOLVED CARRYOVER**
Read `/Users/zack/Documents/Codex/PDUFA/previous-data.json` if it exists. For each entry in its `resolved[]` array:
- Carry it forward into the new run's `resolved[]` UNLESS `resolvedDate` is more than 30 days before today — in which case drop it (no longer recent enough to feature).
- Do NOT re-research carried-over entries; preserve `outcome`, `outcomeNote`, `source` verbatim.

Additionally, for any ticker in Step 1's discovery list whose `pdufaDate` has already passed AND whose outcome is now known (Approved or CRL), move it from `tickers[]` to `resolved[]` and run only the lightweight resolved-ticker recipe in Step 2 (described there).

**OUTPUT of Step 1** — an in-memory list of validated ticker objects, each with at least:
```
{ ticker, company, drug, indication, pdufaDate, pdufaDatesExtra[], applicationType, nme, sourceUrls[] }
```

Fields not yet populated (priorityReview, btd, fastTrack, adcom, approvalOdds, market data, sentiment, etc.) are left null at this stage — Step 2 fills them.

**SANITY CHECK before Step 2**: if Step 1 produces fewer than 3 tickers, the discovery probably missed names. Re-run 1A with broader phrasing ("any FDA PDUFA decision," "any drug under FDA review with target action date") and re-run 1B with `time_range:"year"` instead of `"month"`. Log a warning in the final chat reply.

==========================================================
STEP 2 — PER-TICKER DEEP RESEARCH
==========================================================
For every TRACKED ticker captured in Step 1, research the fields listed in the schema below. If a data point can't be reliably sourced, write `"Unknown"` (or `null` for nested fields) rather than guessing.

**Resolved tickers** (entries promoted to `resolved[]` in Step 1E, either carried over from `previous-data.json` or freshly resolved this run) get a lightweight recipe only:
- For carried-over entries: preserve `outcome`, `outcomeNote`, `source` from `previous-data.json` verbatim. Skip the per-ticker recipe below.
- For newly resolved entries: research `outcome` ("Approved" | "CRL"), `outcomeNote` (1–3 sentences citing the FDA press release or company 8-K), and `source` (one URL). Use `perplexity_ask` (recency: month) followed by `markitdown` on the cited URL. Do NOT run drug-profile / sentiment / market-data / cash-runway research for resolved entries.

Catalyst rating (for tracked tickers only):
- "high"   — PDUFA within 7 days
- "medium" — PDUFA 8–56 days out
- "watch"  — PDUFA >56 days out

PER-TICKER RESEARCH RECIPE
Run these queries in roughly this order. Substitute `{TICKER}`, `{DRUG}`, `{COMPANY}`, `{INDICATION}`, `{PDUFA}`. Queries marked PPX go to the Perplexity MCP; queries marked GROK go to the Grok/xAI Live Search MCP; everything else is WebSearch / searxng for discovery and `markitdown__convert_to_markdown` for reading the discovered URLs.

1. **Drug profile** (PPX)
   - "Mechanism of action, target, indication, patient population, Phase 3 trial name and primary endpoint, latest efficacy and safety results for {DRUG} ({COMPANY}, {TICKER}). Include FDA designations: NME, Priority Review, BTD, Fast Track. Return citations."

2. **Competitive landscape** (PPX)
   - "Currently approved drugs and late-stage pipeline competitors in {INDICATION}, including each competitor's expected next readout or PDUFA date. Return citations."
   - **Destination:** there is no separate `competitiveLandscape` field. Weave key competitor names and threats into `bear[]` bullets (where competitors create headwinds) and/or the second sentence of `drugProfile` (where context helps positioning). Surface competitor citations in `sources[]`.

3. **AdCom + manufacturing + approval probability** (PPX, one combined deep-research call OK)
   - "Was there an FDA Advisory Committee meeting for {DRUG} / {COMPANY} {TICKER}? If yes, when, and what was the vote outcome? Any disclosed CMC, manufacturing, or Form 483 issues in the last 12 months? What is the analyst consensus on the {PDUFA} PDUFA approval probability for {DRUG}? Return citations."

4. **Bull / bear / risk synthesis** (PPX)
   - "Write three one-sentence bull bullets, three one-sentence bear bullets, and one one-sentence key-risk bullet for {TICKER}'s {PDUFA} PDUFA decision on {DRUG} for {INDICATION}. Base on the most recent Phase 3 data, FDA designations, competitive landscape, manufacturing and AdCom history, and analyst sentiment. Cite all major sources."
   - **Output shape:** each bullet is one standalone sentence, written as one string entry in the `bull[]` / `bear[]` / `risk[]` array. Do NOT concatenate the three sentences into a single paragraph. Do NOT embed HTML in these arrays (the `<strong>` tag is only allowed inside `drugProfile`).

5. **X sentiment** (GROK, X as source, 14-day window)
   - Call `mcp__xai-search__x_search` with these parameters (use the tool's named arguments — do NOT embed Twitter operators like `since:` or `lang:` in the query string, the tool doesn't parse them):
     - `query`: `"$TICKER OR \"{DRUG}\" OR \"{COMPANY}\""`
     - `from_date`: today's ISO date minus 14 days (`YYYY-MM-DD`)
     - `max_results`: `15`
   - Capture exactly three fields: `overall` (one of Quiet / Mixed / Bullish / Bearish / Neutral / Unavailable), `volume` (Low / Medium / High), and a one-sentence `summary` that paraphrases what the loudest voices were saying. Do NOT quote more than 15 words from any single post. Do NOT compute a `peakDate` — the dashboard renderer does not display one for X.

6. **Reddit sentiment** (searxng + markitdown)
   - Discover via `mcp__searxng__web_search` with `query: "site:reddit.com {TICKER} {DRUG} PDUFA"`, `time_range: "month"`, `language: "en"`. Pull the top 3 threads.
   - Read each thread via `mcp__markitdown__convert_to_markdown` on the URL. Do NOT use `web_fetch` — reddit.com is not on the egress allowlist.
   - Capture exactly three fields using the same enums as `xSentiment`: `overall` (one of Quiet / Mixed / Bullish / Bearish / Neutral / Unavailable), `volume` (Low / Medium / High), one-sentence `summary`. If searxng returns zero threads or all reads fail, write `overall = "Unavailable"`, `volume = "Low"`, `summary = "No Reddit discussion found in the last 30 days."`.

7. **Cash runway & dilution risk** (yfinance)
   - Call `mcp__yfinance__yfinance_get_financials({symbol, frequency:"quarterly"})` and pull:
     - `cashAndEquivalents` = most recent `balance_sheet["Cash And Cash Equivalents"]`
     - `totalDebt` = most recent `balance_sheet["Total Debt"]`
     - `netDebt` = totalDebt − cashAndEquivalents
     - `quarterlyOperatingCashFlow` = most recent `cash_flow["Operating Cash Flow"]`
     - `quarterlyFreeCashFlow` = most recent `cash_flow["Free Cash Flow"]`
   - If `quarterlyFreeCashFlow > 0`: set `quarterlyBurn = null`, `runwayMonths = null`, `dilutionRisk = "Low"`.
   - If `quarterlyFreeCashFlow <= 0`: set `quarterlyBurn = abs(quarterlyFreeCashFlow)`, compute `runwayMonths = (cashAndEquivalents / quarterlyBurn) * 3`. Then classify:
     - `runwayMonths < 6` → `dilutionRisk = "Critical"`
     - `runwayMonths 6–12` → `"High"`
     - `runwayMonths 12–24` → `"Medium"`
     - `runwayMonths > 24` → `"Low"`
   - One-sentence `summary` field summarizing the cash position relative to PDUFA risk.

8. **Price momentum** (yfinance)
   - Call `mcp__yfinance__yfinance_get_price_history({symbol, period:"1y", interval:"1d"})` to get the daily close series.
   - Compute `change1D` (last vs prior), `change5D`, `change1M` (~21 trading days), `change3M`, `change6M`, `changeYTD` (vs Dec 31 prior year close), `change1Y` (vs first close in series).
   - Pull `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`, `fiftyDayAverage`, `twoHundredDayAverage` from `yfinance_get_ticker_info` and compute `from52wHigh`, `from52wLow`, `vs50dayAvg`, `vs200dayAvg`.
   - Detect notable single-day events: any day with |close-to-close change| ≥ 15% in the past 1y. Include up to 3 in `notableEvents` with date, change %, and a one-line note inferred via `perplexity_ask` (e.g. "Earnings miss / guidance cut", "Phase 3 readout").

9. **Sponsor track record** (Perplexity)
   - Call `mcp__perplexity__perplexity_ask` with the prompt: `"{COMPANY} ({TICKER}) FDA NDA/BLA/sNDA approval track record over the last 10 years: list each approved drug with date and application type, and list any documented Complete Response Letters. Return citations."` and `search_context_size: "medium"`.
   - Parse: `approvalsLast10y` (count), `approvalsList[]` (drug, type, date), `tentativeApprovals[]` if any, `crlsLast10y` (count), and a 1–2 sentence `summary`.

10. **Market data** (yfinance MCP preferred; markitdown only where the MCP doesn't cover)
    - `mcp__yfinance__yfinance_get_ticker_info({symbol})` → `price` (`currentPrice`), 52-week (`fiftyTwoWeekHigh` / `fiftyTwoWeekLow`), `marketCap`. Set `priceAsOf = today`.
    - **Analyst price target** (conditional — `targetMedianPrice`, `numberOfAnalystOpinions`, `recommendationKey` are only returned when yfinance has analyst coverage for the ticker, which is often absent for thinly-covered small caps): if present, use directly → `analystPT`, `analystPTAsOf = today`, plus Buy/Hold/Sell narrative from `recommendationKey` + `numberOfAnalystOpinions`. If absent, fall back to `mcp__perplexity__perplexity_ask` with `"What is the median analyst price target for {TICKER} as of today? Return citations."` and write `analystPT = "Unknown"` if Perplexity also can't source one.
    - `mcp__yfinance__yfinance_get_option_dates({symbol})` then `mcp__yfinance__yfinance_get_option_chain({symbol, expiration_date: chosenExpiry, option_type: "all"})` — pick the nearest listed expiration on or after `pdufaDate` from the dates array, pass that string as `expiration_date`, then read the ATM call's `impliedVolatility` → `iv` (format as percentage, e.g. `"71%"`), `ivAsOf = today`. Note unusual open-interest concentrations and the highest-OI call/put strikes in `drugProfile` if material.
    - MarketBeat short-interest page via `markitdown` (no MCP available) → `shortInterest`, `shortInterestAsOf`
    - SEC EDGAR Form 4 filings (last 90 days) — `searxng__web_search` to find filings, then `markitdown` to parse → `insider.buys`, `insider.sells`, `insider.netValue`, derived `insider.signal`
    - SEC EDGAR 8-K and 10-Q (last 90 days) via `markitdown` — note any secondary offerings / ATM activity in `risk` or `bear`.

11. **Google Trends** (no MCP available — write Unavailable)
    - No MCP in this environment can fetch Google Trends data (perplexity_ask and searxng both confirmed to return no Trends time-series). Do NOT spend tool calls trying; instead, always write:
      `googleTrends: { "signal": "Unavailable", "volume": "Low", "peakDate": "", "summary": "No Google Trends MCP available in this environment." }`
    - Revisit this step only if a Trends-capable MCP (e.g. pytrends-backed) is added to the tool set.

Aggregate everything into the per-ticker JSON object below. Apply ISO `*AsOf` dates equal to today's date for each metric pulled today.

**Materializing `sources[]`:** The Step 1 working list carries plain URL strings in `sourceUrls[]`. The schema's `sources[]` requires objects of the form `{ "name": "...", "url": "..." }`. For each URL, derive a short descriptive `name` from the page title (preferred — markitdown returns the title as the first heading) or, failing that, from the domain + short slug (e.g. `"globenewswire.com — MannKind sBLA acceptance"`). **Every `sources[]` entry MUST have both `name` and `url` populated** — the renderer (`app.js`) uses `${escapeHTML(s.name)}` for the link text, so a missing `name` renders as blank / `undefined`. Do not write entries with only a URL.

==========================================================
STEP 3 — WRITE DATA FILES
==========================================================
Carry out these steps in order:

1. Read the existing `/Users/zack/Documents/Codex/PDUFA/data.json`. If it exists, copy its contents to `previous-data.json` in the same folder (overwriting any prior `previous-data.json`). If `data.json` does NOT exist, create `previous-data.json` as an empty object `{}`.

2. Compute the run identity fields from `previous-data.json`:
   - Extract the prior run number `N_prev`, then increment by 1 to get this run's `N`. Look in this priority order: (a) `previous-data.json`'s top-level `runId` field (e.g. `"Run #11 (May 13 SGT)"` → 11); (b) if `runId` is absent, parse the leading `"Run #(\d+)"` from `previous-data.json`'s `calendarNote` (production files prior to this prompt revision carry the run number only in `calendarNote`, so this fallback preserves continuity); (c) if neither field yields a parseable integer, default to `N = 1` and note the discontinuity in the chat reply.
   - Compute today's weekday name, day, month name, and year in the **Asia/Singapore** timezone (use `bash: TZ=Asia/Singapore date +"%A %-d %B %Y"`).
   - Populate the top-level fields:
     - `runId`: `"Run #N (Mmm D SGT)"` — e.g. `"Run #12 (May 18 SGT)"`
     - `heroEyebrow`: `"Weekday, D Month YYYY (SGT) · Run #N"` — e.g. `"Monday, 18 May 2026 (SGT) · Run #12"`
     - `heroTitle`: constant `"US-listed small & mid-cap biotechs with PDUFA dates in the next 90 days"` (matches the HTML default; renderer accepts the override harmlessly).
     - `lastUpdated`: today's ISO date in SGT (`YYYY-MM-DD`)
     - `calendarNote`: short one-line summary starting with `"Run #N (Mmm D SGT). X HIGH, Y MEDIUM, Z WATCH. ..."` (the same N as `runId`). **This is the run's primary subtitle line** — the renderer falls back to it when `heroLede` is unset.
     - `heroLede`: **OMIT this field on normal runs.** The renderer (`app.js:464-466`) shows `heroLede` if present and falls back to `calendarNote` otherwise. Only set `heroLede` on partial runs (per the FINAL OUTPUT section's partial-run rule) — `heroLede` overrides `calendarNote` when both are present, so it's reserved for the exceptional-state banner.

3. Write the new `data.json` to the same folder using exactly this schema:

```json
{
  "lastUpdated": "2026-05-18",
  "timezone": "Asia/Singapore",
  "runId": "Run #12 (May 18 SGT)",
  "heroEyebrow": "Monday, 18 May 2026 (SGT) · Run #12",
  "heroTitle": "US-listed small & mid-cap biotechs with PDUFA dates in the next 90 days",
  "calendarNote": "Run #12 (May 18 SGT). 1 HIGH, 6 MEDIUM, 3 WATCH. <one-sentence summary of notable adds/drops/rating changes>",
  "summary": {
    "tracked": 10,
    "high": 0,
    "medium": 7,
    "watch": 3,
    "resolved": 3
  },
  "resolved": [
    {
      "ticker": "STR",
      "company": "Company Inc.",
      "drug": "Drug name",
      "indication": "Indication",
      "pdufaDate": "YYYY-MM-DD",
      "resolvedDate": "YYYY-MM-DD",
      "outcome": "Approved" | "CRL",
      "outcomeNote": "1–3 sentences on what happened.",
      "source": "https://..."
    }
  ],
  "tickers": [
    {
      "ticker": "STR",
      "company": "Company Inc.",
      "drug": "Drug name (brand)",
      "indication": "Indication",
      "rating": "high" | "medium" | "watch",
      "pdufaDate": "YYYY-MM-DD",
      "pdufaDatesExtra": ["2026-07-26 — FUROSCIX ReadyFlow autoinjector", "2026-07-15 — alt source: FierceBiotech"],
      "applicationType": "NDA" | "BLA" | "sNDA" | "sBLA" | "ANDA",
      "nme": "Yes" | "No" | "Unknown",
      "priorityReview": "Yes" | "No" | "Unknown",
      "btd": "Yes" | "No" | "Unknown",
      "fastTrack": "Yes" | "No" | "Unknown",
      "adcom": "None scheduled" | "Yes (YYYY-MM-DD)" | "Yes — voted X-Y on YYYY-MM-DD" | "Unknown",
      "approvalOdds": "60%" or "50-55%" or "Unknown",
      "shortInterest": "9.88%",
      "shortInterestAsOf": "YYYY-MM-DD",
      "iv": "71%",
      "ivAsOf": "YYYY-MM-DD",
      "price": "$3.28",
      "priceAsOf": "YYYY-MM-DD",
      "marketCap": "$1.01B",
      "analystPT": "$9.00",
      "analystPTAsOf": "YYYY-MM-DD",
      "drugProfile": "2–3 sentence prose paragraph. <strong>...</strong> tags allowed for emphasis, no other HTML.",
      "bull": [
        "Bullet 1 (one sentence).",
        "Bullet 2.",
        "Bullet 3."
      ],
      "bear": [
        "Bullet 1.",
        "Bullet 2.",
        "Bullet 3."
      ],
      "risk": [
        "One-line risk bullet."
      ],
      "xSentiment":      { "overall": "Quiet" | "Mixed" | "Bullish" | "Bearish" | "Neutral" | "Unavailable", "volume": "Low" | "Medium" | "High", "summary": "..." },
      "redditSentiment": { "overall": "Quiet" | "Mixed" | "Bullish" | "Bearish" | "Neutral" | "Unavailable", "volume": "Low" | "Medium" | "High", "summary": "..." },
      "insider":         { "buys": 0, "sells": 0, "netValue": "$0", "signal": "Bullish" | "Bearish" | "Neutral" | "Mixed" | "Unavailable", "summary": "..." },
      "googleTrends":    { "signal": "Rising" | "Declining" | "Mixed" | "Stable" | "Unavailable", "volume": "Low" | "Medium" | "High", "peakDate": "YYYY-MM-DD", "summary": "..." },
      "priceChange": {
        "asOf": "YYYY-MM-DD",
        "change1D": -2.85, "change5D": 0.91, "change1M": 11.87, "change3M": 31.8,
        "change6M": 77.2, "change1Y": 15.6, "changeYTD": 41.1,
        "from52wHigh": -4.4, "from52wLow": 98.8,
        "vs50dayAvg": 14.1, "vs200dayAvg": 42.2,
        "notableEvents": [
          { "date": "YYYY-MM-DD", "change": -28.6, "note": "Earnings miss / Phase 3 readout / etc." }
        ]
      },
      "cashRunway": {
        "asOf": "YYYY-MM-DD",
        "cashAndEquivalents": 359121000,
        "totalDebt": 619432000,
        "netDebt": 260311000,
        "quarterlyOperatingCashFlow": 90178000,
        "quarterlyFreeCashFlow": 81390000,
        "quarterlyBurn": null,
        "runwayMonths": null,
        "dilutionRisk": "Low" | "Medium" | "High" | "Critical",
        "summary": "Generates +$X FCF/qtr on $Y cash; no imminent capital need." or "Burning ~$Xm/qtr; ~Nmo runway, dilution risk Medium/High before PDUFA."
      },
      "sponsorTrackRecord": {
        "asOf": "YYYY-MM-DD",
        "approvalsLast10y": 3,
        "approvalsList": [
          { "drug": "...", "type": "NDA" | "BLA" | "sNDA" | "ANDA", "date": "YYYY-MM-DD or YYYY-MM" }
        ],
        "tentativeApprovals": [
          { "drug": "...", "type": "ANDA", "date": "YYYY-MM-DD", "blockedBy": "patent stay / etc." }
        ],
        "crlsLast10y": 0,
        "summary": "N FDA approvals in past 10 years (drug list), zero/one/two documented CRLs. Track record context for this PDUFA."
      },
      "sources": [
        { "name": "Source title", "url": "https://..." }
      ]
    }
  ]
}
```

Schema rules:
- `heroLede` is OPTIONAL and intentionally absent from the schema example above. Only include it on partial runs (per the FINAL OUTPUT section). When absent, the renderer falls back to `calendarNote` for the subtitle line.
- `bull`, `bear`, `risk` are JSON arrays of strings. Each string is one bullet, one sentence. Do NOT embed HTML in these arrays except <strong> in drugProfile.
- All "AsOf" fields are ISO `YYYY-MM-DD` dates indicating when that data point was sourced.
- Sort `tickers` ascending by `pdufaDate` (the renderer also sorts, but keeping the file sorted aids manual review).
- Sort `resolved` ascending by `resolvedDate`.
- The `summary` counts MUST match the actual arrays.
- Use null or omit fields cleanly — do not write empty strings like `"price": ""`.
- File must be valid JSON, encoded as UTF-8.

4. Validate `data.json` by parsing it with `python3 -c "import json; json.load(open('...'))"` via bash. If the parse fails, fix and rewrite.

4b. Bump the asset cache-bust version in `index.html` so mobile browsers pick up any changes immediately. Run this python3 snippet via bash (substitute the actual folder path):

```bash
python3 -c "
import re, pathlib
today = '$(TZ=Asia/Singapore date +%Y%m%d)'
p = pathlib.Path('/Users/zack/Documents/Codex/PDUFA/index.html')
html = p.read_text()
html = re.sub(r'\?v=\d+', f'?v={today}', html)
p.write_text(html)
print('version bumped to', today)
"
```

This is the ONLY permitted modification to `index.html` each run — do not change anything else in that file.

5. Do NOT touch `base.css`, `style.css`, or `app.js`. If any of these files (or `index.html` beyond the version bump above) are missing from the folder, log a warning in the final chat reply but do NOT regenerate them — the user has the master copies.

==========================================================
FINAL OUTPUT
==========================================================
Reply in chat with:
1. A computer:// link to `index.html` (the dashboard the user opens in a browser).
2. One paragraph (≤80 words) summarizing the run: total tracked, count by rating, any new tickers vs. previous run, any dropped tickers, any rating changes, any approval-odds movements > 5pp.
3. A note listing any sources that were unavailable this run, if applicable.

If anything fails partway, complete what you can and surface the partial-run state where the user will actually see it: prepend `"⚠️ Partial run — "` to `heroLede` (the renderer displays heroLede; a top-level `partial` flag is not rendered by app.js and would be silently ignored). Also call out the specific failures in the chat reply.
```

## Existing files in this folder

- `index.html` — page shell (header, hero, KPI grid, timeline strip, filter toolbar, four content sections, footer)
- `base.css` — resets and focus styles (unchanged from prior build)
- `style.css` — design tokens, light/dark themes, all component styles including new timeline / toolbar / gauges / diff badges / print
- `app.js` — fetches `data.json` + `previous-data.json`, renders everything, wires filter/sort/search/star/hide/.ics buttons
- `data.json` — current run output (gets overwritten each scheduled run)
- `previous-data.json` — prior run's data.json (gets overwritten each scheduled run with the file that was just replaced)

## Preview locally
The page uses `fetch()` to load `data.json` and `previous-data.json`, which Chrome blocks on `file://`. The dashboard is served over HTTP by a LaunchAgent that starts at login and restarts on crash, so it's **normally always available at [http://localhost:8000/](http://localhost:8000/)** — no manual setup needed. After a scheduled run writes the new `data.json`, just refresh the page; `app.js` re-fetches the JSON on each load.

Managing the LaunchAgent (only needed for debugging):

```bash
# Stop / start the service
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/cc.lzac.pdufa-dashboard.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/cc.lzac.pdufa-dashboard.plist

# Check status (PID + last exit code)
launchctl list | grep pdufa

# Tail the server log (live)
tail -f ~/Library/Logs/pdufa-dashboard.log

# Verify the dashboard is responding
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
```

For an ad-hoc preview on a different port (e.g. testing against an alternate `data.json` without disturbing the persistent server), double-click `start-dashboard.command` in Finder — it auto-walks up from port 8000 to find a free port and opens the browser.

## Notes
- Keyboard: press `/` anywhere to focus the search box.
- Deep-linking: append `#TICKER` to the URL to scroll directly to that card.
- Star / Hide state lives in your browser only (`localStorage`); it doesn't survive a different browser or private mode, and isn't synced to the data files.
