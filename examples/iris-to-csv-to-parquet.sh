#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYODIDE_BIN="${PYODIDE_BIN:-$ROOT_DIR/dist/pyodide}"

if [[ ! -x $PYODIDE_BIN ]] ; then
  echo "error: pyodide binary not found at $PYODIDE_BIN" >&2
  exit 1
fi

mkdir -p /tmp/pyodide-examples

"$PYODIDE_BIN" \
-p scikit-learn,pandas,pyarrow \
'from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from sklearn.datasets import load_iris

csv_path = Path("/tmp/pyodide-examples/iris.csv")
parquet_path = Path("/tmp/pyodide-examples/iris.parquet")

iris = load_iris(as_frame=True)
df = iris.frame.rename(columns={"target": "species_id"})
df["species"] = df["species_id"].map(dict(enumerate(iris.target_names)))

df.to_csv(csv_path, index=False)
csv_df = pd.read_csv(csv_path)
pq.write_table(pa.Table.from_pandas(csv_df), parquet_path)

print(f"wrote {csv_path.name}")
print(f"wrote {parquet_path.name}")
'
