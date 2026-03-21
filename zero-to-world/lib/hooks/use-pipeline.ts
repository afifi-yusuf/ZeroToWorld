"use client";

import { useEffect, useRef } from "react";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import type { SessionRow } from "@/lib/types";

export function usePipeline(sessionId: string | null) {
  const { stage, setStage, setPlyUrl, setSceneJSON, setMjcfXml, setError } =
    usePipelineStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/pipeline/status/${sessionId}`);
        if (!res.ok) return;
        const data: SessionRow = await res.json();
        setStage(data.stage, data.percent);
        if (data.ply_url) setPlyUrl(data.ply_url);
        if (data.scene_json) setSceneJSON(data.scene_json);
        if (data.mjcf_xml) setMjcfXml(data.mjcf_xml);
        if (data.error) setError(data.error);
      } catch {
        // ignore fetch errors during polling
      }
    };

    // Initial fetch
    poll();

    // Poll every 2s while pipeline is running; stop when complete or errored
    intervalRef.current = setInterval(() => {
      const current = usePipelineStore.getState().stage;
      if (current === "COMPLETE" || current === "ERROR") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      poll();
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId, setStage, setPlyUrl, setSceneJSON, setMjcfXml, setError]);
}
