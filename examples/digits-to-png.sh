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
-p scikit-learn,matplotlib \
'from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.datasets import load_digits

png_path = Path("/tmp/pyodide-examples/digits.png")

digits = load_digits()
images = []
labels = []
for digit in range(10):
  index = int((digits.target == digit).nonzero()[0][0])
  images.append(digits.images[index])
  labels.append(digit)

fig, axes = plt.subplots(2, 5, figsize=(7, 3))
fig.suptitle("scikit-learn load_digits 0-9", fontsize=12)

for ax, image, label in zip(axes.flat, images, labels):
  ax.imshow(image, cmap="gray_r", interpolation="bilinear")
  ax.set_title(str(label), fontsize=9)
  ax.axis("off")

fig.tight_layout()
fig.savefig(png_path, bbox_inches="tight", pad_inches=0.3)
plt.close(fig)

print(f"wrote {png_path.name}")
'
