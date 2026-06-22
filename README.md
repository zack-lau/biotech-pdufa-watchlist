# Biotech PDUFA Watchlist

React + Next.js dashboard for tracking US-listed small- and mid-cap biotech companies with FDA PDUFA target action dates in the next 90 days.

The app is intentionally file-based: `data.json` is the current dashboard data, and `previous-data.json` is used for run-over-run delta badges.

## What It Does

### Dashboard

- Tracks US-listed small- and mid-cap biotech companies with FDA PDUFA target action dates in the next 90 days.
- Groups catalysts by urgency: high, medium, watch, and resolved.
- Provides search, filter chips, sort controls, persistent star/hide state, run-over-run change badges, ticker detail cards, and calendar `.ics` export.
- Shows market context and catalyst research per ticker, including current price, analyst price target, market cap, short interest, implied volatility, sentiment, approval odds, and bull/bear/risk theses.
- Supports light and dark themes with responsive layouts for desktop and mobile.

### Refresh Pipeline

- Runs from a scheduled Codex heartbeat that follows `AGENTS.md` as the source of truth.
- Discovers upcoming qualifying PDUFA catalysts across the US small/mid-cap biotech universe.
- Aggregates regulatory, company, market, and sentiment data from FDA, SEC, press releases, Perplexity, yfinance, markitdown, and X/search tooling.
- Resolves conflicting PDUFA dates by source authority: company press release or 8-K, FDA.gov, BioPharma Catalyst, Fierce Biotech, then sourced narrative results.
- Synthesizes approval odds, sponsor track record, cash runway, price action, sentiment, and bull/bear/risk theses for each tracked ticker.

### Run Safeguards

- Uses explicit `Unknown` values when a field cannot be reliably sourced.
- Validates market data before inclusion and documents tool fallbacks for unavailable or partial sources.
- Preserves the prior run in `previous-data.json` before writing a new `data.json`.
- Validates JSON and summary consistency after every refresh.
- Supports partial-run banners when a refresh completes with known source or tool failures.
- Sends the Telegram completion alert only after `data.json` validates.

## Run Locally

```bash
npm install
npm run dev -- -H 0.0.0.0 -p 8000
```

Open http://localhost:8000/.

For this local workspace, a macOS LaunchAgent starts the dashboard automatically at login:

```bash
launchctl list | grep pdufa
tail -f ~/Library/Logs/pdufa-dashboard.log
```

## Build Check

```bash
npm run build
```

## Project Structure

- `app/layout.jsx` - Next.js app shell, metadata, fonts, and global CSS imports.
- `app/page.jsx` - server component that reads `data.json` and `previous-data.json`.
- `app/Dashboard.jsx` - interactive React dashboard.
- `base.css` - resets and focus styles.
- `style.css` - layout, design tokens, responsive styles, dashboard components.
- `data.json` - current watchlist data.
- `previous-data.json` - prior run data for deltas.
- `serve.py` - LaunchAgent entrypoint for starting Next.js on port 8000.
- `AGENTS.md` - authoritative Codex/heartbeat run instructions.

## Refresh Automation

The recurring refresh is managed by a Codex heartbeat named `biotech-pdufa-watchlist`. It follows `AGENTS.md`, writes only the allowed data files during routine refreshes, validates `data.json`, confirms the local dashboard responds, and sends the completion notification through Telegram.

## Notes

- This project has no database; the JSON files are the dashboard data source.
- Routine data refreshes should not edit React, CSS, package, launcher, or legacy static files unless the requested task is a UI/runtime change.
- `scheduled-task-prompt.md` is retained only as migration history.
