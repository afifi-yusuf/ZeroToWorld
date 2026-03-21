import type { SceneJSON } from "@/lib/types";

export function generateMJCF(scene: SceneJSON): string {
  const obstaclesBodies = scene.obstacles
    .map(
      (o, i) =>
        `    <body name="${sanitize(o.label)}_${i}" pos="${o.x} ${o.y} ${o.height_m / 2}">
      <geom type="box" size="${o.width_m / 2} ${o.depth_m / 2} ${o.height_m / 2}" rgba="0.6 0.6 0.6 1" contype="1" conaffinity="1"/>
    </body>`
    )
    .join("\n");

  const wallBodies = scene.walls
    .map(
      (w, i) =>
        `    <body name="wall_${i}" pos="${w.x} ${w.y} ${w.height / 2}">
      <geom type="box" size="${w.width / 2} 0.05 ${w.height / 2}" rgba="0.8 0.8 0.8 1" contype="1" conaffinity="1"/>
    </body>`
    )
    .join("\n");

  return `<mujoco model="zero-to-world">
  <option gravity="0 0 -9.81" timestep="0.002"/>
  <asset>
    <texture type="2d" name="grid" builtin="checker" width="512" height="512" rgb1="0.2 0.3 0.4" rgb2="0.3 0.4 0.5"/>
    <material name="floor_mat" texture="grid" texrepeat="8 8"/>
  </asset>
  <worldbody>
    <light pos="0 0 4" dir="0 0 -1" diffuse="1 1 1"/>
    <geom name="floor" type="plane" size="${scene.floor_plane.width_m / 2} ${scene.floor_plane.depth_m / 2} 0.1" material="floor_mat" contype="1" conaffinity="1"/>
${wallBodies}
${obstaclesBodies}
    <body name="robot" pos="0 0 0.15">
      <joint name="robot_x" type="slide" axis="1 0 0" damping="2.0"/>
      <joint name="robot_y" type="slide" axis="0 1 0" damping="2.0"/>
      <geom type="capsule" size="0.08 0.12" rgba="0.2 0.7 0.3 1" mass="5" contype="1" conaffinity="1"/>
      <site name="robot_site" pos="0 0 0" size="0.02"/>
    </body>
    <body name="target" pos="1 1 0.01" mocap="true">
      <geom type="cylinder" size="0.1 0.005" rgba="1.0 0.2 0.2 0.5" contype="0" conaffinity="0"/>
      <site name="target_site" pos="0 0 0" size="0.02"/>
    </body>
  </worldbody>
  <actuator>
    <motor name="motor_x" joint="robot_x" gear="1" ctrlrange="-1 1" ctrllimited="true"/>
    <motor name="motor_y" joint="robot_y" gear="1" ctrlrange="-1 1" ctrllimited="true"/>
  </actuator>
  <sensor>
    <jointpos name="robot_pos_x" joint="robot_x"/>
    <jointpos name="robot_pos_y" joint="robot_y"/>
    <jointvel name="robot_vel_x" joint="robot_x"/>
    <jointvel name="robot_vel_y" joint="robot_y"/>
  </sensor>
</mujoco>`;
}

function sanitize(label: string): string {
  return label.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
}
