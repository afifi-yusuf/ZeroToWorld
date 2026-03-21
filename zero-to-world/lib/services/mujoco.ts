import type { SceneJSON } from "@/lib/types";

export function generateMJCF(scene: SceneJSON): string {
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, "_");

  const obstaclesBodies = (scene.obstacles || [])
    .map(
      (o, i) =>
        `    <body name="${sanitize(o.label)}_${i}" pos="${o.x} ${o.y} ${o.height_m / 2}">
      <geom type="box" size="${o.width_m / 2} ${o.depth_m / 2} ${o.height_m / 2}" rgba="0 0 0 0"/>
    </body>`
    )
    .join("\n");

  return `<mujoco model="zero-to-world-hackathon-room">
  <!-- The Unitree G1 Humanoid robot - loaded from MuJoCo Menagerie -->
  <include file="mujoco_menagerie/unitree_g1/g1.xml"/>

  <!-- Headless Renderer needs explicit headlight; trackcom aimed at whole-model COM misses the robot when the floor dominates. -->
  <visual>
    <headlight diffuse="0.9 0.9 0.9" ambient="0.25 0.25 0.25" specular="0.4 0.4 0.4"/>
    <global azimuth="120" elevation="-25"/>
  </visual>
  <statistic center="0 0 0.9" extent="1.8"/>

  <worldbody>
    <camera name="track" pos="2.8 -2.8 1.35" mode="targetbody" target="pelvis" fovy="50"/>

    <!-- Floor plane -->
    <geom name="floor" type="plane" size="${scene.floor.width_m / 2} ${scene.floor.depth_m / 2} 0.1" pos="0 0 0" rgba="0 0 0 0"/>
    
    <!-- Obstacles -->
${obstaclesBodies}

    <!-- Goal Marker -->
    <site name="target" pos="${scene.navigation_goal.x} ${scene.navigation_goal.y} 0.1" size="0.2" rgba="1 0 0 0.8"/>
  </worldbody>
</mujoco>`;
}

// Busted Turbopack Cache
