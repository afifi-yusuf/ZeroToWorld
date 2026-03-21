import { NextResponse } from "next/server";
import { analyseScene } from "@/lib/services/gemini";
import { generateMJCF } from "@/lib/services/mujoco";
import { updateSession } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { sessionId, frames } = await req.json();
    if (!sessionId || !frames || frames.length === 0) {
      return NextResponse.json({ error: "Missing sessionId or frames" }, { status: 400 });
    }

    console.log(`[analyze-splat] Received ${frames.length} frames for session ${sessionId}`);

    // Call Gemini with the raw Base64 dataURIs
    const sceneJSON = await analyseScene(frames);
    
    // Extrapolate the MJCF Simulator configuration
    const mjcfXml = generateMJCF(sceneJSON);

    // Save strictly to Supabase so the usePipeline hook automatically syncs the UI completely!
    await updateSession(sessionId, "COMPLETE", 100, {
      scene_json: sceneJSON,
      mjcf_xml: mjcfXml
    });

    return NextResponse.json({ ok: true, sceneJSON });
  } catch (error) {
    console.error("[analyze-splat] API Route Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown analysis error" },
      { status: 500 }
    );
  }
}
