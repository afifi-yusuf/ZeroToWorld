import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

/** Root directory for persisted capture sessions (COLMAP-ready layout). */
export function getCapturesRoot(): string {
  return process.env.CAPTURES_DIR ?? path.join(process.cwd(), "captures");
}

let activeSessionId: string | null = null;
let frameCounter = 0;

export function getActiveCaptureSession(): { sessionId: string; framesWritten: number } | null {
  if (!activeSessionId) return null;
  return { sessionId: activeSessionId, framesWritten: frameCounter };
}

export async function startCaptureSession(optionalId?: string): Promise<{ sessionId: string; dir: string }> {
  const cleaned = optionalId?.replace(/[^a-zA-Z0-9_-]/g, "") ?? "";
  const sessionId = cleaned.length > 0 ? cleaned : uuidv4().slice(0, 12);
  const root = getCapturesRoot();
  const dir = path.join(root, sessionId);
  await fs.mkdir(path.join(dir, "images"), { recursive: true });
  activeSessionId = sessionId;
  frameCounter = 0;
  const meta = {
    sessionId,
    startedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  return { sessionId, dir };
}

export function stopCaptureSession(): void {
  activeSessionId = null;
}

export function resetCaptureSessionState(): void {
  activeSessionId = null;
  frameCounter = 0;
}

/** Write JPEG to captures/<session>/images/ when a session is active. Fire-and-forget from HTTP handler. */
export async function persistFrameToDisk(jpeg: Buffer): Promise<void> {
  if (!activeSessionId) return;
  frameCounter += 1;
  const name = `frame_${String(frameCounter).padStart(6, "0")}.jpg`;
  const filePath = path.join(getCapturesRoot(), activeSessionId, "images", name);
  await fs.writeFile(filePath, jpeg);
}

export async function listCaptureSessions(): Promise<string[]> {
  const root = getCapturesRoot();
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function getCaptureSessionInfo(sessionId: string): Promise<{
  sessionId: string;
  imageCount: number;
  hasSparse: boolean;
  path: string;
} | null> {
  const root = getCapturesRoot();
  const dir = path.join(root, sessionId);
  const imagesDir = path.join(dir, "images");
  try {
    const files = await fs.readdir(imagesDir);
    const imageCount = files.filter((f) => /\.(jpe?g|png)$/i.test(f)).length;
    const sparse0 = path.join(dir, "sparse", "0");
    let hasSparse = false;
    try {
      const sparseFiles = await fs.readdir(sparse0);
      hasSparse = sparseFiles.some((f) => f.endsWith(".bin"));
    } catch {
      hasSparse = false;
    }
    return { sessionId, imageCount, hasSparse, path: dir };
  } catch {
    return null;
  }
}
