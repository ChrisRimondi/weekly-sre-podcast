import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { markdownToPlainText, readJson, slugFromNotePath } from "./lib.mjs";

const notePath = process.argv[2];

if (!notePath) {
  console.error("Usage: npm run generate:audio -- notes/weekly-sre-YYYY-MM-DD.md");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required to generate audio.");
  process.exit(1);
}

const config = await readJson("config/podcast.json");
const note = await readFile(notePath, "utf8");
const input = markdownToPlainText(note);
const outputPath = path.join("episodes", `${slugFromNotePath(notePath)}.mp3`);

await mkdir("episodes", { recursive: true });

const response = await fetch("https://api.openai.com/v1/audio/speech", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: config.tts.model,
    voice: config.tts.voice,
    input,
    instructions: config.tts.instructions
  })
});

if (!response.ok) {
  const errorBody = await response.text();
  throw new Error(`OpenAI TTS request failed: ${response.status} ${errorBody}`);
}

await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
console.log(outputPath);
