"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SplatViewer } from "@/app/components/splat-viewer";
import type { SessionRow } from "@/lib/types";

export default function ViewPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<SessionRow | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/pipeline/status/${sessionId}`);
        if (!res.ok) {
          setFetchError("Session not found");
          return;
        }
        const data: SessionRow = await res.json();
        setSession(data);
      } catch {
        setFetchError("Failed to load session");
      }
    }
    if (sessionId) fetchSession();
  }, [sessionId]);

  return (
    <div className="flex flex-col h-screen bg-[#050508]">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 bg-black/40 backdrop-blur-md border-b border-white/5 z-20">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-xs text-white/40 hover:text-white/70 font-mono transition-colors"
          >
            ← Dashboard
          </a>
          <div className="w-px h-4 bg-white/10" />
          <h1 className="text-sm font-semibold text-white/80 tracking-tight">
            3D World Viewer
          </h1>
        </div>
        <span className="text-xs font-mono text-white/20">
          {sessionId?.slice(0, 8)}
        </span>
      </header>

      {/* Viewer */}
      <main className="flex-1 relative">
        {fetchError ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="text-5xl">🔍</div>
              <p className="text-white/50 text-sm font-mono">{fetchError}</p>
              <a
                href="/"
                className="mt-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 text-sm font-medium transition-colors"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        ) : session?.ply_url ? (
          <SplatViewer
            plyUrl={session.ply_url}
            sceneJSON={session.scene_json}
            showRobot={session.stage === "COMPLETE" || session.stage === "TRAINING" || session.stage === "BUILDING_SIM"}
            className="w-full h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                <div className="absolute inset-0 rounded-full border-2 border-t-blue-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              </div>
              <p className="text-white/40 text-sm font-mono">
                {session
                  ? "3D reconstruction in progress…"
                  : "Loading session…"}
              </p>
            </div>
          </div>
        )}

        {/* Session info pill */}
        {session && (
          <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/5 z-10">
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${
                  session.stage === "COMPLETE"
                    ? "bg-green-500"
                    : session.stage === "ERROR"
                    ? "bg-red-500"
                    : "bg-blue-500 animate-pulse"
                }`}
              />
              <span className="text-xs font-mono text-white/50">
                {session.stage}
              </span>
              {session.scene_json && (
                <>
                  <div className="w-px h-3 bg-white/10" />
                  <span className="text-xs font-mono text-white/30">
                    {session.scene_json.obstacles.length} objects detected
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
