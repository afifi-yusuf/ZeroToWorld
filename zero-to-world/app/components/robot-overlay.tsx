"use client";

import { useEffect, useRef, useState } from "react";
import type { SceneJSON } from "@/lib/types";
import { generateMJCF } from "@/lib/services/mujoco";

interface RobotOverlayProps {
  /** The Three.js scene (kept for signature compatibility but unused in overlay mode) */
  threeScene: unknown;
  sceneJSON: SceneJSON | null;
  active: boolean;
}

/**
 * Replaces the mock ThreeJS logic with an explicit WebSocket canvas overlay connecting
 * to the Python Headless MuJoCo Simulation server.
 */
export function RobotOverlay({ sceneJSON, active }: RobotOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!active || !sceneJSON || !canvasRef.current) return;

    let disposed = false;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    setConnecting(true);

    const wsUrl =
      process.env.NEXT_PUBLIC_MUJOCO_WS_URL || "ws://localhost:8001";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (disposed) return;
      setConnecting(false);
      
      const mjcfXml = generateMJCF(sceneJSON);
      
      ws.send(
        JSON.stringify({
          type: "start_sim",
          mjcf_xml: mjcfXml,
          goal_pos: [sceneJSON.navigation_goal.x, sceneJSON.navigation_goal.y],
          robot_spawn: {
            x: sceneJSON.robot_spawn.x,
            y: sceneJSON.robot_spawn.y,
          },
        })
      );
    };

    ws.onmessage = (event) => {
      if (disposed) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "frame" && data.image) {
          const img = new Image();
          img.onload = () => {
            if (disposed) return;
            if (canvas.width !== img.width) canvas.width = img.width;
            if (canvas.height !== img.height) canvas.height = img.height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // PNG from server: alpha=0 outside robot (chroma from dark void -> green -> keyed)
            ctx.drawImage(img, 0, 0);
          };
          img.src = data.image;
        } else if (data.error) {
          console.error("MuJoCo Server Error:", data.error);
        }
      } catch (err) {
        // Ignore JSON parse errors for non-frame messages
      }
    };

    ws.onclose = () => {
      if (!disposed) setConnecting(false);
    };

    return () => {
      disposed = true;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [active, sceneJSON]);

  if (!active || !sceneJSON) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center bg-transparent">
      {connecting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white/50 px-3 py-1 rounded-full text-xs font-mono backdrop-blur-sm">
          Connecting to Physics Server...
        </div>
      )}
      {/* Full-screen composited over splat: PNG alpha from sim-server (robot only, rest transparent) */}
      <canvas
        ref={canvasRef}
        className="max-h-full max-w-full object-contain"
        aria-hidden
      />
    </div>
  );
}
