import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { lookup } from "node:dns/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { markdownToPlainText, readJson, slugFromNotePath } from "./lib.mjs";

const notePath = process.argv[2];
const maxChunkChars = 3500;

if (!notePath) {
  console.error("Usage: npm run generate:audio -- notes/weekly-sre-YYYY-MM-DD.md");
  process.exit(1);
}

const config = await readJson("config/podcast.json");
const note = await readFile(notePath, "utf8");
const input = markdownToPlainText(note);
const outputPath = path.join("episodes", `${slugFromNotePath(notePath)}.mp3`);

await mkdir("episodes", { recursive: true });

function commandExists(command) {
  return spawnSync("which", [command], { stdio: "ignore" }).status === 0;
}

const hasSystemTtsCommands = commandExists("say") && commandExists("ffmpeg") && commandExists("ffprobe");
const hasSystemTts = hasSystemTtsCommands && await canGenerateSystemTts();

async function chooseTtsBackend() {
  if (!process.env.OPENAI_API_KEY) {
    if (hasSystemTts) {
      console.warn("OPENAI_API_KEY is not set; falling back to local system TTS.");
      return "system";
    }
    console.error("OPENAI_API_KEY is required to generate audio, and local system TTS is unavailable.");
    process.exit(1);
  }

  try {
    await lookup("api.openai.com");
    return "openai";
  } catch (error) {
    if (hasSystemTts) {
      console.warn(`OpenAI TTS DNS preflight failed (${error.code ?? error.message}); falling back to local system TTS.`);
      return "system";
    }
    console.error(`OpenAI TTS DNS preflight failed (${error.code ?? error.message}), and local system TTS is unavailable.`);
    process.exit(1);
  }
}

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

async function generateSystemSpeech(text, destination) {
  const textPath = `${destination}.txt`;
  const aiffPath = `${destination}.aiff`;
  await writeFile(textPath, text);

  const sayResult = spawnSync("say", ["-f", textPath, "-o", aiffPath], { stdio: "inherit" });
  if (sayResult.status !== 0) {
    throw new Error(`say failed with exit code ${sayResult.status}`);
  }

  runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", aiffPath, "-codec:a", "libmp3lame", "-q:a", "4", destination]);
  assertPlayableAudio(destination);
}

async function canGenerateSystemTts() {
  const testDir = await mkdtemp(path.join(tmpdir(), "weekly-sre-tts-check-"));
  try {
    await generateSystemSpeech("System text to speech preflight.", path.join(testDir, "preflight.mp3"));
    return true;
  } catch {
    return false;
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
}

function runFfmpeg(args) {
  const result = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed with exit code ${result.status}`);
  }
}

function assertPlayableAudio(audioPath) {
  const result = spawnSync("ffprobe", ["-hide_banner", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath], {
    encoding: "utf8"
  });
  const duration = Number.parseFloat(result.stdout.trim());
  if (result.status !== 0 || !Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Generated audio is not playable: ${audioPath}`);
  }
}

const chunks = chunkText(input);
const estimatedMinutes = Math.round((input.split(/\s+/).filter(Boolean).length / 150) * 10) / 10;
const tempDir = await mkdtemp(path.join(tmpdir(), "weekly-sre-tts-"));
let ttsBackend = await chooseTtsBackend();

try {
  const segmentPaths = [];
  for (const [index, chunk] of chunks.entries()) {
    const segmentPath = path.join(tempDir, `segment-${String(index + 1).padStart(3, "0")}.mp3`);
    console.log(`Generating audio segment ${index + 1}/${chunks.length} with ${ttsBackend === "openai" ? "OpenAI TTS" : "local system TTS"}`);
    if (ttsBackend === "openai") {
      try {
        await generateSpeech(chunk, segmentPath);
      } catch (error) {
        if (!hasSystemTts) {
          throw error;
        }
        console.warn(`OpenAI TTS request failed (${error.cause?.code ?? error.message}); falling back to local system TTS for remaining segments.`);
        ttsBackend = "system";
        await generateSystemSpeech(chunk, segmentPath);
      }
    } else {
      await generateSystemSpeech(chunk, segmentPath);
    }
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
