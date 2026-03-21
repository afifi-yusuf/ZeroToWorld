"use client";

import { useEffect, useState, useRef } from "react";

interface TrainingState {
  step: number;
  maxSteps: number;
  reward: number;
  status: "idle" | "training" | "complete";
}

export function RobotTraining({ active }: { active: boolean }) {
  const [state, setState] = useState<TrainingState>({
    step: 0,
    maxSteps: 500,
    reward: -12.4,
    status: "idle",
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;

    setState({ step: 0, maxSteps: 500, reward: -12.4, status: "training" });

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.step >= prev.maxSteps) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return { ...prev, status: "complete" };
        }
        const progress = prev.step / prev.maxSteps;
        // Reward curve: starts negative, improves with diminishing returns
        const newReward =
          -12.4 + 18.2 * (1 - Math.exp(-3.5 * progress)) + (Math.random() - 0.5) * 0.8;
        return {
          ...prev,
          step: prev.step + Math.floor(Math.random() * 8 + 3),
          reward: Math.min(newReward, 6.2),
        };
      });
    }, 120);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active]);

  const progress = (state.step / state.maxSteps) * 100;
  const rewardColor =
    state.reward > 0
      ? "text-green-400"
      : state.reward > -5
      ? "text-yellow-400"
      : "text-red-400";

  if (state.status === "idle") {
    return (
      <div className="glass rounded-xl p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30 mb-3">
          Robot Training
        </h2>
        <div className="text-white/20 text-sm font-mono text-center py-4">
          PPO training begins after simulation…
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4 animate-fade-in">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30 mb-3">
        Robot Training — PPO
      </h2>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/[0.03] rounded-lg p-2 text-center">
          <div className="text-[10px] text-white/30 font-mono">Step</div>
          <div className="text-sm font-mono font-bold text-white/80 tabular-nums">
            {Math.min(state.step, state.maxSteps)}
          </div>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-2 text-center">
          <div className="text-[10px] text-white/30 font-mono">Reward</div>
          <div className={`text-sm font-mono font-bold tabular-nums ${rewardColor}`}>
            {state.reward.toFixed(1)}
          </div>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-2 text-center">
          <div className="text-[10px] text-white/30 font-mono">Status</div>
          <div className="text-sm font-mono font-bold text-white/80">
            {state.status === "complete" ? (
              <span className="text-green-400">Done</span>
            ) : (
              <span className="text-blue-400 animate-pulse">Training</span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            state.status === "complete"
              ? "bg-gradient-to-r from-green-500 to-emerald-400"
              : "bg-gradient-to-r from-blue-500 to-purple-500"
          }`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* Terminal-style log */}
      <div className="mt-3 bg-black/30 rounded-lg p-2 max-h-20 overflow-y-auto">
        <div className="text-[10px] font-mono text-white/30 space-y-0.5">
          {state.step > 0 && (
            <div>
              <span className="text-green-400/60">[PPO]</span> step={Math.min(state.step, state.maxSteps)} reward={state.reward.toFixed(2)} loss=
              {(0.45 * Math.exp(-state.step / 200) + 0.02).toFixed(3)}
            </div>
          )}
          {state.step > 100 && (
            <div>
              <span className="text-blue-400/60">[NAV]</span> Agent learning obstacle avoidance…
            </div>
          )}
          {state.step > 300 && (
            <div>
              <span className="text-purple-400/60">[NAV]</span> Path to target found — optimizing…
            </div>
          )}
          {state.status === "complete" && (
            <div>
              <span className="text-green-400">✓</span> Robot navigates room successfully!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
