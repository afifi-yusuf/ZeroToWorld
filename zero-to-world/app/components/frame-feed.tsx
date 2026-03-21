"use client";

export function FrameFeed({ frames }: { frames: string[] }) {
  const latest = frames[frames.length - 1];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
        Live Feed
      </h2>

      {/* Main frame */}
      <div className="relative aspect-video rounded-lg overflow-hidden bg-white/[0.03] border border-white/10">
        {latest ? (
          <img
            src={`data:image/jpeg;base64,${latest}`}
            alt="Live frame"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white/20 text-sm font-mono">
            Waiting for frames…
          </div>
        )}
        {frames.length > 0 && (
          <div className="absolute top-2 right-2 bg-black/60 rounded px-2 py-0.5 text-xs font-mono text-white/70">
            {frames.length} frames
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {frames.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {frames.slice(-8).map((f, i) => (
            <img
              key={i}
              src={`data:image/jpeg;base64,${f}`}
              alt={`Frame ${i}`}
              className="h-12 w-16 rounded object-cover flex-shrink-0 border border-white/10"
            />
          ))}
        </div>
      )}
    </div>
  );
}
