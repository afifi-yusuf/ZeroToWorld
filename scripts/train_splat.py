#!/usr/bin/env python3
"""
Train 3D Gaussian Splatting on a COLMAP scene using msplat (Metal / Apple Silicon).

Prerequisites:
  - macOS 14+, Apple Silicon
  - Python 3.12+
  - pip install -r scripts/requirements-train.txt
  - COLMAP sparse model at <scene>/sparse/0/ (run scripts/run-colmap.sh first)

Usage:
  python3 scripts/train_splat.py /path/to/relay-server/captures/<sessionId>
  python3 scripts/train_splat.py /path/to/relay-server/captures/<sessionId> --iterations 7000 --output exports/out.ply
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser(description="msplat training for COLMAP captures")
    p.add_argument(
        "scene_dir",
        type=Path,
        help="Directory containing images/ and sparse/0/ (COLMAP output)",
    )
    p.add_argument("--iterations", type=int, default=7000, help="Training iterations")
    p.add_argument(
        "--num-downscales",
        type=int,
        default=0,
        help="msplat downscale levels (0 = full res, slower but sharper)",
    )
    p.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output .ply path (default: <scene_dir>/exports/gaussians.ply)",
    )
    p.add_argument("--eval", action="store_true", help="Enable eval split (msplat)")
    args = p.parse_args()

    scene = args.scene_dir.resolve()
    images = scene / "images"
    sparse0 = scene / "sparse" / "0"
    if not images.is_dir():
        print(f"error: missing images dir: {images}", file=sys.stderr)
        return 1
    if not sparse0.is_dir():
        print(f"error: missing COLMAP sparse/0: {sparse0}", file=sys.stderr)
        print("  Run: ./scripts/run-colmap.sh <session>", file=sys.stderr)
        return 1

    try:
        import msplat
    except ImportError:
        print("error: msplat not installed.", file=sys.stderr)
        print("  pip install -r scripts/requirements-train.txt", file=sys.stderr)
        return 1

    out = args.output
    if out is None:
        exports = scene / "exports"
        exports.mkdir(parents=True, exist_ok=True)
        out = exports / "gaussians.ply"
    else:
        out = out.resolve()
        out.parent.mkdir(parents=True, exist_ok=True)

    print(f"==> scene: {scene}")
    print(f"==> iterations={args.iterations} num_downscales={args.num_downscales}")

    dataset = msplat.load_dataset(str(scene), eval_mode=args.eval)
    config = msplat.TrainingConfig(
        iterations=args.iterations,
        num_downscales=args.num_downscales,
    )
    trainer = msplat.GaussianTrainer(dataset, config)

    def cb(s) -> None:
        print(f"  step={s.iteration} splats={s.splat_count:,}")

    trainer.train(cb, callback_every=max(1, args.iterations // 20))
    trainer.export_ply(str(out))
    print(f"==> exported: {out}")

    if args.eval:
        metrics = trainer.evaluate()
        print(f"==> metrics: {metrics}")
    else:
        print("==> metrics skipped (train with --eval for a test split and PSNR/SSIM)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
