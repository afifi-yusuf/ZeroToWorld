import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { FALLBACK_DEMO_PLY_URL } from "./lib/demo-ply";

/** Absolute app root — required when another lockfile exists (e.g. ~/package-lock.json) so Turbopack does not pick the wrong workspace root. */
const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

/** Browser splat viewer needs a public URL; DEMO_PLY_URL alone is server-only unless forwarded here. */
const demoPlyUrl =
  process.env.NEXT_PUBLIC_DEMO_PLY_URL ??
  process.env.DEMO_PLY_URL ??
  FALLBACK_DEMO_PLY_URL;

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
  env: {
    NEXT_PUBLIC_DEMO_PLY_URL: demoPlyUrl,
  },
};

export default nextConfig;
