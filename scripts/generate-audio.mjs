import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { markdownToPlainText, readJson, slugFromNotePath } from "./lib.mjs";

const notePath = process.argv[2];
const maxChunkChars = 3500;

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

function chunkText(text) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let start = 0; start < paragraph.length; start += maxChunkChars) {
        chunks.push(paragraph.slice(start, start + maxChunkChars));
      }
      continue;
    }

    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > maxChunkChars) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

async function generateSpeech(text, destination) {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.tts.model,
      voice: config.tts.voice,
      input: text,
      instructions: config.tts.instructions
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI TTS request failed: ${response.status} ${errorBody}`);
  }

  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

function runFfmpeg(args) {
  const result = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed with exit code ${result.status}`);
  }
}

const chunks = chunkText(input);
const estimatedMinutes = Math.round((input.split(/\s+/).filter(Boolean).length / 150) * 10) / 10;
const tempDir = await mkdtemp(path.join(tmpdir(), "weekly-sre-tts-"));

try {
  const segmentPaths = [];
  for (const [index, chunk] of chunks.entries()) {
    const segmentPath = path.join(tempDir, `segment-${String(index + 1).padStart(3, "0")}.mp3`);
    console.log(`Generating audio segment ${index + 1}/${chunks.length}`);
    await generateSpeech(chunk, segmentPath);
    segmentPaths.push(segmentPath);
  }

  if (segmentPaths.length === 1) {
    await writeFile(outputPath, await readFile(segmentPaths[0]));
  } else {
    const listPath = path.join(tempDir, "segments.txt");
    const list = segmentPaths.map((segmentPath) => `file '${segmentPath.replaceAll("'", "'\\''")}'`).join("\n");
    await writeFile(listPath, list);
    runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath]);
  }

  console.log(`${outputPath} (${chunks.length} segment${chunks.length === 1 ? "" : "s"}, approx ${estimatedMinutes} min from script length)`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
