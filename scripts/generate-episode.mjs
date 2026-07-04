import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const requestedDate = process.argv[2];
const model = process.env.OPENAI_TEXT_MODEL ?? "gpt-4.1";

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required to generate an episode.");
  process.exit(1);
}

function episodeDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
}

function extractText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const parts = [];
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

async function generateEpisode(date) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search_preview" }],
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are a senior SRE editor producing a public-safe solo podcast script. Use current public sources only. Do not include private company details, customer names, credentials, internal architecture, or anything unsuitable for a public GitHub Pages feed."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Prepare the Weekly SRE podcast episode for ${date}.

Research current reliability engineering news, notable public outages and incident writeups, cloud/provider reliability updates, Kubernetes/platform engineering developments, observability trends, and practical SRE lessons. Prioritize primary sources and incident postmortems where available.

Write a polished solo podcast script targeting about 30 minutes of audio, approximately 4,300 to 4,800 spoken words. It should not be a terse digest. Include a short intro, smooth transitions, enough context for each item, concrete reliability lessons, and a concise closing.

Use exactly these Markdown sections:
- Intro
- Highlights
- Incidents and Postmortems
- Platform/Cloud Updates
- Observability and Tooling
- Practical Takeaways
- Watchlist for next week
- Sources

Start with this H1:
# Weekly SRE - ${date}

Include source links in the Sources section and mention important source attribution naturally in the script.`
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI episode generation failed: ${response.status} ${body}`);
  }

  return extractText(await response.json());
}

const date = requestedDate ?? episodeDate();
const notePath = path.join("notes", `weekly-sre-${date}.md`);

if (existsSync(notePath)) {
  console.error(`${notePath} already exists; reusing it.`);
  console.log(notePath);
  process.exit(0);
}

await mkdir("notes", { recursive: true });
const episode = await generateEpisode(date);

if (!episode) {
  throw new Error("OpenAI episode generation returned no text.");
}

const words = wordCount(episode);
if (words < 3500 || words > 5500) {
  console.warn(`Generated episode is ${words} words, outside the broad 3,500-5,500 guardrail.`);
}

await writeFile(notePath, `${episode.trim()}\n`);
console.error(`${notePath} (${words} words)`);
console.log(notePath);
