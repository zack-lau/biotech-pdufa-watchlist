#!/bin/bash
# Double-click this file in Finder to start the dashboard.
# It starts the Next.js dashboard on http://localhost:8000 and opens your browser.

cd "$(dirname "$0")"

PORT=8000
# If port 8000 is taken, walk up until we find a free one.
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
  if [ $PORT -gt 8050 ]; then
    echo "Couldn't find a free port between 8000-8050."
    echo ""
    read -n 1 -s -r -p "Press any key to close this window..."
    exit 1
  fi
done

URL="http://localhost:$PORT/"

echo "================================================================"
echo " PDUFA Watchlist dashboard"
echo "================================================================"
echo " Serving:  $(pwd)"
echo " URL:      $URL"
echo " Stop:     Ctrl-C (or just close this Terminal window)"
echo "================================================================"
echo ""

(sleep 1; open "$URL") &

export NEXT_TELEMETRY_DISABLED=1

if command -v npm >/dev/null 2>&1; then
  exec npm run dev -- -H 0.0.0.0 -p "$PORT"
else
  echo "npm was not found. Install Node.js/npm, then run this launcher again."
  echo ""
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi
