"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { RobotOverlay } from "./robot-overlay";
import type { SceneJSON } from "@/lib/types";

interface SplatViewerProps {
  plyUrl: string;
  sceneJSON?: SceneJSON | null;
  showRobot?: boolean;
  className?: string;
}

export interface SplatViewerHandle {
  capturePano: () => Promise<string[]>;
}

export const SplatViewer = forwardRef<SplatViewerHandle, SplatViewerProps>(
  ({ plyUrl, sceneJSON = null, showRobot = false, className = "" }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<unknown>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [threeScene, setThreeScene] = useState<THREE.Scene | null>(null);

  useImperativeHandle(ref, () => ({
    capturePano: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = viewerRef.current as any;
      if (!v || !v.camera || !v.renderer) return [];

      const frames: string[] = [];
      const cam = v.camera as THREE.PerspectiveCamera;
      const originalPosition = cam.position.clone();
      const originalRotation = cam.rotation.clone();

      const numFrames = 6;
      const radius = 2.0; // 2m orbit ring

      for (let i = 0; i < numFrames; i++) {
        const angle = (i / numFrames) * Math.PI * 2;
        // The splat uses Y=-1 for upright alignment roughly
        cam.position.set(Math.sin(angle) * radius, -1, Math.cos(angle) * radius);
        cam.lookAt(0, -1, 0);
        cam.updateMatrixWorld();

        v.renderer.render(v.threeScene || v.scene, cam);
        frames.push(v.renderer.domElement.toDataURL("image/jpeg", 0.6));

        // Let the javascript runtime breathe
        await new Promise((r) => setTimeout(r, 60));
      }

      // Restore camera state so the user doesn't notice the whip-pan
      cam.position.copy(originalPosition);
      cam.rotation.copy(originalRotation);
      cam.updateMatrixWorld();
      v.renderer.render(v.threeScene || v.scene, cam);

      return frames;
    },
  }));

  useEffect(() => {
    if (!containerRef.current || !plyUrl) return;

    const container = containerRef.current;
    let disposed = false;

    async function init() {
      try {
        // Dynamic import to avoid SSR issues
        const GaussianSplats3D = await import(
          "@mkkellogg/gaussian-splats-3d"
        );

        if (disposed) return;

        const viewer = new GaussianSplats3D.Viewer({
          cameraUp: [0, -1, 0],
          initialCameraPosition: [1, -1, 3],
          initialCameraLookAt: [0, 0, 0],
          rootElement: container,
          selfDrivenMode: true,
          useBuiltInControls: true,
          dynamicScene: false,
          sceneRevealMode: GaussianSplats3D.SceneRevealMode?.Gradual ?? 1,
          sharedMemoryForWorkers: false,
        });

        viewerRef.current = viewer;

        await viewer.addSplatScene(plyUrl, {
          splatAlphaRemovalThreshold: 5,
          showLoadingUI: false,
          progressiveLoad: true,
          onProgress: (percent: number) => {
            if (!disposed) setProgress(Math.round(percent));
          },
        });

        if (!disposed) {
          await viewer.start();
          setLoading(false);

          // Expose the Three.js scene for robot overlay
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const v = viewer as any;
          const scene = v.threeScene as THREE.Scene | undefined ??
            v.scene as THREE.Scene | undefined;
          if (scene) {
            setThreeScene(scene);
          }
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Failed to load splat");
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      disposed = true;
      setThreeScene(null);
      try {
        if (viewerRef.current) {
          const v = viewerRef.current as { dispose?: () => void };
          v.dispose?.();
          viewerRef.current = null;
        }
        if (rendererRef.current) {
          rendererRef.current.dispose();
          rendererRef.current = null;
        }
      } catch {
        // Ignore disposal errors
      }
    };
  }, [plyUrl]);

  if (!plyUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-white/[0.03] rounded-xl border border-white/10 ${className}`}
      >
        <div className="flex flex-col items-center gap-3 text-white/30">
          <div className="text-4xl">🌐</div>
          <p className="text-sm font-mono">Waiting for 3D reconstruction…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl overflow-hidden border border-white/10 ${className}`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Robot overlay — injects meshes into the Three.js scene */}
      <RobotOverlay
        threeScene={threeScene}
        sceneJSON={sceneJSON}
        active={showRobot && !loading && !error}
      />

      {/* Loading overlay */}
      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
            <div
              className="absolute inset-0 rounded-full border-2 border-t-blue-400 border-r-transparent border-b-transparent border-l-transparent animate-spin"
            />
            <div className="absolute inset-2 rounded-full border-2 border-t-transparent border-r-purple-400 border-b-transparent border-l-transparent animate-spin"
              style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
            />
          </div>
          <p className="text-sm font-mono text-white/60">Loading 3D scene…</p>
          <div className="mt-3 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs font-mono text-white/30">{progress}%</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-2 text-center px-6">
            <div className="text-3xl">⚠️</div>
            <p className="text-sm text-red-400 font-mono">{error}</p>
          </div>
        </div>
      )}

      {/* Robot indicator */}
      {showRobot && sceneJSON && !loading && !error && (
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-mono z-10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400/80">Robot Active</span>
          <span className="text-white/30">·</span>
          <span className="text-white/40">{sceneJSON.obstacles.length} obstacles</span>
        </div>
      )}

      {/* Controls hint */}
      {!loading && !error && (
        <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-white/40 font-mono z-10 pointer-events-none animate-fade-out">
          Drag to orbit · Scroll to zoom · Right-drag to pan
        </div>
      )}
    </div>
  );
});
