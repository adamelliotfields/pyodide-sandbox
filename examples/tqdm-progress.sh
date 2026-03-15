#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYODIDE_BIN="${PYODIDE_BIN:-$ROOT_DIR/dist/pyodide}"

if [[ ! -x $PYODIDE_BIN ]] ; then
  echo "error: pyodide binary not found at $PYODIDE_BIN" >&2
  exit 1
fi

"$PYODIDE_BIN" \
-p tqdm \
'import time
from tqdm import tqdm

tqdm.monitor_interval = 0  # disable background monitor thread as we are single threaded
for i in tqdm(range(50), desc="Processing"):
    time.sleep(0.02)

print("Done!")
'
