import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const notePath = process.argv[2];

if (!notePath) {
  console.error("Usage: npm run publish:episode -- notes/weekly-sre-YYYY-MM-DD.md");
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runResult(command, args) {
  return spawnSync(command, args, { stdio: "inherit" });
}

const slug = notePath.split("/").pop().replace(/\.md$/i, "");
const audioPath = `episodes/${slug}.mp3`;

if (!existsSync(audioPath)) {
  run("node", ["scripts/generate-audio.mjs", notePath]);
}

run("node", ["scripts/generate-feed.mjs"]);
run("git", ["add", notePath, audioPath, "feed.xml"]);

const diff = spawnSync("git", ["diff", "--cached", "--quiet"]);
if (diff.status === 0) {
  console.log(`No publish changes for ${slug}.`);
  process.exit(0);
}

const commit = runResult("git", ["commit", "-m", `Publish ${slug}`]);
if (commit.status !== 0) {
  process.exit(commit.status ?? 1);
}

run("git", ["push"]);
