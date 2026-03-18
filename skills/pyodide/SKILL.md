---
name: pyodide
description: Run Python code in a sandboxed WebAssembly environment. Use when the user needs to execute Python safely, test Python snippets, or process files with Python libraries. Triggers include requests to "execute this Python code", "analyze this data with Python", or any task requiring sandboxed Python execution.
---

# Sandboxed Python Execution with pyodide

The `pyodide` CLI runs Python inside a WebAssembly sandbox. It's a single binary with all runtime assets and package wheels embedded.

## Core Workflow

1. **Write Python code** as an inline string or pipe from stdin
2. **Specify packages** if your code needs libraries
3. **Mount directories** if your code needs host filesystem access
4. **Run** via `pyodide`

```sh
# Inline code
pyodide 'import sys; print(sys.version)'

# Pipe from stdin
echo 'print("hello")' | pyodide

# With packages
pyodide -p numpy,pandas 'import pandas as pd; print(pd.DataFrame({"a": [1,2,3]}))'
```

## Command Reference

```
Usage: pyodide [options] [code]

Arguments:
  code                      python code to execute

Options:
  -e, --env <key=value>     set environment variables in the sandbox (repeatable)
  --list-packages           list installed Pyodide packages
  -m, --mount <host:guest>  mount a host directory into the sandbox
  -p, --packages <names>    load comma-separated packages before running
  -v, --version             output the version number
  -h, --help                display help for command
```

## Packages

There are two types of packages:

**Bundled packages** are embedded in the binary. Run `pyodide --list-packages` to see them. These include `numpy`, `pandas`, `pyarrow`, `fastparquet`, `scikit-learn`, `scipy`, `statsmodels`, `autograd`, `xgboost`, `lightgbm`, `nltk`, `tiktoken`, `matplotlib`, `pillow`, `requests`, `httpx`, `beautifulsoup4`, `sqlite3`, `sqlalchemy` and many more.

**PyPI packages** are installed at runtime via micropip. Use these for pure-Python packages not bundled with Pyodide. Prefer bundled when available.

```sh
# Bundled (no network needed)
pyodide -p pandas 'import pandas as pd; print(pd.__version__)'

# From PyPI (requires network access)
pyodide -p humanize 'import humanize; print(humanize.naturalsize(1e9))'

# Mix both
pyodide -p pandas,humanize 'import pandas; import humanize; print("ok")'
```

## Filesystem Access

By default, the sandbox has no access to the host filesystem. To read or write files, mount a host directory with `-m`.

The mount syntax is `host:guest`. If only one path is given, the guest path matches the host path.

```sh
# Mount /tmp at /tmp inside the sandbox
pyodide -m /tmp:/tmp 'import os; print(os.listdir("/tmp"))'

# Mount to a different guest path
pyodide -m /tmp:/data 'import os; print(os.listdir("/data"))'

# Shorthand: mount /tmp at /tmp
pyodide -m /tmp 'open("/tmp/hello.txt", "w").write("hi")'

# Read a CSV
pyodide -m /tmp -p pandas 'import pandas as pd; print(pd.read_csv("/tmp/data.csv").describe())'
```

## Environment Variables

Host environment variables are hidden from the sandbox by default. Some, like `HOME=/home/pyodide`, are set by the runtime. Pass variables explicitly with `-e`:

```sh
pyodide -e API_KEY=abc123 -e DEBUG=1 'import os; print(os.environ["API_KEY"])'
```

## HTTP

Prefer `requests` for most use cases and `httpx` if you require async or HTTP/2.

Note that `urllib.request` and anything that relies on it (like scikit-learn's `fetch_*` loaders or `nltk.download`) won't work. The same applies to `curl-cffi` and anything that relies on it (like `yfinance`).
