import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase";
import { runPipeline } from "@/lib/services/pipeline";

export async function POST(request: Request) {
  const { sessionId } = await request.json();

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId" },
      { status: 400 }
    );
  }

  // Mark session as starting reconstruction
  await updateSession(sessionId, "RECONSTRUCTING", 0);

  // Fire-and-forget — pipeline runs in background, updates Vercel Blob as it progresses
  runPipeline(sessionId);

  return NextResponse.json({ ok: true, sessionId });
}
