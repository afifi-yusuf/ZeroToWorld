import { updateSession, listFrameUrls } from "@/lib/supabase";
import { analyseScene } from "@/lib/services/gemini";
import { generateMJCF } from "@/lib/services/mujoco";
import { reconstruct } from "@/lib/services/reconstruct";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdtemp } from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

export async function runPipeline(sessionId: string) {
  try {
    // --- Stage 1: Fetch frames ---
    console.log(`[pipeline] ${sessionId} — fetching frame URLs from Blob`);
    await updateSession(sessionId, "RECONSTRUCTING", 5);
    const frameUrls = await listFrameUrls(sessionId);
    console.log(`[pipeline] ${sessionId} — found ${frameUrls.length} frames`);

    // --- Stage 2: 3D Reconstruction ---
    await updateSession(sessionId, "RECONSTRUCTING", 15);
    const plyUrl = await reconstruct(sessionId, frameUrls);
    console.log(`[pipeline] ${sessionId} — reconstruct done: ${plyUrl ? "got .ply" : "no .ply"}`);
    await updateSession(sessionId, "RECONSTRUCTING", 35, { ply_url: plyUrl });

    // --- Stage 3: Gemini semantic analysis ---
    console.log(`[pipeline] ${sessionId} — starting Gemini scene analysis`);
    await updateSession(sessionId, "LABELLING", 40);
    const sceneJSON = await analyseScene(frameUrls);
    console.log(`[pipeline] ${sessionId} — Gemini done: ${sceneJSON.obstacles.length} obstacles`);
    await updateSession(sessionId, "LABELLING", 65, {
      scene_json: sceneJSON,
    });

    // --- Stage 4: MuJoCo scene generation ---
    await updateSession(sessionId, "BUILDING_SIM", 70);
    const mjcfXml = generateMJCF(sceneJSON);
    await updateSession(sessionId, "BUILDING_SIM", 90, {
      mjcf_xml: mjcfXml,
    });

    // --- Stage 5: PPO Robot Training (optional) ---
    const ppoEnabled = process.env.ENABLE_PPO_TRAINING === "true";
    console.log(`[pipeline] ${sessionId} — PPO training enabled: ${ppoEnabled}`);
    if (ppoEnabled) {
      await updateSession(sessionId, "TRAINING", 92);
      try {
        const tmpDir = await mkdtemp(path.join(os.tmpdir(), `ztw-${sessionId}-`));
        const mjcfPath = path.join(tmpDir, "scene.mjcf");
        await writeFile(mjcfPath, mjcfXml);

        const ppoSteps = process.env.PPO_STEPS || "50000";
        const policyPath = path.join(tmpDir, "policy.zip");
        const scriptPath = path.resolve("scripts/train-ppo.py");

        await execAsync(
          `python3 "${scriptPath}" "${mjcfPath}" --steps ${ppoSteps} --output "${policyPath}"`,
          { timeout: 600_000 },
        );
        await updateSession(sessionId, "TRAINING", 98);
      } catch (err) {
        console.warn(
          `[pipeline] PPO training failed (non-fatal): ${(err as Error).message}`,
        );
      }
    }

    // --- Done ---
    console.log(`[pipeline] ${sessionId} — setting COMPLETE`);
    await updateSession(sessionId, "COMPLETE", 100);
    console.log(`[pipeline] ${sessionId} — COMPLETE!`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[pipeline] ${sessionId} — ERROR: ${message}`);
    await updateSession(sessionId, "ERROR", 0, { error: message });
  }
}
