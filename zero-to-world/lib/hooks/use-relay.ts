"use client";

import { useEffect, useRef } from "react";
import { usePipelineStore } from "@/lib/stores/pipeline-store";

export function useRelay() {
  const addFrame = usePipelineStore((s) => s.addFrame);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_RELAY_WS_URL;
    if (!url) return;

    const ws = new WebSocket(`${url}/ws/frames`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "frame" && msg.data) {
          addFrame(msg.data);
        }
      } catch {
        // Binary frame — treat as raw base64
        if (typeof event.data === "string") {
          addFrame(event.data);
        }
      }
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => {
      ws.close();
    };
  }, [addFrame]);
}
