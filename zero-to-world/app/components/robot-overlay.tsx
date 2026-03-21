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
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setConnecting(true);

    // Initialise WebSocket connection to MuJoCo Python Simulation Server
    const ws = new WebSocket("ws://localhost:8001");
    wsRef.current = ws;

    ws.onopen = () => {
      if (disposed) return;
      setConnecting(false);
      
      const mjcfXml = generateMJCF(sceneJSON);
      
      ws.send(
        JSON.stringify({
          type: "start_sim",
          mjcf_xml: mjcfXml,
          // Extract center (0,0) offset into destination
          goal_pos: [sceneJSON.navigation_goal.x, sceneJSON.navigation_goal.y],
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
            // Match canvas internal resolution to the encoded MuJoCo frame resolution
            if (canvas.width !== img.width) canvas.width = img.width;
            if (canvas.height !== img.height) canvas.height = img.height;
            
            // Draw
            ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden flex items-center justify-center">
      {connecting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white/50 px-3 py-1 rounded-full text-xs font-mono backdrop-blur-sm">
          Connecting to Physics Server...
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain mix-blend-screen"
        style={{ mixBlendMode: "screen" }}
      />
    </div>
  );
}
