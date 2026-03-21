import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "dotenv";
config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function main() {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Not needed for listing, wait, genAI has list models? No, let's just make a REST call.
}
