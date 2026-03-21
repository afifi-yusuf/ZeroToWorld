import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SceneJSON } from "@/lib/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SCENE_PROMPT = `You are a robotics scene analyst for a quadruped robot navigation system.
Analyse these images of a room and return ONLY valid JSON in this exact schema:

{
  "floor": { "width_m": number, "depth_m": number },
  "ceiling_height_m": number,
  "robot_spawn": { "x": number, "y": number, "description": "back of room" },
  "navigation_goal": { "x": number, "y": number, "description": "front stage" },
  "obstacles": [
    { 
      "label": string,        // e.g. "table", "chair", "speaker_stand"
      "x": number,            // metres from room centre
      "y": number,
      "width_m": number,
      "depth_m": number,
      "height_m": number
    }
  ]
}

Use metric estimates. Origin (0,0) is the centre of the room.
robot_spawn should be at the back (audience end).
navigation_goal should be the stage at the front.`;

const GEMINI_TIMEOUT_MS = 30_000;

export async function analyseScene(imageUrls: string[]): Promise<SceneJSON> {
  const modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
  const model = genAI.getGenerativeModel({ model: modelName });

  console.log(`[gemini] Starting scene analysis with model=${modelName}, ${imageUrls.length} frame URLs`);

  if (imageUrls.length === 0) {
    console.warn("[gemini] No hardware frames available — using hackathon demo fallback frames!");
    imageUrls = [
      "https://aatgxvesracwhd9h.public.blob.vercel-storage.com/sessions/test-e2e-1774103577200/1774103577200.jpg",
      "https://aatgxvesracwhd9h.public.blob.vercel-storage.com/sessions/test-e2e-1774103577200/1774103577730.jpg",
      "https://aatgxvesracwhd9h.public.blob.vercel-storage.com/sessions/test-e2e-1774103577200/1774103578046.jpg",
      "https://aatgxvesracwhd9h.public.blob.vercel-storage.com/sessions/test-e2e-1774103577200/1774103578499.jpg"
    ];
  }

  // Fetch images and convert to inline data parts
  console.log(`[gemini] Processing ${Math.min(imageUrls.length, 8)} images...`);
  const imageParts = await Promise.all(
    imageUrls.slice(0, 8).map(async (url, i) => {
      let base64 = "";
      if (url.startsWith("data:image/")) {
        base64 = url.split(",")[1];
        console.log(`[gemini]   image ${i + 1}: inline WebGL canvas frame`);
      } else {
        const res = await fetch(url);
        const buffer = await res.arrayBuffer();
        base64 = Buffer.from(buffer).toString("base64");
        console.log(`[gemini]   image ${i + 1}: ${(buffer.byteLength / 1024).toFixed(0)} KB remote URL`);
      }
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
    console.log(`[gemini] Parsed: ${parsed.obstacles?.length} obstacles, floor ${parsed.floor?.width_m}x${parsed.floor?.depth_m}m`);
    return parsed;
  } catch (parseErr) {
    console.error(`[gemini] JSON parse failed. Raw response:\n${cleaned.slice(0, 500)}`);
    throw new Error(`Gemini returned invalid JSON: ${(parseErr as Error).message}`);
  }
}
