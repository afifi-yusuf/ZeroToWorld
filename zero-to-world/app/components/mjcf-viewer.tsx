"use client";

import { useState } from "react";

export function MjcfViewer({ mjcfXml }: { mjcfXml: string | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!mjcfXml) {
    return (
      <div className="text-white/20 text-sm font-mono">
        MuJoCo scene will appear here…
      </div>
    );
  }

  const handleDownload = () => {
    const blob = new Blob([mjcfXml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scene.mjcf";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
          MuJoCo Scene
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-400 hover:text-blue-300 font-mono"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
          <button
            onClick={handleDownload}
            className="text-xs text-green-400 hover:text-green-300 font-mono"
          >
            Download .mjcf
          </button>
        </div>
      </div>
      <pre
        className={`bg-white/[0.03] rounded-lg p-3 border border-white/5 text-xs font-mono text-white/60 overflow-auto ${
          expanded ? "max-h-[600px]" : "max-h-[200px]"
        }`}
      >
        {mjcfXml}
      </pre>
    </div>
  );
}
