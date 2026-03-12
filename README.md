# pyodide-sandbox

A command-line tool for running Python in a sandboxed [WebAssembly](https://webassembly.org) environment powered by [Pyodide](https://pyodide.org). Inspired by Cloudflare [Python Workers](https://developers.cloudflare.com/workers/languages/python/how-python-workers-work/) and the Codex [JavaScript REPL](https://github.com/openai/codex/blob/rust-v0.100.0/docs/js_repl.md).

## Features

- No host file system access by default
- Use familiar packages from the [Pyodide ecosystem](https://pyodide.org/en/stable/usage/packages-in-pyodide.html)
- Install pure-Python packages from PyPI via micropip
- Cache downloaded wheels for fast subsequent runs
- Optionally mount directories for file I/O
- Serve an xterm.js REPL for browser access

## Installation

There are no pre-built binaries, but compilation only takes a few seconds.

```sh
gh repo clone adamelliotfields/pyodide-sandbox
cd pyodide-sandbox
npm install
npm run build
sudo cp -a dist/pyodide /usr/local/bin  # or ~/.local/bin
```

## Usage

The compiled binary includes the Node.js runtime and Pyodide WASM assets. Pyodide files are cached in `$XDG_CACHE_HOME/pyodide` on first run. Downloaded wheels are also cached there. See [examples](./examples/) for more.

```sh
# Inline code
pyodide -c 'import sys; print(sys.version)'

# Run a file
pyodide -f script.py

# List available Pyodide packages
pyodide --list-packages

# Use packages
pyodide -p numpy,pandas -c 'import pandas as pd; print(pd.DataFrame({"a": [1,2,3]}))'

# Set environment variables
pyodide -e API_KEY=abc123 -e DEBUG=1 -c 'import os; print(os.environ["API_KEY"])'

# Mount a host directory
pyodide -m ./data:/data -f data_analysis.py

# Start a browser REPL on port 8080
pyodide serve --port 8080
```

## Motivation

Sometimes I need to run a Python script that depends on packages like Pandas, but I don't want to set up a virtual environment. I could use `uv run --with <packages> script.py`, but that is for _trusted_ code. I could run an ephemeral container, but I haven't installed Docker on my machines in years.

## Limitations

Most things work, but there are edge cases.

| Area | Works | Doesn't work |
|------|-------|--------------|
| **Data science** | pandas, numpy, statsmodels, scikit-learn, autograd | GPU libraries (torch, tensorflow) |
| **Visualization** | matplotlib with `Agg` backend using `savefig()` | `plt.show()` or any interactive/GUI backend |
| **HTTP clients** | `requests`, `httpx`, `urllib3`, `pyodide.http.pyfetch` | `urllib.request` (no `ssl` module in WASM) |
| **Servers** | None | Listening servers (`app.run` blocks the event loop) |
| **File I/O** | Host directories via `--mount` | Direct host filesystem access |
| **Concurrency** | Single-threaded code | `multiprocessing`, `threading` |
| **C extensions** | Pyodide-compiled packages (see `--list-packages`) | Arbitrary pip wheels with native C code |
| **Subprocess** | None | `subprocess`, `os.system` |

## Performance

There's a ~1s startup cost, and loading packages can add another ~1-2s. There is some WASM overhead, but it's generally fast enough for most use cases.

Anything that relies on optimized linear algebra or SIMD vectorization will be many times slower than native. For example, fitting a 3-layer MLP classifier on the Digits dataset takes ~0.5s natively and ~8.0s in Pyodide. Under the hood, Numpy is using hand-tuned instructions for your CPU that don't exist in WebAssembly.

## Minimum Supported Node Version

Requires [25.5.0](https://github.com/nodejs/node/releases/tag/v25.5.0) or higher for `--build-sea`.

## TODO

- Agent Skill
- MCP Server
