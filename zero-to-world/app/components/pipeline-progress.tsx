"use client";

import type { PipelineStage } from "@/lib/types";

const STAGES: { key: PipelineStage; label: string; icon: string }[] = [
  { key: "SCANNING", label: "Scanning Room", icon: "📷" },
  { key: "RECONSTRUCTING", label: "3D Reconstruction", icon: "🧊" },
  { key: "LABELLING", label: "Scene Analysis", icon: "🧠" },
  { key: "BUILDING_SIM", label: "Building Simulation", icon: "⚙️" },
  { key: "TRAINING", label: "Robot Training", icon: "🤖" },
  { key: "COMPLETE", label: "World Ready", icon: "✅" },
];

export function PipelineProgress({
  stage,
  percent,
}: {
  stage: PipelineStage | null;
  percent: number;
}) {
  const currentIdx = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30 mb-3">
        Pipeline
      </h2>

      {STAGES.map((s, i) => {
        const isActive = s.key === stage;
        const isDone = currentIdx > i || stage === "COMPLETE";
        const isFuture = currentIdx < i && stage !== "COMPLETE";

        return (
          <div
            key={s.key}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-mono
              transition-all duration-500 ease-out
              animate-fade-in
              ${
                isActive
                  ? "glass-strong border-blue-500/40 text-blue-200 animate-pulse-glow"
                  : isDone
                  ? "bg-green-500/[0.06] border border-green-500/15 text-green-400/70"
                  : isFuture
                  ? "bg-white/[0.01] border border-white/[0.04] text-white/15"
                  : "bg-white/[0.01] border border-white/[0.04] text-white/15"
              }
            `}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <span className="text-sm w-5 text-center flex-shrink-0">
              {isDone && !isActive ? "✓" : s.icon}
            </span>
            <span className="flex-1 text-xs">{s.label}</span>
            {isActive && (
              <div className="flex items-center gap-2">
                <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-700"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-blue-400 w-7 text-right">
                  {percent}%
                </span>
              </div>
            )}
          </div>
        );
      })}

      {stage === "ERROR" && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-mono bg-red-500/10 border border-red-500/30 text-red-300 animate-fade-in">
          <span>❌</span>
          <span className="text-xs">Pipeline Error</span>
        </div>
      )}
    </div>
  );
}
