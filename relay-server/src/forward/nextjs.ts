import axios from "axios";

const NEXTJS_INGEST_URL =
  process.env.NEXTJS_INGEST_URL || "http://localhost:3000";

export async function forwardFrameToNextJS(
  sessionId: string,
  timestamp: number,
  base64: string,
): Promise<void> {
  try {
    await axios.post(`${NEXTJS_INGEST_URL}/api/ingest/frame`, {
      frame: base64,
      sessionId,
      timestamp,
    });
  } catch (err) {
    console.warn(
      `[forward/nextjs] Failed to forward frame: ${(err as Error).message}`,
    );
  }
}
