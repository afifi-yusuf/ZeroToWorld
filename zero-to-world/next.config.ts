import type { NextConfig } from "next";
import { FALLBACK_DEMO_PLY_URL } from "./lib/demo-ply";

/** Browser splat viewer needs a public URL; DEMO_PLY_URL alone is server-only unless forwarded here. */
const demoPlyUrl =
  process.env.NEXT_PUBLIC_DEMO_PLY_URL ??
  process.env.DEMO_PLY_URL ??
  FALLBACK_DEMO_PLY_URL;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_DEMO_PLY_URL: demoPlyUrl,
  },
};

export default nextConfig;
