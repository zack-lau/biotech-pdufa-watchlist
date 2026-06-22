import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
NPM = "/opt/homebrew/bin/npm"

os.chdir(ROOT)
os.environ.setdefault("NEXT_TELEMETRY_DISABLED", "1")
os.environ["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
os.execv(NPM, [NPM, "run", "dev", "--", "-H", "0.0.0.0", "-p", "8000"])
