import { Router } from "express";
import { listCaptureSessions, getCaptureSessionInfo } from "../capture";

const router = Router();

// GET /captures — list session directory names under captures/
router.get("/captures", async (_req, res) => {
  try {
    const sessions = await listCaptureSessions();
    res.json({ sessions });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /captures/:sessionId — image count and whether COLMAP sparse exists
router.get("/captures/:sessionId", async (req, res) => {
  const info = await getCaptureSessionInfo(req.params.sessionId);
  if (!info) {
    res.status(404).json({ error: "Session not found or has no images/ folder." });
    return;
  }
  res.json(info);
});

export default router;
