"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { usePipelineStore } from "@/lib/stores/pipeline-store";
import { usePipeline } from "@/lib/hooks/use-pipeline";
import { PipelineProgress } from "@/app/components/pipeline-progress";
import { SceneLabels } from "@/app/components/scene-labels";
import { MjcfViewer } from "@/app/components/mjcf-viewer";
import { FALLBACK_DEMO_PLY_URL } from "@/lib/demo-ply";

// Dynamic import SplatViewer to avoid SSR issues with Three.js
const SplatViewer = dynamic(
  () =>
    import("@/app/components/splat-viewer").then((mod) => ({
      default: mod.SplatViewer,
    })),
  { ssr: false }
);

// Dynamic import SceneViewer (standalone robot + obstacles viewer)
const SceneViewer = dynamic(
  () =>
    import("@/app/components/scene-viewer").then((mod) => ({
      default: mod.SceneViewer,
    })),
  { ssr: false }
);

export default function Home() {
  const {
    sessionId,
    stage,
    percent,
    plyUrl,
    sceneJSON,
    mjcfXml,
    error,
    setSession,
    setStage,
    setPlyUrl,
    reset,
  } = usePipelineStore();

  // Subscribe to pipeline status updates
  usePipeline(sessionId);

  // Demo timer
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const splatRef = useRef<unknown>(null);

  useEffect(() => {
    if (!startTime) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const startSession = useCallback(() => {
    reset();
    const id = crypto.randomUUID();
    setSession(id);
    
    // Bypass scanning entirely, go straight to manual Splat analysis
    setStage("LABELLING", 0);
    setPlyUrl(
      process.env.NEXT_PUBLIC_DEMO_PLY_URL || FALLBACK_DEMO_PLY_URL
    );
    setStartTime(Date.now());
    setElapsed(0);
  }, [reset, setSession, setStage, setPlyUrl]);

  const analyzeViewport = useCallback(async () => {
    if (!sessionId) return;
    setIsAnalyzing(true);
    setStage("LABELLING", 20); // Switch to 20% while rotating camera
    try {
      let frames: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const splatViewer = splatRef.current as any;
      
      if (splatViewer && splatViewer.capturePano) {
        frames = await splatViewer.capturePano();
      } else {
        const canvas = document.querySelector('canvas');
        if (!canvas) throw new Error("Could not locate WebGL Canvas");
        frames = [canvas.toDataURL("image/jpeg", 0.8)];
      }
      
      setStage("LABELLING", 50); // Send to Gemini
      const res = await fetch("/api/analyze-splat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, frames }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e) {
      console.error("Analysis Failed:", e);
    } finally {
      setIsAnalyzing(false);
    }
  }, [sessionId, setStage]);

  const isAnalyzingStatus = stage === "LABELLING";
  const isProcessing =
    stage && !["LABELLING", "COMPLETE", "ERROR"].includes(stage);
  const isComplete = stage === "COMPLETE";
  const showTraining = stage === "BUILDING_SIM" || stage === "COMPLETE";

  return (
    <div className="flex flex-col min-h-screen bg-[#050508]">
      {/* ── Header ──────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3 glass border-b border-white/5 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping opacity-40" />
            </div>
            <h1 className="text-base font-bold tracking-tight text-white">
              Zero to World
            </h1>
          </div>
          <span className="text-[10px] font-mono text-white/20 bg-white/[0.04] px-2 py-0.5 rounded-full">
            v0.1 — Hackathon Demo
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          {startTime && (
            <div className="flex items-center gap-1.5 mr-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isComplete ? "bg-green-500" : "bg-red-500 animate-pulse"}`} />
              <span className="text-xs font-mono tabular-nums text-white/40">
                {formatTime(elapsed)}
              </span>
            </div>
          )}

          {!stage && (
            <button
              onClick={startSession}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-95"
            >
              Load Demo Room
            </button>
          )}
          {isAnalyzingStatus && (
            <button
              onClick={analyzeViewport}
              disabled={isAnalyzing}
              className={`px-5 py-2 rounded-xl text-white text-sm font-semibold transition-all shadow-lg active:scale-95 ${
                isAnalyzing
                  ? "bg-white/20 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 shadow-teal-500/20 hover:shadow-teal-500/40"
              }`}
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Viewport"}
            </button>
          )}
          {(isComplete || stage === "ERROR") && (
            <button
              onClick={() => {
                reset();
                setStartTime(null);
                setElapsed(0);
              }}
              className="px-5 py-2 rounded-xl glass hover:bg-white/10 text-white/80 text-sm font-semibold transition-all active:scale-95"
            >
              New Session
            </button>
          )}
          {sessionId && (
            <span className="text-[10px] font-mono text-white/15 ml-1">
              {sessionId.slice(0, 8)}
            </span>
          )}
        </div>
      </header>

      {/* ── Hero / Landing State ─────────────────── */}
      {!stage && (
        <div className="flex-1 flex items-center justify-center animate-fade-in">
          <div className="flex flex-col items-center gap-6 text-center max-w-lg px-6">
            <div className="text-6xl mb-2">🌍</div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              Scan any room.
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Train a robot.
              </span>
            </h2>
            <p className="text-sm text-white/40 leading-relaxed max-w-md">
              Walk through a space wearing Meta Ray-Ban glasses. Zero to World
              reconstructs it in 3D, labels every object, builds a physics
              simulation, and trains a robot to navigate — all in under 5
              minutes.
            </p>
            <button
              onClick={startSession}
              className="mt-2 px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-base transition-all shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-95"
            >
              Launch Synthetic Engine →
            </button>
          </div>
        </div>
      )}

      {/* ── Main Grid (active session) ──────────── */}
      {stage && (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 animate-fade-in">
          {/* Left — Pipeline + 3D Viewer (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div className="glass rounded-xl p-4">
              <PipelineProgress stage={stage} percent={percent} />
            </div>

            {/* Error */}
            {error && (
              <div className="glass rounded-xl p-4 border-red-500/30 animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-red-400">⚠️</span>
                  <span className="text-sm text-red-300 font-mono">{error}</span>
                </div>
              </div>
            )}

            {/* 3D Viewer — appears after reconstruction */}
            {plyUrl && (
              <div className="animate-slide-up">
                <SplatViewer
                  ref={splatRef as React.Ref<any>}
                  plyUrl={plyUrl}
                  sceneJSON={sceneJSON}
                  showRobot={!!sceneJSON && stage !== "ERROR"}
                  className="aspect-video"
                />
                {isComplete && sessionId && (
                  <a
                    href={`/view/${sessionId}`}
                    className="mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/80 text-xs font-mono transition-all"
                  >
                    <span>🖥️</span> Open Full-Screen Viewer
                  </a>
                )}
              </div>
            )}

            {/* Standalone robot scene viewer — when no .ply but sceneJSON exists */}
            {!plyUrl && sceneJSON && showTraining && (
              <div className="animate-slide-up">
                <SceneViewer sceneJSON={sceneJSON} className="aspect-video" />
              </div>
            )}

            {/* Success state */}
            {isComplete && (
              <div className="glass rounded-xl p-5 text-center animate-slide-up delay-200">
                <div className="text-2xl mb-2">🎉</div>
                <div className="text-green-400 text-lg font-bold">
                  World Built
                </div>
                <div className="text-white/30 text-xs font-mono mt-1 leading-relaxed">
                  Room scanned → 3D reconstructed → Semantically labelled → Physics sim ready → Robot trained
                </div>
                {startTime && (
                  <div className="mt-3 text-white/50 text-sm font-mono">
                    Total time: <span className="text-green-400 font-bold">{formatTime(elapsed)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — Scene Analysis + MuJoCo + Training (3 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            <div className="glass rounded-xl p-4">
              <SceneLabels sceneJSON={sceneJSON} />
            </div>
            <div className="glass rounded-xl p-4">
              <MjcfViewer mjcfXml={mjcfXml} />
            </div>
          </div>
        </main>
      )}

      {/* ── Footer ──────────────────────────────── */}
      <footer className="px-6 py-2.5 border-t border-white/[0.03] text-center text-[10px] text-white/15 font-mono">
        Meta Ray-Bans → COLMAP → msplat → Gemini 2.0 Flash → MuJoCo → PPO | Zero to Agent Hackathon 2026
      </footer>
    </div>
  );
}
