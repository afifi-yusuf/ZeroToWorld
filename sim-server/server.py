#!/usr/bin/env python3
"""
MuJoCo WebSocket server for ZeroToWorld (matches zero-to-world/app/components/robot-overlay.tsx).

Python: use 3.11 or 3.12. The `mujoco` PyPI package ships wheels for those versions; 3.14+
triggers a source build that requires MUJOCO_PATH and the C library (see deepmind/mujoco releases).

Run:
  cd sim-server
  python3.12 -m venv .venv && source .venv/bin/activate   # or 3.11
  pip install -r requirements.txt
  git clone https://github.com/google-deepmind/mujoco_menagerie.git
  python server.py

Or set MUJOCO_MENAGERIE to an existing menagerie checkout path.

Env:
  MUJOCO_MENAGERIE — path to mujoco_menagerie repo (default: ./mujoco_menagerie next to this file)
  MUJOCO_PORT — default 8001
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import math
import os
import re
import uuid
from pathlib import Path

import mujoco
import numpy as np
import websockets

try:
    import cv2
except ImportError:
    cv2 = None

logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger("mujoco-ws")

SIM_DIR = Path(__file__).resolve().parent
DEFAULT_MENAGERIE = SIM_DIR / "mujoco_menagerie"


def resolve_menagerie_path() -> Path:
    raw = os.environ.get("MUJOCO_MENAGERIE", str(DEFAULT_MENAGERIE))
    return Path(raw).expanduser().resolve()


def resolve_mjcf_includes(xml: str, menagerie: Path) -> str:
    """Turn mujoco_menagerie/... includes into absolute paths."""
    prefix = "mujoco_menagerie/"
    if prefix not in xml:
        return xml
    if not menagerie.is_dir():
        raise FileNotFoundError(
            f"MuJoCo Menagerie not found at {menagerie}. "
            f"Clone: git clone https://github.com/google-deepmind/mujoco_menagerie.git {menagerie}"
        )
    return xml.replace(prefix, f"{menagerie.as_posix()}/")


def write_scene_next_to_g1(xml: str, menagerie: Path) -> Path:
    """
    g1.xml uses <compiler meshdir="assets"/>; mesh paths are relative to g1.xml's directory.
    Loading the composite scene from /tmp breaks that. Write the scene under unitree_g1/
    and use <include file="g1.xml"/> so assets resolve to unitree_g1/assets/.
    """
    g1_dir = menagerie / "unitree_g1"
    if not (g1_dir / "g1.xml").is_file():
        raise FileNotFoundError(
            f"Expected {g1_dir / 'g1.xml'}. Clone menagerie or set MUJOCO_MENAGERIE."
        )
    assets = g1_dir / "assets"
    if not assets.is_dir():
        raise FileNotFoundError(
            f"Missing G1 meshes at {assets}. Run: cd {menagerie} && git submodule update --init --recursive "
            "or re-clone menagerie (STL files live in unitree_g1/assets/)."
        )

    # Normalize include to same-directory g1.xml (was absolute .../unitree_g1/g1.xml)
    xml2 = re.sub(
        r'<include\s+file="[^"]*unitree_g1/g1\.xml"\s*/>',
        '<include file="g1.xml"/>',
        xml,
        count=1,
    )
    if 'file="g1.xml"' not in xml2:
        raise ValueError(
            "MJCF must include unitree_g1/g1.xml once; could not rewrite include for meshdir fix."
        )

    scene_path = g1_dir / f"_ztw_runtime_{uuid.uuid4().hex}.mjcf"
    scene_path.write_text(xml2, encoding="utf-8")
    return scene_path


def jpeg_data_url(rgb: np.ndarray, quality: int = 72) -> str:
    if cv2 is not None:
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if ok:
            return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")
    # Fallback: raw PNG via PIL if cv2 missing (unlikely)
    from io import BytesIO

    try:
        from PIL import Image
    except ImportError as e:
        raise RuntimeError("Install opencv-python-headless for JPEG encoding") from e
    im = Image.fromarray(rgb)
    bio = BytesIO()
    im.save(bio, format="JPEG", quality=quality)
    return "data:image/jpeg;base64," + base64.b64encode(bio.getvalue()).decode("ascii")


def rgba_overlay_png_data_url(rgb: np.ndarray) -> str:
    """
    MuJoCo RGB -> RGBA PNG with alpha=0 only on near-black framebuffer void (not on the robot).
    Composites full-screen over the splat in the browser.
    """
    x = np.asarray(rgb, dtype=np.uint8)
    h, w, _ = x.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., :3] = x
    # Offscreen background ~black; allow a few levels of noise from the GL pipeline.
    void = np.max(x, axis=-1) < 30
    rgba[..., 3] = np.where(void, 0, 255)

    if cv2 is not None:
        bgra = cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA)
        ok, buf = cv2.imencode(
            ".png", bgra, [int(cv2.IMWRITE_PNG_COMPRESSION), 3]
        )
        if ok:
            return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode(
                "ascii"
            )

    from io import BytesIO

    from PIL import Image

    bio = BytesIO()
    Image.fromarray(rgba, "RGBA").save(bio, format="PNG", compress_level=4)
    return "data:image/png;base64," + base64.b64encode(bio.getvalue()).decode("ascii")


def apply_spawn_and_keyframe(model: mujoco.MjModel, data: mujoco.MjData, spawn_x: float, spawn_y: float) -> None:
    """Reset to keyframe 0 if present, then place free-base at spawn (G1: first 7 qpos = pos + quat wxyz)."""
    if model.nkey > 0:
        mujoco.mj_resetDataKeyframe(model, data, 0)
    else:
        mujoco.mj_resetData(model, data)

    if model.nq >= 7:
        data.qpos[0] = float(spawn_x)
        data.qpos[1] = float(spawn_y)
    mujoco.mj_forward(model, data)


async def handler(websocket):
    LOG.info("Client connected: %s", websocket.remote_address)
    scene_path: Path | None = None
    try:
        msg = await websocket.recv()
        payload = json.loads(msg)

        if payload.get("type") != "start_sim":
            return

        mjcf_xml = payload.get("mjcf_xml")
        goal_pos = payload.get("goal_pos")
        spawn = payload.get("robot_spawn") or {}
        spawn_x = float(spawn.get("x", 0.0))
        spawn_y = float(spawn.get("y", 0.0))

        if not mjcf_xml or goal_pos is None or len(goal_pos) < 2:
            await websocket.send(json.dumps({"error": "Missing mjcf_xml or goal_pos"}))
            return

        menagerie = resolve_menagerie_path()
        resolved = resolve_mjcf_includes(mjcf_xml, menagerie)
        scene_path = write_scene_next_to_g1(resolved, menagerie)

        LOG.info("Loading model from %s", scene_path)
        model = mujoco.MjModel.from_xml_path(str(scene_path))
        data = mujoco.MjData(model)

        apply_spawn_and_keyframe(model, data, spawn_x, spawn_y)
        key_qpos = np.array(data.qpos, copy=True)

        cam_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_CAMERA, "track")
        cam_arg = cam_id if cam_id >= 0 else -1

        height, width = 480, 640
        renderer = mujoco.Renderer(model, height=height, width=width)

        goal = np.array([float(goal_pos[0]), float(goal_pos[1])], dtype=np.float64)

        max_steps = 8000
        frame_stride = 4

        # Kinematic playback: do not mj_step. Resetting qpos each frame while stepping
        # dynamics fights the solver and blows up (NaN QACC). We hold the keyframe pose,
        # slide root XY toward the goal, mj_forward only for rendering.
        root_xy = np.array([float(key_qpos[0]), float(key_qpos[1])], dtype=np.float64)

        for step in range(max_steps):
            data.qpos[:] = key_qpos
            to_goal = goal - root_xy
            dist = float(np.linalg.norm(to_goal))

            if dist > 0.02:
                delta = to_goal / max(dist, 1e-6) * min(0.012, dist)
                root_xy[0] += float(delta[0])
                root_xy[1] += float(delta[1])

            data.qpos[0] = root_xy[0]
            data.qpos[1] = root_xy[1]

            if model.nq > 7:
                w = 0.025 * math.sin(step * 0.14)
                ang = np.linspace(0, 6.28, model.nq - 7, endpoint=False) + step * 0.07
                data.qpos[7:] = key_qpos[7:] + w * np.sin(ang)

            data.qvel[:] = 0
            data.ctrl[:] = 0
            if hasattr(data, "act") and data.act.size > 0:
                data.act[:] = 0

            mujoco.mj_forward(model, data)

            if step % frame_stride == 0:
                renderer.update_scene(data, camera=cam_arg)
                rgb = renderer.render()
                await websocket.send(
                    json.dumps(
                        {
                            "type": "frame",
                            "image": rgba_overlay_png_data_url(rgb),
                            "step": step,
                            "pos": [float(data.qpos[0]), float(data.qpos[1])],
                            "goal_dist": dist,
                        }
                    )
                )
                await asyncio.sleep(0.001)

        await websocket.send(json.dumps({"type": "complete"}))

    except websockets.exceptions.ConnectionClosed:
        LOG.info("Client disconnected")
    except FileNotFoundError as e:
        LOG.error("%s", e)
        try:
            await websocket.send(json.dumps({"error": str(e)}))
        except Exception:
            pass
    except Exception as e:
        LOG.exception("Simulation error")
        try:
            await websocket.send(json.dumps({"error": str(e)}))
        except Exception:
            pass
    finally:
        if scene_path is not None:
            try:
                scene_path.unlink(missing_ok=True)
            except OSError:
                pass


async def main():
    port = int(os.environ.get("MUJOCO_PORT", "8001"))
    LOG.info("Serving MuJoCo WebSocket on ws://0.0.0.0:%s", port)
    LOG.info("Menagerie path: %s", resolve_menagerie_path())
    async with websockets.serve(handler, "0.0.0.0", port, max_size=50 * 1024 * 1024):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
