import { readFile } from "node:fs/promises";

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

export function markdownToPlainText(markdown) {
  return markdown
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function slugFromNotePath(notePath) {
  const file = notePath.split("/").pop() ?? notePath;
  return file.replace(/\.md$/i, "");
}
