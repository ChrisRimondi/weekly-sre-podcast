import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildRevisionContext,
  extractEpisodeSection,
  MAX_EPISODE_WORDS,
  MIN_EPISODE_WORDS,
  NORMALIZED_EPISODE_WORDS,
  replaceEpisodeSources,
  responseCompletionIssues,
  sectionMeetsMinimumWordCount,
  SPOKEN_SECTION_BUDGETS,
  stripSources,
  trimInteriorSentences,
  validateEpisodeDocument,
  validateSourceList,
  wordCount
} from "./episode-quality.mjs";

const args = process.argv.slice(2);
const replaceExisting = args.includes("--replace");
const requestedDate = args.find((argument) => !argument.startsWith("--"));
const model = process.env.OPENAI_TEXT_MODEL ?? "gpt-4.1";
const maxResearchAttempts = 3;
const maxSectionAttempts = 3;
const maxSourceAttempts = 3;

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

function generationPrompt(date, priorIssues = [], priorDraft = "") {
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

Include at least eight complete HTTPS Markdown links in the Sources section. Mention important source attribution naturally in the spoken script. Before returning, verify the topical scope, section structure, source links, and spoken word count. Return only the finished episode document.${buildRevisionContext(priorDraft, priorIssues)}`;
}

async function generateEpisodeAttempt(date, priorIssues, priorDraft) {
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
              text: generationPrompt(date, priorIssues, priorDraft)
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

function cleanSourceList(text) {
  return text.replace(/^## Sources\s*/i, "").trim();
}

async function generateSourceList(date, researchDraft) {
  let priorIssues = [];

  for (let attempt = 1; attempt <= maxSourceAttempts; attempt += 1) {
    const retry = priorIssues.length === 0
      ? ""
      : `\nThe previous source list was rejected:\n${priorIssues.map((issue) => `- ${issue}`).join("\n")}\nCreate a fresh, complete replacement list.`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        tools: [{ type: "web_search_preview" }],
        max_output_tokens: 3000,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You are the research editor for a public software Site Reliability Engineering podcast. Find accurate public sources about software services, distributed systems, cloud platforms, observability, and production engineering. Exclude weather, natural disasters, energy grids, nuclear power, transportation, manufacturing, and physical-equipment reliability."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Research and return 8-12 sources that support the Weekly SRE draft below for the seven days ending ${date}. Prioritize primary engineering posts, official documentation or release notes, and first-party incident reports. Return only a Markdown bullet list. Every bullet must have exactly this form: - [descriptive title](https://complete-url). Do not return a heading, prose, bare URLs, citation syntax, or truncated links.\n\n--- DRAFT ---\n${researchDraft}\n--- END DRAFT ---${retry}`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI source generation failed: ${response.status} ${body}`);
    }

    const apiResponse = await response.json();
    const sources = cleanSourceList(extractText(apiResponse));
    const validation = validateSourceList(sources);
    priorIssues = [...responseCompletionIssues(apiResponse), ...validation.issues];
    if (sources && priorIssues.length === 0) {
      console.error(`Source repair passed with ${validation.sourceLinkCount} links (attempt ${attempt}/${maxSourceAttempts}).`);
      return sources;
    }
    console.error(`Source repair attempt ${attempt}/${maxSourceAttempts} rejected:\n- ${priorIssues.join("\n- ")}`);
  }

  throw new Error(`Unable to generate at least eight valid source links after ${maxSourceAttempts} attempts.`);
}

function cleanSectionBody(text, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`^## ${escaped}\\s*`, "i"), "")
    .trim();
}

async function generateSection(date, section, researchDraft) {
  const originalSection = extractEpisodeSection(researchDraft, section.name);
  let priorBody = originalSection;

  for (let attempt = 1; attempt <= maxSectionAttempts; attempt += 1) {
    const priorWords = wordCount(priorBody);
    const revision = attempt === 1
      ? ""
      : `\nThe prior version below was ${priorWords} words and missed the required ${section.minWords}-${section.maxWords}-word range. Return a complete replacement that corrects the length without padding or repetition.\n\n--- PRIOR SECTION ---\n${priorBody}\n--- END PRIOR SECTION ---`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 3000,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "You are expanding one section of a public podcast for experienced Site Reliability Engineers. Stay strictly within software services, distributed systems, production engineering, and Google-style SRE. Use the supplied researched draft as the factual and source basis."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Write only the body of the '${section.name}' section for the Weekly SRE episode dated ${date}. Write ${section.minWords}-${section.maxWords} words of natural spoken prose. Do not include a heading, Sources section, preface, word-count note, or commentary. Deepen technical mechanisms and concrete operational lessons; do not invent facts beyond the researched draft.\n\n--- RESEARCHED DRAFT ---\n${researchDraft}\n--- END RESEARCHED DRAFT ---${revision}`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI section generation failed for ${section.name}: ${response.status} ${body}`);
    }

    const apiResponse = await response.json();
    const completionIssues = responseCompletionIssues(apiResponse);
    const body = cleanSectionBody(extractText(apiResponse), section.name);
    const words = wordCount(body);
    const hasUnexpectedHeading = /^## /m.test(body);

    if (
      completionIssues.length === 0 &&
      !hasUnexpectedHeading &&
      sectionMeetsMinimumWordCount(section, words)
    ) {
      console.error(`${section.name}: ${words} words (attempt ${attempt}/${maxSectionAttempts}).`);
      return body;
    }

    priorBody = body || priorBody;
    console.error(
      `${section.name} attempt ${attempt}/${maxSectionAttempts} rejected: ${words} words${hasUnexpectedHeading ? ", unexpected heading" : ""}${completionIssues.length ? `, ${completionIssues.join(" ")}` : ""}.`
    );
  }

  throw new Error(`Unable to generate at least ${section.minWords} words for ${section.name}.`);
}

