export interface SceneJSON {
  floor: { width_m: number; depth_m: number };
  ceiling_height_m: number;
  robot_spawn: { x: number; y: number; description: string };
  navigation_goal: { x: number; y: number; description: string };
  obstacles: {
    label: string;
    x: number;
    y: number;
    width_m: number;
    depth_m: number;
    height_m: number;
  }[];
}

export type PipelineStage =
  | "SCANNING"
  | "RECONSTRUCTING"
  | "LABELLING"
  | "BUILDING_SIM"
  | "SIMULATING"
  | "COMPLETE"
  | "ERROR";

export interface SessionRow {
  id: string;
  stage: PipelineStage;
  percent: number;
  ply_url: string | null;
  scene_json: SceneJSON | null;
  mjcf_xml: string | null;
  sim_frames: string[];  // URLs of rendered MuJoCo frames for playback
  created_at: string;
  error: string | null;
}
