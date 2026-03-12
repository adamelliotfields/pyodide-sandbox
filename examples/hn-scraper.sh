#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYODIDE_BIN="${PYODIDE_BIN:-$ROOT_DIR/dist/pyodide}"

if [[ ! -x $PYODIDE_BIN ]] ; then
  echo "error: pyodide binary not found at $PYODIDE_BIN" >&2
  exit 1
fi

"$PYODIDE_BIN" \
-p httpx,beautifulsoup4 \
-c 'import httpx
from bs4 import BeautifulSoup

async with httpx.AsyncClient() as client:
    resp = await client.get("https://news.ycombinator.com")

soup = BeautifulSoup(resp.text, "html.parser")

for row in soup.select(".athing"):
    title_el = row.select_one(".titleline > a")
    if not title_el:
        continue
    title = title_el.text
    link = title_el["href"]

    subtext = row.find_next_sibling("tr")
    score_el = subtext.select_one(".score") if subtext else None
    score = score_el.text if score_el else "0 points"

    print(f"{score:>12s}  {title}")
    print(f"              {link}")
'
