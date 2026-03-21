import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SceneJSON } from "@/lib/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SCENE_PROMPT = `You are a robotics scene analyst for sim-to-real transfer.
Analyse these room images and return ONLY valid JSON (no markdown, no code fences):
{
  "floor_plane": { "width_m": <number>, "depth_m": <number> },
  "walls": [{ "x": <number>, "y": <number>, "width": <number>, "height": <number> }],
  "obstacles": [
    {
      "label": "<string e.g. desk, chair, couch>",
      "x": <center x in meters from room origin>,
      "y": <center y in meters from room origin>,
      "width_m": <number>,
      "depth_m": <number>,
      "height_m": <number>
    }
  ],
  "navigable_area_sqm": <number>
}
Estimate real-world dimensions in meters. Be precise — a robot will navigate this.`;

const GEMINI_TIMEOUT_MS = 30_000;

export async function analyseScene(imageUrls: string[]): Promise<SceneJSON> {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const model = genAI.getGenerativeModel({ model: modelName });

  console.log(`[gemini] Starting scene analysis with model=${modelName}, ${imageUrls.length} frame URLs`);

  if (imageUrls.length === 0) {
    console.warn("[gemini] No frames available — returning synthetic scene");
    return {
      floor_plane: { width_m: 5, depth_m: 4 },
      walls: [
        { x: 0, y: 2, width: 5, height: 2.5 },
        { x: 0, y: -2, width: 5, height: 2.5 },
      ],
      obstacles: [],
      navigable_area_sqm: 20,
    };
  }

  // Fetch images and convert to inline data parts
  console.log(`[gemini] Fetching ${Math.min(imageUrls.length, 8)} images...`);
  const imageParts = await Promise.all(
    imageUrls.slice(0, 8).map(async (url, i) => {
      const res = await fetch(url);
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      console.log(`[gemini]   image ${i + 1}: ${(buffer.byteLength / 1024).toFixed(0)} KB`);
      return {
        inlineData: { data: base64, mimeType: "image/jpeg" },
      };
    })
  );

  console.log(`[gemini] Sending ${imageParts.length} images to ${modelName}...`);

  // Race the API call against a timeout
  const apiCall = model.generateContent([SCENE_PROMPT, ...imageParts]);
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Gemini timed out after ${GEMINI_TIMEOUT_MS / 1000}s`)), GEMINI_TIMEOUT_MS)
  );

  const result = await Promise.race([apiCall, timeout]);
  const text = result.response.text();
  console.log(`[gemini] Response received (${text.length} chars)`);

  // Strip markdown code fences if Gemini wraps them anyway
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as SceneJSON;
    console.log(`[gemini] Parsed: ${parsed.obstacles.length} obstacles, floor ${parsed.floor_plane.width_m}x${parsed.floor_plane.depth_m}m`);
    return parsed;
  } catch (parseErr) {
    console.error(`[gemini] JSON parse failed. Raw response:\n${cleaned.slice(0, 500)}`);
    throw new Error(`Gemini returned invalid JSON: ${(parseErr as Error).message}`);
  }
}
