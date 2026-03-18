# pyodide-sandbox

Run Python in a sandboxed [WebAssembly](https://webassembly.org) environment powered by [Pyodide](https://pyodide.org). Inspired by Cloudflare [Python Workers](https://developers.cloudflare.com/workers/languages/python/how-python-workers-work/).

## Features

- All Pyodide runtime assets and wheels embedded in a single binary
- Build-time permission configuration via Node's [Permission Model](https://nodejs.org/api/permissions.html)
- Install pure-Python packages from PyPI via micropip
- Distributed as a Node [single executable application](https://nodejs.org/api/single-executable-applications.html)

## Installation

Because permissions are configured at build time, users build the binary tailored to their security requirements.

The default build downloads all Pyodide wheels, bundles everything into a single executable, and grants no filesystem or network permissions.

```sh
gh repo clone adamelliotfields/pyodide-sandbox
cd pyodide-sandbox
npm install
npm run build
sudo cp -a dist/pyodide /usr/local/bin  # or ~/.local/bin
```

## Configuration

The build is configured via shell variables passed to the `build:cjs` step. Rolldown reads these variables and generates the appropriate `sea-config.json` with the correct Node permission flags.

| Variable | Default | Description |
| --- | --- | --- |
| `ALLOW_NET` | _unset_ | Set to `1` to grant network access (required for micropip) |
| `ALLOW_FS` | _unset_ | A single path to grant filesystem read/write access |

```sh
# Build with network access
ALLOW_NET=1 npm run build

# Build with read/write access to /tmp
ALLOW_FS=/tmp npm run build

# Allow all filesystem access
ALLOW_FS='*' npm run build
```

## Usage

```
Usage: pyodide [options] [code]

A Python sandbox powered by Pyodide

Arguments:
  code                      python code to execute

Options:
  -e, --env <key=value>     set environment variables in the sandbox (default: {})
  --list-packages           list installed Pyodide packages
  -m, --mount <host:guest>  mount a host directory into the sandbox
  -p, --packages <names>    load comma-separated packages before running
  -v, --version             output the version number
  -h, --help                display help for command
```

## Examples

```sh
# Inline code
pyodide 'import sys; print(sys.version)'

# Read from stdin
echo 'print("hello")' | pyodide

# List available packages
pyodide --list-packages

# Use packages
pyodide -p numpy,pandas 'import pandas as pd; print(pd.DataFrame({"a": [1,2,3]}))'

# Set environment variables
pyodide -e API_KEY=abc123 -e DEBUG=1 'import os; print(os.environ["API_KEY"])'
```

### With network access

Requires a build with `ALLOW_NET=1`.

```sh
# Install a pure-Python package from PyPI
pyodide -p humanize 'import humanize; print(humanize.naturalsize(1e9))'
```

### With filesystem access

Requires a build with `ALLOW_FS=/tmp`. The mount syntax is `host:guest`.

> [!NOTE]
> Node's permission model allows multiple paths, but we only support one.

```sh
# Mount a host directory at the same path
pyodide -m /tmp:/tmp 'import os; print(os.listdir("/tmp"))'

# Mount to a different guest path
pyodide -m /tmp:/data 'import os; print(os.listdir("/data"))'

# Read a CSV from the host filesystem using shorthand syntax
pyodide -m /tmp -p pandas 'import pandas as pd; print(pd.read_csv("/tmp/sales.csv").describe())'
```

## Virtual File System

To load files embedded in a SEA binary, you have to use `getAsset()` from the `node:sea` module, not `import()` or `fs.readFile()`.

Because Pyodide is 3rd-party code that is not SEA-aware, it doesn't know to use `getAsset()`, so we have to modify the runtime using a combination of reflection and monkey-patching.

> [!NOTE]
> A proposed `node:vfs` module ([#61478](https://github.com/nodejs/node/pull/61478)) would largely eliminate these workarounds.

### Runtime assets

Since `import()` can't resolve modules embedded in the SEA blob, we load the Pyodide runtime file (`pyodide.asm.js`) as a string using `getAsset()` and execute it with `Script(asset).runInThisContext()` from the `node:vm` module.

### Binary assets

We patch Pyodide's [`node_getBinaryResponse()`](https://github.com/pyodide/pyodide/blob/0.29.3/src/js/compat.ts#L115) to first check a `globalThis.getSeaAsset` hook before falling back to `fs.readFile()`. At runtime, we set `getSeaAsset` to read from the SEA blob.

### Packages

We overwrite the [`packageManager.downloadPackage()`](https://github.com/pyodide/pyodide/blob/0.29.3/src/js/load-package.ts#L447) method to try reading from SEA before falling back to fetching from the jsDelivr CDN.

## Security

While the Python code runs inside a WebAssembly sandbox, Pyodide and Emscripten provide APIs for running arbitrary JavaScript _from_ Python which can escape the sandbox.

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

Node's permission model, inspired by [Deno](https://docs.deno.com/runtime/fundamentals/security/#permissions), blocks child processes, workers, and addons. Filesystem and network access are disabled by default and can be selectively enabled at build time. `NODE_OPTIONS` and `--node-options` are also disabled to prevent modifying permissions at runtime.

Because Pyodide calls `process.binding('constants')` during initialization, which is blocked by the permission model, [Rolldown](./rolldown.config.ts) patches `pyodide.asm.js` at build time to replace that call with static values.

Additionally, `process.env` is overwritten with an empty object at startup so host environment variables can't be read from within the sandbox.

## Compatibility

| Area | Works | Doesn't work |
|------|-------|--------------|
| **Data science** | `pandas`, `numpy`, `scikit-learn`, `autograd` | GPU libraries (`torch`, `tensorflow`) |
| **Visualization** | Matplotlib with `Agg` backend | `plt.show()`, `pygfx` (no `wgpu`) |
| **HTTP clients** | `requests`, `httpx`, `pyodide.http.pyfetch` | `urllib` (no `ssl`), `yfinance` (no `curl-cffi`) |
| **Servers** | None | Listening servers (`app.run` blocks) |
| **Concurrency** | Single-threaded code | `multiprocessing`, `threading` |
| **C extensions** | Pyodide-compiled packages | Arbitrary pip wheels with native C code |
| **Subprocess** | None | `subprocess`, `os.system` |

## Minimum Supported Node Version

Requires [25.5.0](https://github.com/nodejs/node/releases/tag/v25.5.0) or higher for `--build-sea`.