async function expandEpisodeBySection(date, researchDraft) {
  const sources = extractEpisodeSection(researchDraft, "Sources");
  if (!sources) {
    throw new Error("Researched draft has no Sources section to preserve.");
  }

  const sections = [];
  for (const section of SPOKEN_SECTION_BUDGETS) {
    console.error(`Expanding ${section.name} to ${section.minWords}-${section.maxWords} words...`);
    sections.push({ name: section.name, body: await generateSection(date, section, researchDraft) });
  }

  function assemble() {
    const spokenSections = sections.map(({ name, body }) => `## ${name}\n\n${body}`).join("\n\n");
    return `# Weekly SRE - ${date}\n\n${spokenSections}\n\n## Sources\n\n${sources}`;
  }

  let expanded = assemble();
  const expandedWords = wordCount(stripSources(expanded));
  if (expandedWords > MAX_EPISODE_WORDS) {
    let wordsToRemove = expandedWords - NORMALIZED_EPISODE_WORDS;
    const candidates = sections
      .map((section, index) => {
        const budget = SPOKEN_SECTION_BUDGETS.find(({ name }) => name === section.name);
        return {
          index,
          removableWords: Math.max(0, wordCount(section.body) - budget.minWords)
        };
      })
      .filter(({ removableWords }) => removableWords > 0)
      .sort((left, right) => right.removableWords - left.removableWords);

    for (const { index, removableWords } of candidates) {
      if (wordsToRemove <= 0) {
        break;
      }
      const result = trimInteriorSentences(
        sections[index].body,
        Math.min(wordsToRemove, removableWords)
      );
      sections[index].body = result.text;
      wordsToRemove -= result.removedWords;
    }

    expanded = assemble();
    console.error(`Normalized expanded draft from ${expandedWords} to ${wordCount(stripSources(expanded))} spoken words.`);
  }

  return expanded;
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
let priorDraft = "";

for (let attempt = 1; attempt <= maxResearchAttempts; attempt += 1) {
  console.error(`Generating researched episode draft ${attempt}/${maxResearchAttempts} with ${model}...`);
  const apiResponse = await generateEpisodeAttempt(date, priorIssues, priorDraft);
  const completionIssues = responseCompletionIssues(apiResponse);
  let candidate = extractText(apiResponse);
  let validation = validateEpisodeDocument(candidate);
  let issues = [...completionIssues, ...validation.issues];

  const sourceIssues = issues.filter((issue) => issue.startsWith("Sources section "));
  const issuesOtherThanLengthAndSources = issues.filter(
    (issue) => !issue.startsWith("Spoken script is ") && !issue.startsWith("Sources section ")
  );
  if (candidate && sourceIssues.length > 0 && issuesOtherThanLengthAndSources.length === 0) {
    console.error(`Research draft has usable scope and structure but needs source repair:\n- ${sourceIssues.join("\n- ")}`);
    try {
      candidate = replaceEpisodeSources(candidate, await generateSourceList(date, candidate));
      validation = validateEpisodeDocument(candidate);
      issues = validation.issues;
    } catch (error) {
      issues = [...issues, error.message];
      console.error(`Source repair failed: ${error.message}`);
    }
  }

  if (candidate && issues.length === 0) {
    episode = candidate;
    console.error(
      `Draft passed: ${validation.spokenWords} spoken words, ${validation.sourceLinkCount} sources, ${validation.softwareSignalCount} software-SRE signals.`
    );
    break;
  }

  const nonLengthIssues = issues.filter((issue) => !issue.startsWith("Spoken script is "));
  if (candidate && nonLengthIssues.length === 0) {
    console.error(`Research draft passed topical, structural, and source checks at ${validation.spokenWords} words; expanding it section by section.`);
    try {
      const expanded = await expandEpisodeBySection(date, candidate);
      const expandedValidation = validateEpisodeDocument(expanded);
      if (expandedValidation.issues.length === 0) {
        episode = expanded;
        console.error(
          `Expanded draft passed: ${expandedValidation.spokenWords} spoken words, ${expandedValidation.sourceLinkCount} sources, ${expandedValidation.softwareSignalCount} software-SRE signals.`
        );
        break;
      }
      priorIssues = expandedValidation.issues;
      priorDraft = expanded;
      console.error(`Expanded draft rejected:\n- ${priorIssues.join("\n- ")}`);
      continue;
    } catch (error) {
      priorIssues = [error.message];
      priorDraft = candidate;
      console.error(`Section expansion failed: ${error.message}`);
      continue;
    }
  }

  priorIssues = candidate ? issues : [...issues, "OpenAI returned no episode text."];
  if (candidate) {
    priorDraft = candidate;
  }
  console.error(`Draft ${attempt} rejected:\n- ${priorIssues.join("\n- ")}`);
}

if (!episode) {
  throw new Error(`Unable to generate a publishable episode after ${maxResearchAttempts} researched-draft attempts.`);
}

await writeFile(notePath, `${episode.trim()}\n`);
console.log(notePath);
