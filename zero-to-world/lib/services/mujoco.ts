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
  <!-- The Spot quadruped robot - loaded from MuJoCo Menagerie -->
  <include file="mujoco_menagerie/boston_dynamics_spot/spot.xml"/>
  
  <worldbody>
    <!-- Tracking camera so default viewport doesn't lose Spot -->
    <camera name="track" pos="0 -6 3" mode="trackcom" xyaxes="1 0 0 0 1 2"/>

    <!-- Floor plane -->
    <geom name="floor" type="plane" size="${scene.floor.width_m / 2} ${scene.floor.depth_m / 2} 0.1" pos="0 0 0" rgba="0 0 0 0"/>
    
    <!-- Obstacles -->
${obstaclesBodies}

    <!-- Goal Marker -->
    <site name="target" pos="${scene.navigation_goal.x} ${scene.navigation_goal.y} 0.1" size="0.2" rgba="1 0 0 0.8"/>
  </worldbody>
</mujoco>`;
}

function sanitize(label: string): string {
  return label.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
}
