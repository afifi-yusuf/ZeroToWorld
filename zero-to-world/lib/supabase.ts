import { put, list } from "@vercel/blob";
import type { SessionRow, PipelineStage } from "@/lib/types";

// --- Frame storage helpers ---

export async function uploadFrame(
  sessionId: string,
  timestamp: number,
  buffer: Buffer
): Promise<string> {
  const { url } = await put(
    `sessions/${sessionId}/${timestamp}.jpg`,
    buffer,
    { access: "public", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true }
  );
  return url;
}

export async function listFrameUrls(sessionId: string): Promise<string[]> {
  const { blobs } = await list({ prefix: `sessions/${sessionId}/` });
  return blobs
    .filter((b) => b.pathname.endsWith(".jpg"))
    .map((b) => b.url);
}

// --- Session state helpers ---
// Uses in-memory cache as the primary store (fast reads/writes),
// with Vercel Blob as durable persistence (write-through).

const sessionPath = (id: string) => `sessions/${id}/_state.json`;

// Use globalThis to survive hot-reloads and share across API route workers
const globalCache = globalThis as typeof globalThis & {
  __sessionCache?: Map<string, SessionRow>;
};
if (!globalCache.__sessionCache) {
  globalCache.__sessionCache = new Map<string, SessionRow>();
}
const sessionCache = globalCache.__sessionCache;

const defaultSession = (id: string): SessionRow => ({
  id,
  stage: "SCANNING",
  percent: 0,
  ply_url: null,
  scene_json: null,
  mjcf_xml: null,
  error: null,
  created_at: new Date().toISOString(),
});

export async function getSession(
  sessionId: string
): Promise<SessionRow | null> {
  return sessionCache.get(sessionId) ?? null;
}

export async function upsertSession(
  sessionId: string,
  patch: Partial<SessionRow> = {}
): Promise<SessionRow> {
  const existing = sessionCache.get(sessionId) ?? await getSession(sessionId);
  const session: SessionRow = existing
    ? { ...existing, ...patch }
    : { ...defaultSession(sessionId), ...patch };

  // Update in-memory cache immediately
  sessionCache.set(sessionId, session);

  // Write-through to Blob (fire-and-forget for speed, log errors)
  put(sessionPath(sessionId), JSON.stringify(session), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  }).catch((err) => {
    console.warn(`[blob] Failed to persist session ${sessionId}: ${(err as Error).message}`);
  });

  return session;
}

export async function updateSession(
  sessionId: string,
  stage: PipelineStage,
  percent: number,
  extra: Partial<SessionRow> = {}
): Promise<void> {
  await upsertSession(sessionId, { stage, percent, ...extra });
}
