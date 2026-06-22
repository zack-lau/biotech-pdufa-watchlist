# Biotech PDUFA Watchlist

React + Next.js dashboard for tracking US-listed small- and mid-cap biotech companies with FDA PDUFA target action dates in the next 90 days.

The app is intentionally file-based: `data.json` is the current dashboard data, and `previous-data.json` is used for run-over-run delta badges.

## What It Does

- Built a full-stack Next.js and React dashboard that scans the US small/mid-cap biotech universe for upcoming FDA PDUFA decisions and surfaces qualifying catalysts, with search, filtering, a persistent watchlist, run-over-run change badges, calendar `.ics` export, and light/dark themes.
- Engineered a scheduled Codex agent that aggregates FDA, SEC, press-release, market, and sentiment data across multiple tools, including Perplexity, yfinance, markitdown, and X; resolves conflicting PDUFA dates by source authority; and synthesizes approval odds plus bull, bear, and risk theses per ticker.
- Layered failure-aware safeguards into each run: per-field `Unknown` handling, market-data validation with documented tool fallbacks, partial-run banners, JSON and consistency checks, and a Telegram alert gated on a validated refresh.

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
