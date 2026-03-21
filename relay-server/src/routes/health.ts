import { Router } from "express";
import { state } from "../state";
import { getActiveCaptureSession } from "../capture";
import { getSubscriberCounts } from "../ws/handler";
import { HealthResponse } from "../types";

const router = Router();

router.get("/health", (req, res) => {
  const { frameSubscribers, transcriptSubscribers, ttsSubscribers } = getSubscriberCounts();
  const cap = getActiveCaptureSession();

  const health: HealthResponse = {
    status: "ok",
    uptimeS: state.uptimeS,
    framesIngested: state.framesIngested,
    transcriptsIngested: state.transcriptsIngested,
    frameSubscribers,
    transcriptSubscribers,
    ttsSubscribers,
    ttsIngested: state.ttsIngested,
    capture: cap
      ? { active: true, sessionId: cap.sessionId, framesWritten: cap.framesWritten }
      : { active: false },
  };

  res.json(health);
});

export default router;
