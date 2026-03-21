import { NextResponse } from "next/server";
import { uploadFrame, upsertSession } from "@/lib/supabase";

export async function POST(request: Request) {
  const { frame, sessionId, timestamp } = await request.json();

  if (!frame || !sessionId || !timestamp) {
    return NextResponse.json(
      { error: "Missing frame, sessionId, or timestamp" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(frame, "base64");

  // Upload frame to Vercel Blob
  await uploadFrame(sessionId, timestamp, buffer);

  // Ensure session exists in SCANNING stage
  await upsertSession(sessionId);

  return NextResponse.json({ ok: true });
}
