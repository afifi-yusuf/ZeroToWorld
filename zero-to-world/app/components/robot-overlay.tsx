"use client";

import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import type { SceneJSON } from "@/lib/types";

interface RobotOverlayProps {
  /** The Three.js scene from the splat viewer to add meshes into */
  threeScene: THREE.Scene | null;
  sceneJSON: SceneJSON | null;
  active: boolean;
}

/**
 * Adds a robot capsule, obstacle wireframes, floor grid, and target marker
 * into the provided Three.js scene, then animates the robot navigating
 * between waypoints.
 */
export function RobotOverlay({ threeScene, sceneJSON, active }: RobotOverlayProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const robotRef = useRef<THREE.Group | null>(null);
  const targetRef = useRef<THREE.Mesh | null>(null);
  const pathLineRef = useRef<THREE.Line | null>(null);
  const animFrameRef = useRef<number>(0);
  const waypointIndexRef = useRef(0);
  const progressRef = useRef(0);

  // Generate waypoints that avoid obstacles
  const waypoints = useMemo(() => {
    if (!sceneJSON) return [];
    const { floor_plane, obstacles } = sceneJSON;
    const hw = floor_plane.width_m / 2;
    const hd = floor_plane.depth_m / 2;
    const margin = 0.3;

    // Generate a set of candidate waypoints around the floor
    const candidates: THREE.Vector2[] = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(hw - margin, hd - margin),
      new THREE.Vector2(-(hw - margin), hd - margin),
      new THREE.Vector2(-(hw - margin), -(hd - margin)),
      new THREE.Vector2(hw - margin, -(hd - margin)),
      new THREE.Vector2(hw * 0.5, 0),
      new THREE.Vector2(-hw * 0.5, 0),
      new THREE.Vector2(0, hd * 0.5),
      new THREE.Vector2(0, -hd * 0.5),
    ];

    // Filter out waypoints that collide with obstacles
    const safe = candidates.filter((wp) => {
      return !obstacles.some((obs) => {
        const dx = Math.abs(wp.x - obs.x);
        const dy = Math.abs(wp.y - obs.y);
        return dx < obs.width_m / 2 + 0.2 && dy < obs.depth_m / 2 + 0.2;
      });
    });

    // If too few safe points, just use corners
    if (safe.length < 3) {
      return [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(hw * 0.6, hd * 0.6),
        new THREE.Vector2(-hw * 0.6, -hd * 0.6),
        new THREE.Vector2(hw * 0.6, -hd * 0.6),
        new THREE.Vector2(-hw * 0.6, hd * 0.6),
      ];
    }

    return safe;
  }, [sceneJSON]);

  // Build the 3D overlay
  useEffect(() => {
    if (!threeScene || !sceneJSON || !active) return;

    const group = new THREE.Group();
    group.name = "robot-overlay";
    groupRef.current = group;

    const { floor_plane, obstacles, walls } = sceneJSON;

    // --- Floor grid ---
    const gridHelper = new THREE.GridHelper(
      Math.max(floor_plane.width_m, floor_plane.depth_m),
      10,
      0x444488,
      0x222244
    );
    gridHelper.position.y = 0.005;
    gridHelper.material.opacity = 0.3;
    gridHelper.material.transparent = true;
    group.add(gridHelper);

    // --- Obstacle wireframes ---
    obstacles.forEach((obs) => {
      const geo = new THREE.BoxGeometry(obs.width_m, obs.height_m, obs.depth_m);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff6644,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(obs.x, obs.height_m / 2, obs.y);
      group.add(mesh);

      // Label sprite
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.roundRect(0, 0, 256, 64, 8);
      ctx.fill();
      ctx.fillStyle = "#ff9966";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.fillText(obs.label, 128, 42);
      const tex = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8 });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(obs.x, obs.height_m + 0.3, obs.y);
      sprite.scale.set(0.8, 0.2, 1);
      group.add(sprite);
    });

    // --- Wall wireframes ---
    walls.forEach((wall) => {
      const geo = new THREE.BoxGeometry(wall.width, wall.height, 0.1);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x6688aa,
        wireframe: true,
        transparent: true,
        opacity: 0.2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(wall.x, wall.height / 2, wall.y);
      group.add(mesh);
    });

    // --- Robot (green capsule, matching MJCF: radius 0.08, half-height 0.12) ---
    const robotGroup = new THREE.Group();
    robotGroup.name = "robot";

    // Capsule body
    const capsuleGeo = new THREE.CapsuleGeometry(0.08, 0.24, 8, 16);
    const capsuleMat = new THREE.MeshStandardMaterial({
      color: 0x33bb55,
      emissive: 0x115522,
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
      opacity: 0.9,
    });
    const capsule = new THREE.Mesh(capsuleGeo, capsuleMat);
    capsule.position.y = 0.2; // sit on floor
    robotGroup.add(capsule);

    // Direction indicator (small cone pointing forward)
    const coneGeo = new THREE.ConeGeometry(0.04, 0.1, 8);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x88ff88, emissive: 0x226622 });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(0, 0.2, 0.12);
    robotGroup.add(cone);

    // Glow ring at base
    const ringGeo = new THREE.RingGeometry(0.1, 0.14, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x33ff66,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    robotGroup.add(ring);

    robotGroup.position.set(0, 0, 0);
    robotRef.current = robotGroup;
    group.add(robotGroup);

    // --- Target marker (red pulsing cylinder) ---
    const targetGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.01, 32);
    const targetMat = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.6,
    });
    const target = new THREE.Mesh(targetGeo, targetMat);
    target.position.set(1, 0.01, 1);
    targetRef.current = target;
    group.add(target);

    // Target glow ring
    const tRingGeo = new THREE.RingGeometry(0.12, 0.18, 32);
    const tRingMat = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const tRing = new THREE.Mesh(tRingGeo, tRingMat);
    tRing.rotation.x = -Math.PI / 2;
    tRing.position.y = 0.02;
    target.add(tRing);

    // --- Path line ---
    const pathGeo = new THREE.BufferGeometry();
    const pathMat = new THREE.LineBasicMaterial({
      color: 0x33ff66,
      transparent: true,
      opacity: 0.3,
    });
    const pathLine = new THREE.Line(pathGeo, pathMat);
    pathLineRef.current = pathLine;
    group.add(pathLine);

    // --- Lighting ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    group.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 4, 2);
    group.add(dirLight);

    threeScene.add(group);

    // Update path line geometry
    if (waypoints.length > 1) {
      const pts = waypoints.map((wp) => new THREE.Vector3(wp.x, 0.02, wp.y));
      pts.push(pts[0].clone()); // close the loop
      pathGeo.setFromPoints(pts);
    }

    // --- Animation loop ---
    waypointIndexRef.current = 0;
    progressRef.current = 0;

    function animate() {
      if (!robotRef.current || waypoints.length < 2) return;

      const speed = 0.005;
      progressRef.current += speed;

      if (progressRef.current >= 1) {
        progressRef.current = 0;
        waypointIndexRef.current = (waypointIndexRef.current + 1) % waypoints.length;
      }

      const fromIdx = waypointIndexRef.current;
      const toIdx = (fromIdx + 1) % waypoints.length;
      const from = waypoints[fromIdx];
      const to = waypoints[toIdx];

      // Smooth easing
      const t = progressRef.current;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const x = from.x + (to.x - from.x) * eased;
      const z = from.y + (to.y - from.y) * eased;

      robotRef.current.position.set(x, 0, z);

      // Face movement direction
      const dx = to.x - from.x;
      const dz = to.y - from.y;
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        robotRef.current.rotation.y = Math.atan2(dx, dz);
      }

      // Slight bobbing
      const bob = Math.sin(Date.now() * 0.005) * 0.01;
      robotRef.current.position.y = bob;

      // Move target to next waypoint
      if (targetRef.current) {
        targetRef.current.position.set(to.x, 0.01, to.y);
        // Pulse the target
        const pulse = 0.6 + Math.sin(Date.now() * 0.004) * 0.2;
        (targetRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
      }

      // Pulse robot ring
      const robotRing = robotRef.current.children[2];
      if (robotRing) {
        const ringPulse = 0.3 + Math.sin(Date.now() * 0.006) * 0.2;
        (robotRing as THREE.Mesh).material = new THREE.MeshBasicMaterial({
          color: 0x33ff66,
          transparent: true,
          opacity: ringPulse,
          side: THREE.DoubleSide,
        });
      }

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (groupRef.current && threeScene) {
        threeScene.remove(groupRef.current);
        // Dispose geometries and materials
        groupRef.current.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
      }
      groupRef.current = null;
      robotRef.current = null;
      targetRef.current = null;
      pathLineRef.current = null;
    };
  }, [threeScene, sceneJSON, active, waypoints]);

  // This component doesn't render any DOM — it injects into the Three.js scene
  return null;
}
