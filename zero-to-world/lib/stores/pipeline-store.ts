import { create } from "zustand";
import type { PipelineStage, SceneJSON } from "@/lib/types";

interface PipelineState {
  sessionId: string | null;
  stage: PipelineStage | null;
  percent: number;
  plyUrl: string | null;
  sceneJSON: SceneJSON | null;
  mjcfXml: string | null;
  error: string | null;
  setSession: (id: string) => void;
  setStage: (stage: PipelineStage, percent: number) => void;
  setPlyUrl: (url: string) => void;
  setSceneJSON: (json: SceneJSON) => void;
  setMjcfXml: (xml: string) => void;
  setError: (err: string) => void;
  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  sessionId: null,
  stage: null,
  percent: 0,
  plyUrl: null,
  sceneJSON: null,
  mjcfXml: null,
  error: null,
  setSession: (id) => set({ sessionId: id }),
  setStage: (stage, percent) => set({ stage, percent }),
  setPlyUrl: (url) => set({ plyUrl: url }),
  setSceneJSON: (json) => set({ sceneJSON: json }),
  setMjcfXml: (xml) => set({ mjcfXml: xml }),
  setError: (err) => set({ error: err, stage: "ERROR" }),
  reset: () =>
    set({
      sessionId: null,
      stage: null,
      percent: 0,
      plyUrl: null,
      sceneJSON: null,
      mjcfXml: null,
      error: null,
    }),
}));
