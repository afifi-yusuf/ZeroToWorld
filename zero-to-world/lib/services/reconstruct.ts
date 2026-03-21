import { put } from "@vercel/blob";
import { readFile } from "fs/promises";
import path from "path";
import { FALLBACK_DEMO_PLY_URL } from "@/lib/demo-ply";

/**
 * 3D reconstruction — looks for a .ply exported by the gsplat pipeline
 * at relay-server/captures/<sessionId>/exports/gaussians.ply.
 *
 * If found, uploads it to Vercel Blob and returns the public URL.
 * Falls back to DEMO_PLY_URL env var, or empty string if neither exists.
 */
export async function reconstruct(
  sessionId: string,
  _frameUrls: string[],
): Promise<string> {
  // Check for gsplat pipeline output on disk
  const relayCaptures =
    process.env.CAPTURES_DIR ??
    path.resolve(process.cwd(), "..", "relay-server", "captures");
  const plyPath = path.join(relayCaptures, sessionId, "exports", "gaussians.ply");

  console.log(`[reconstruct] Checking for .ply at ${plyPath}`);

  try {
    const plyBuffer = await readFile(plyPath);
    console.log(
      `[reconstruct] Found .ply (${(plyBuffer.length / 1024 / 1024).toFixed(1)} MB), uploading to Vercel Blob…`,
    );
    const { url } = await put(
      `sessions/${sessionId}/model.ply`,
      plyBuffer,
      { access: "public", contentType: "application/octet-stream", addRandomSuffix: false, allowOverwrite: true },
    );
    console.log(`[reconstruct] Uploaded .ply → ${url}`);
    return url;
  } catch {
    console.log("[reconstruct] No .ply on disk, using fallback");
  }

  const demoUrl = process.env.DEMO_PLY_URL;
  if (demoUrl) {
    console.log(`[reconstruct] Using DEMO_PLY_URL: ${demoUrl}`);
    return demoUrl;
  }

  console.log(`[reconstruct] No DEMO_PLY_URL; using bundled fallback`);
  return FALLBACK_DEMO_PLY_URL;
}
