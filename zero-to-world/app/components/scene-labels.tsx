"use client";

import type { SceneJSON } from "@/lib/types";

export function SceneLabels({ sceneJSON }: { sceneJSON: SceneJSON | null }) {
  if (!sceneJSON) {
    return (
      <div className="text-white/20 text-sm font-mono">
        Scene analysis will appear here…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
        Scene Analysis
      </h2>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/[0.04] rounded-lg p-3 border border-white/5">
          <div className="text-xs text-white/40 font-mono">Floor</div>
          <div className="text-sm font-semibold text-white/80">
            {sceneJSON.floor?.width_m}m × {sceneJSON.floor?.depth_m}m
          </div>
        </div>
        <div className="bg-white/[0.04] rounded-lg p-3 border border-white/5">
          <div className="text-xs text-white/40 font-mono">Ceiling</div>
          <div className="text-sm font-semibold text-white/80">
            {sceneJSON.ceiling_height_m}m
          </div>
        </div>
      </div>

      {/* Obstacle cards */}
      <div className="grid grid-cols-2 gap-2">
        {sceneJSON.obstacles?.map((o, i) => (
          <div
            key={i}
            className="bg-white/[0.04] rounded-lg p-2.5 border border-white/5"
          >
            <div className="text-green-400 text-sm font-semibold capitalize">
              {o.label}
            </div>
            <div className="text-white/40 text-xs font-mono mt-0.5">
              {o.width_m}×{o.depth_m}×{o.height_m}m
            </div>
            <div className="text-white/25 text-xs font-mono">
              pos({o.x}, {o.y})
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
