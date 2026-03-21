"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RobotOverlay } from "./robot-overlay";
import type { SceneJSON } from "@/lib/types";

interface SceneViewerProps {
  sceneJSON: SceneJSON;
  className?: string;
}

/**
 * Standalone 3D viewer that renders the MuJoCo scene (floor, obstacles, robot)
 * without needing a .ply gaussian splat. Used as fallback when no .ply is available.
 */
export function SceneViewer({ sceneJSON, className = "" }: SceneViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const frameRef = useRef<number>(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x0a0a12, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a12, 8, 20);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      50
    );
    camera.position.set(3, 4, 5);
    camera.lookAt(0, 0, 0);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1;

    // Floor
    const { floor: floorSpec } = sceneJSON;
    const floorGeo = new THREE.PlaneGeometry(floorSpec.width_m, floorSpec.depth_m);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.8,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Lighting
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(3, 5, 3);
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0x4466ff, 0.5, 10);
    pointLight.position.set(-2, 3, -1);
    scene.add(pointLight);

    setReady(true);

    // Render loop
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Resize observer
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      sceneRef.current = null;
      rendererRef.current = null;
      setReady(false);
    };
  }, [sceneJSON]);

  return (
    <div className={`relative rounded-xl overflow-hidden border border-white/10 ${className}`}>
      <div ref={containerRef} className="w-full h-full" />

      <RobotOverlay
        threeScene={ready ? sceneRef.current : null}
        sceneJSON={sceneJSON}
        active={ready}
      />

      {/* Robot indicator */}
      {ready && (
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-mono z-10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400/80">Robot Navigating</span>
          <span className="text-white/30">·</span>
          <span className="text-white/40">{sceneJSON.obstacles.length} obstacles</span>
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-white/40 font-mono z-10 pointer-events-none">
        Drag to orbit · Scroll to zoom
      </div>
    </div>
  );
}
