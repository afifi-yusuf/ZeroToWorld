#!/usr/bin/env bash
# Run COLMAP on a capture session produced by relay-server (images/ + optional meta.json).
# Usage:
#   ./scripts/run-colmap.sh path/to/captures/<sessionId>
#   ./scripts/run-colmap.sh <sessionId>   # resolves relay-server/captures/<sessionId> from repo root
#
# Requires: brew install colmap
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INPUT="${1:?Usage: $0 <session-dir-or-id>}"

if [[ -d "$INPUT/images" ]]; then
  SCENE="$(cd "$INPUT" && pwd)"
elif [[ -d "$ROOT/relay-server/captures/$INPUT/images" ]]; then
  SCENE="$(cd "$ROOT/relay-server/captures/$INPUT" && pwd)"
else
  echo "error: no images/ folder found for '$INPUT'" >&2
  echo "  expected: .../captures/<sessionId>/images/*.jpg" >&2
  exit 1
fi

if ! command -v colmap &>/dev/null; then
  echo "error: colmap not found. Install with: brew install colmap" >&2
  exit 1
fi

cd "$SCENE"
IMG_COUNT="$(find images -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | wc -l | tr -d ' ')"
if [[ "$IMG_COUNT" -lt 3 ]]; then
  echo "error: need at least 3 images for COLMAP (found $IMG_COUNT)" >&2
  exit 1
fi

echo "==> COLMAP scene: $SCENE ($IMG_COUNT images)"

DB="database.db"
rm -f "$DB"

# Note: --SiftExtraction.use_gpu / --SiftMatching.use_gpu are not accepted by all COLMAP
# builds (e.g. many Homebrew macOS builds). Omit them — CPU SIFT works fine here.

echo "==> feature_extractor"
colmap feature_extractor \
  --database_path "$DB" \
  --image_path images \
  --ImageReader.camera_model OPENCV \
  --ImageReader.single_camera 1

echo "==> exhaustive_matcher"
colmap exhaustive_matcher \
  --database_path "$DB"

echo "==> mapper"
mkdir -p sparse
colmap mapper \
  --database_path "$DB" \
  --image_path images \
  --output_path sparse

if [[ ! -d sparse/0 ]]; then
  echo "error: mapper did not produce sparse/0 (check image overlap / motion)" >&2
  exit 1
fi

echo "==> done. Sparse model: $SCENE/sparse/0/"
echo "    Next: python3 scripts/train_splat.py \"$SCENE\""
