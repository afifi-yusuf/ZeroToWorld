/**
 * End-to-end pipeline test script.
 *
 * Uploads sample room images to Vercel Blob, triggers the pipeline,
 * and polls until completion — testing Gemini labelling, MuJoCo generation,
 * and the full pipeline flow.
 *
 * Usage: npx tsx scripts/test-pipeline.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { put, list } from "@vercel/blob";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

// Config
const TEST_SESSION_ID = "test-e2e-" + Date.now();
const IMAGES_DIR = "/tmp/ztw-test-images";
const DEMO_PLY_URL =
  "https://huggingface.co/kishimisu/3d-gaussian-splatting-webgl/resolve/main/room.ply";

async function uploadTestFrames() {
  console.log(`\n📷 Uploading test frames for session: ${TEST_SESSION_ID}`);

  const files = readdirSync(IMAGES_DIR).filter((f) => f.endsWith(".jpg"));
  console.log(`   Found ${files.length} images in ${IMAGES_DIR}`);

  for (const file of files) {
    const buffer = readFileSync(join(IMAGES_DIR, file));
    const timestamp = Date.now();
    const blobPath = `sessions/${TEST_SESSION_ID}/${timestamp}.jpg`;

    const { url } = await put(blobPath, buffer, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: false,
    });

    console.log(`   ✓ Uploaded ${file} → ${url}`);
    // Small delay to ensure unique timestamps
    await new Promise((r) => setTimeout(r, 100));
  }

  // Verify uploads
  const { blobs } = await list({ prefix: `sessions/${TEST_SESSION_ID}/` });
  const jpgs = blobs.filter((b) => b.pathname.endsWith(".jpg"));
  console.log(`   ✓ ${jpgs.length} frames uploaded to Vercel Blob\n`);
  return jpgs.map((b) => b.url);
}

async function runPipelineLocally(frameUrls: string[]) {
  console.log("🔄 Running pipeline stages locally...\n");

  // --- Stage 1: Reconstruct (stub → demo PLY) ---
  console.log("🧊 Stage 1: 3D Reconstruction (using demo .ply)");
  console.log(`   PLY URL: ${DEMO_PLY_URL}`);
  const plyUrl = DEMO_PLY_URL;
  console.log("   ✓ Reconstruction complete\n");

  // --- Stage 2: Gemini scene analysis ---
  console.log("🧠 Stage 2: Gemini 2.5 Flash — Scene Analysis");
  console.log(`   Sending ${frameUrls.length} frames to Gemini...`);

  const { analyseScene } = await import("../lib/services/gemini");
  const sceneJSON = await analyseScene(frameUrls);

  console.log("   ✓ Scene analysis complete:");
  console.log(`     Floor: ${sceneJSON.floor.width_m}m × ${sceneJSON.floor.depth_m}m`);
  console.log(`     Obstacles: ${sceneJSON.obstacles?.length}`);
  sceneJSON.obstacles?.forEach((o) => {
    console.log(
      `       • ${o.label} at (${o.x}, ${o.y}) — ${o.width_m}×${o.depth_m}×${o.height_m}m`
    );
  });
  console.log(`     Robot Spawn: ${sceneJSON.robot_spawn.description}\n`);

  // --- Stage 3: MuJoCo generation ---
  console.log("⚙️  Stage 3: MuJoCo Scene Generation");

  const { generateMJCF } = await import("../lib/services/mujoco");
  const mjcfXml = generateMJCF(sceneJSON);

  console.log(`   ✓ Generated MJCF XML (${mjcfXml.length} chars)`);
  console.log(`   Bodies: ${(mjcfXml.match(/<body /g) || []).length}`);
  console.log(`   Geoms: ${(mjcfXml.match(/<geom /g) || []).length}\n`);

  // Save to Vercel Blob as session state
  const { upsertSession } = await import("../lib/supabase");
  await upsertSession(TEST_SESSION_ID, {
    stage: "COMPLETE",
    percent: 100,
    ply_url: plyUrl,
    scene_json: sceneJSON,
    mjcf_xml: mjcfXml,
  });

  console.log("✅ Pipeline complete! Session saved to Vercel Blob.");
  console.log(`\n🌐 View at: http://localhost:3000/view/${TEST_SESSION_ID}`);
  console.log(`📊 Dashboard: http://localhost:3000 (click Start Scan)\n`);

  // Print summary
  console.log("═".repeat(50));
  console.log("PIPELINE TEST SUMMARY");
  console.log("═".repeat(50));
  console.log(`Session ID:     ${TEST_SESSION_ID}`);
  console.log(`Frames:         ${frameUrls.length}`);
  console.log(`PLY URL:        ${plyUrl.slice(0, 60)}...`);
  console.log(`Scene objects:  ${sceneJSON.obstacles.length}`);
  console.log(`MJCF bodies:    ${(mjcfXml.match(/<body /g) || []).length}`);
  console.log(`MJCF XML size:  ${mjcfXml.length} chars`);
  console.log("═".repeat(50));

  return { sceneJSON, mjcfXml, plyUrl };
}

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║   Zero to World — End-to-End Pipeline Test    ║");
  console.log("╚═══════════════════════════════════════════════╝\n");

  try {
    const frameUrls = await uploadTestFrames();
    await runPipelineLocally(frameUrls);
  } catch (err) {
    console.error("\n❌ Pipeline test failed:", err);
    process.exit(1);
  }
}

main();
