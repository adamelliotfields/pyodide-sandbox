# pyodide-sandbox

Run Python in a sandboxed [WebAssembly](https://webassembly.org) environment powered by [Pyodide](https://pyodide.org). Inspired by Cloudflare [Python Workers](https://developers.cloudflare.com/workers/languages/python/how-python-workers-work/) and the Codex [JavaScript REPL](https://github.com/openai/codex/blob/rust-v0.100.0/docs/js_repl.md).

## Features

- Use familiar packages from the [Pyodide ecosystem](https://pyodide.org/en/stable/usage/packages-in-pyodide.html)
- Install pure-Python packages from PyPI via micropip
- Cache downloaded wheels for fast subsequent runs
- Distributed as a Node [single executable application](https://nodejs.org/api/single-executable-applications.html)

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

The compiled binary includes the Node.js runtime and Pyodide WASM assets. Pyodide files are cached in `/tmp/pyodide` on first run. Downloaded wheels are also cached there. See [examples](./examples/) for more.

```
Usage: pyodide [options] [code]

A Python sandbox powered by Pyodide

Arguments:
  code                    python code to execute

Options:
  --cdn-url <url>         override the default jsDelivr CDN URL
  -e, --env <KEY=VALUE>   set environment variables in the sandbox (default: {})
  --list-packages         list installed Pyodide packages
  -p, --packages <names>  install comma-separated packages before running
  -v, --version           output the version number
  -h, --help              display help for command
```

## Examples

```sh
# Inline code
pyodide 'import sys; print(sys.version)'

# List available Pyodide packages
pyodide --list-packages

# Use packages
pyodide -p numpy,pandas 'import pandas as pd; print(pd.DataFrame({"a": [1,2,3]}))'

# Set environment variables
pyodide -e API_KEY=abc123 -e DEBUG=1 'import os; print(os.environ["API_KEY"])'
```

## Security

While the Python code is sandboxed, Pyodide and Emscripten provide APIs for running arbitrary JavaScript _from_ Python which can easily escape the sandbox.

The `js` module:

```python
import js

child_process = js.process.mainModule.require("child_process")
child_process.execSync("whoami > /tmp/pwned")
```

The `pyodide_js` module:

```python
import pyodide_js

Function = pyodide_js.ffi.constructor.constructor
get_process = Function("return process")
process = get_process()
process.mainModule.require("child_process").execSync("whoami > /tmp/pwned")
```

The `ctypes` module:

```python
import ctypes

libc = ctypes.CDLL(None)
payload = b"process.mainModule.require('child_process').execSync('whoami > /tmp/pwned')"
libc.emscripten_run_script(payload)
```

### Mitigations

We currently use two layers of defense.

The first layer is Node's [Permission Model](https://nodejs.org/api/permissions.html), inspired by [Deno](https://docs.deno.com/runtime/fundamentals/security/#permissions). We block child processes, workers, and addons. We also disable `NODE_OPTIONS` and `--node-options` to prevent users from modifying permissions at runtime.

However, this breaks Pyodide, which calls `process.binding('constants')` during initialization. To work around this, Rolldown copies `pyodide.asm.js` into `dist` and rewrites that call to a static object in [rolldown.config.ts](./rolldown.config.ts).

We only allow filesystem access to `/tmp/*`. We have to use `/tmp/*` because the `/tmp/pyodide` directory hasn't been created yet. Because the permissions must be defined at _build_ time, we can't use a dynamic path like `$XDG_CACHE_HOME` or `~/.cache`. This means an attacker can still read, write, and delete files in `/tmp`.

Why do we need file system access at all? We bundle the runtime assets with the executable, but Pyodide cannot access them directly. Instead, our code has to write them to disk at runtime so Pyodide can load them. In addition to caching the runtime assets, we also cache downloaded wheels to speed up subsequent runs.

The final layer is `globalThis.process`. We provide a minimal stub that satisfies Pyodide's needs and make `process.env` an empty object so it can't be used to leak environment variables.

## Limitations

Most things work, but there are edge cases.

| Area | Works | Doesn't work |
|------|-------|--------------|
| **Data science** | `pandas`, `numpy`, `scikit-learn`, `autograd` | GPU libraries (`torch`, `tensorflow`) |
| **Visualization** | Matplotlib with `Agg` backend | `plt.show()`, `pygfx` (no `wgpu`) |
| **HTTP clients** | `requests`, `httpx`, `pyodide.http.pyfetch` | `urllib` (no `ssl`), `yfinance` (no `curl-cffi`) |
| **Servers** | None | Listening servers (`app.run` blocks) |
| **File I/O** | Host directories via `--mount` | Direct host filesystem access |
| **Concurrency** | Single-threaded code | `multiprocessing`, `threading` |
| **C extensions** | Pyodide-compiled packages | Arbitrary pip wheels with native C code |
| **Subprocess** | None | `subprocess`, `os.system` |

## Performance

There's a ~1s startup cost, and loading packages can add another ~1-2s. There is some WASM overhead, but it's generally fast enough for most use cases.

Anything that relies on optimized linear algebra or SIMD vectorization will be many times slower than native. For example, fitting a 3-layer MLP classifier on the Digits dataset takes ~0.5s natively and ~8.0s in Pyodide. Under the hood, Numpy is using hand-tuned instructions for your CPU that don't exist in WebAssembly.

## Minimum Supported Node Version

Requires [25.5.0](https://github.com/nodejs/node/releases/tag/v25.5.0) or higher for `--build-sea`.

## TODO

- Agent Skill
