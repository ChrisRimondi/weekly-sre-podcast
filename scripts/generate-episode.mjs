import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MAX_EPISODE_WORDS,
  MIN_EPISODE_WORDS,
  responseCompletionIssues,
  validateEpisodeDocument
} from "./episode-quality.mjs";

const args = process.argv.slice(2);
const replaceExisting = args.includes("--replace");
const requestedDate = args.find((argument) => !argument.startsWith("--"));
const model = process.env.OPENAI_TEXT_MODEL ?? "gpt-4.1";
const maxAttempts = 3;

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

function generationPrompt(date, priorIssues = []) {
  const retryContext = priorIssues.length === 0
    ? ""
    : `\nA previous draft was rejected for these reasons:\n${priorIssues.map((issue) => `- ${issue}`).join("\n")}\nStart over and correct every issue.`;

  return `Prepare the Weekly SRE podcast episode for ${date}.

For this podcast, Site Reliability Engineering means the Google-style software engineering discipline of designing, operating, and improving reliable software services and distributed systems. Every story must teach a concrete lesson for people operating production software.

IN SCOPE:
- SLOs, SLIs, error budgets, availability, latency, capacity planning, and toil reduction
- Public software-service incidents, technical postmortems, and incident response
- Distributed systems, cloud platforms, Kubernetes, networking, databases, storage, queues, caches, and deployment systems
- Observability, telemetry, alerting, on-call practices, resilience testing, and production engineering
- Platform engineering only when it directly affects software-service reliability

OUT OF SCOPE:
- Weather, tornadoes, hurricanes, wildfires, earthquakes, solar activity, and natural-disaster preparedness
- Electrical-grid stability, energy policy, nuclear power, transportation, manufacturing, and physical-equipment reliability
- Generic infrastructure or business news with no direct software-service reliability lesson
- A story does not qualify merely because it contains the words reliability, infrastructure, incident, or outage

Research public material published during the seven days ending ${date}. Prioritize primary engineering sources and first-party incident reports. Verify that each selected item is about operating software systems; discard it otherwise.

Write a polished solo podcast script for an experienced SRE audience. The SPOKEN portion, excluding the Sources section, must contain ${MIN_EPISODE_WORDS}-${MAX_EPISODE_WORDS} words, targeting 4,500 words and roughly 30 minutes at 150 words per minute. Do not return an outline or terse digest. Use connected spoken prose, explain technical mechanisms, and draw specific operational lessons.

Use these approximate spoken-word budgets:
- Intro: 180-220 words
- Highlights: 800-900 words
- Incidents and Postmortems: 1,000-1,100 words
- Platform/Cloud Updates: 750-850 words
- Observability and Tooling: 700-800 words
- Practical Takeaways: 650-750 words
- Watchlist for next week: 250-300 words

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

Include at least eight complete HTTPS Markdown links in the Sources section. Mention important source attribution naturally in the spoken script. Before returning, verify the topical scope, section structure, source links, and spoken word count. Return only the finished episode document.${retryContext}`;
}

async function generateEpisodeAttempt(date, priorIssues) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search_preview" }],
      max_output_tokens: 12000,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are a senior Site Reliability Engineering editor in the Google SRE tradition. Produce a public-safe solo podcast script about operating reliable software services and distributed systems. Use current public sources only. Never substitute physical infrastructure, weather, energy, or general disaster reliability for software SRE. Do not include private company details, customer names, credentials, internal architecture, or anything unsuitable for a public GitHub Pages feed."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: generationPrompt(date, priorIssues)
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

  return response.json();
}

const date = requestedDate ?? episodeDate();
const notePath = path.join("notes", `weekly-sre-${date}.md`);

if (existsSync(notePath) && !replaceExisting) {
  const existing = await readFile(notePath, "utf8");
  const validation = validateEpisodeDocument(existing);
  if (validation.issues.length > 0) {
    throw new Error(
      `${notePath} already exists but fails publication checks:\n- ${validation.issues.join("\n- ")}\nRun again with --replace to regenerate it.`
    );
  }
  console.error(`${notePath} already exists and passes publication checks; reusing it.`);
  console.log(notePath);
  process.exit(0);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required to generate an episode.");
  process.exit(1);
}

await mkdir("notes", { recursive: true });
let episode = "";
let priorIssues = [];

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  console.error(`Generating episode draft ${attempt}/${maxAttempts} with ${model}...`);
  const apiResponse = await generateEpisodeAttempt(date, priorIssues);
  const completionIssues = responseCompletionIssues(apiResponse);
  const candidate = extractText(apiResponse);
  const validation = validateEpisodeDocument(candidate);
  const issues = [...completionIssues, ...validation.issues];

  if (candidate && issues.length === 0) {
    episode = candidate;
    console.error(
      `Draft passed: ${validation.spokenWords} spoken words, ${validation.sourceLinkCount} sources, ${validation.softwareSignalCount} software-SRE signals.`
    );
    break;
  }

  priorIssues = candidate ? issues : [...issues, "OpenAI returned no episode text."];
  console.error(`Draft ${attempt} rejected:\n- ${priorIssues.join("\n- ")}`);
}

if (!episode) {
  throw new Error(`Unable to generate a publishable episode after ${maxAttempts} attempts.`);
}

await writeFile(notePath, `${episode.trim()}\n`);
console.log(notePath);
