export const SPOKEN_SECTION_BUDGETS = [
  { name: "Intro", minWords: 180, maxWords: 220 },
  { name: "Highlights", minWords: 800, maxWords: 900 },
  { name: "Incidents and Postmortems", minWords: 1000, maxWords: 1100 },
  { name: "Platform/Cloud Updates", minWords: 750, maxWords: 850 },
  { name: "Observability and Tooling", minWords: 700, maxWords: 800 },
  { name: "Practical Takeaways", minWords: 650, maxWords: 750 },
  { name: "Watchlist for next week", minWords: 250, maxWords: 300 }
];

const REQUIRED_SECTIONS = [...SPOKEN_SECTION_BUDGETS.map(({ name }) => name), "Sources"];

const SOFTWARE_SRE_SIGNALS = [
  /\bsite reliability engineering\b|\bSREs?\b/i,
  /\bdistributed systems?\b/i,
  /\bservice[- ]level (?:objectives?|indicators?)\b|\bSL[OI]s?\b/i,
  /\berror budgets?\b/i,
  /\bsoftware services?\b|\bonline services?\b/i,
  /\bavailability\b|\blatency\b/i,
  /\bcloud\b|\bKubernetes\b/i,
  /\bdatabases?\b|\bstorage systems?\b/i,
  /\bnetwork(?:ing)?\b/i,
  /\bobservability\b|\btelemetry\b|\btracing\b/i,
  /\bon[- ]call\b|\bincident response\b|\bpostmortems?\b/i,
  /\bdeployments?\b|\breleases?\b|\brollouts?\b/i,
  /\bcapacity\b|\bscal(?:e|ing|ability)\b/i,
  /\bload balanc(?:er|ing)\b|\bqueues?\b|\bcaches?\b/i
];

const OUT_OF_SCOPE_SIGNALS = [
  {
    label: "weather or natural-disaster reliability",
    pattern: /\b(?:tornados?|tornadoes|hurricanes?|wildfires?|earthquakes?|severe weather|solar flares?|geomagnetic storms?)\b/i
  },
  {
    label: "energy-grid or nuclear reliability",
    pattern: /\b(?:nuclear reactors?|reactor criticality|electrical grids?|power grids?|grid stability)\b/i
  },
  {
    label: "transportation or manufacturing reliability",
    pattern: /\b(?:transportation infrastructure|manufacturing reliability|industrial equipment reliability)\b/i
  }
];

export const MIN_EPISODE_WORDS = 4000;
export const MAX_EPISODE_WORDS = 5200;
export const TARGET_EPISODE_WORDS = 4500;
export const NORMALIZED_EPISODE_WORDS = 5000;
export const MIN_AUDIO_SECONDS = 25 * 60;
export const MAX_AUDIO_SECONDS = 35 * 60;
export const MIN_SOURCE_LINKS = 8;

export function stripSources(markdown) {
  return markdown.replace(/^## Sources\s*$[\s\S]*$/im, "").trim();
}

export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function extractEpisodeSection(markdown, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(`^## ${escaped}\\s*$`, "mi").exec(markdown);
  if (!heading) {
    return "";
  }
  const remainder = markdown.slice(heading.index + heading[0].length);
  const nextHeading = remainder.search(/^## /m);
  return remainder.slice(0, nextHeading === -1 ? undefined : nextHeading).trim();
}

export function sectionMeetsMinimumWordCount(section, words) {
  return words >= section.minWords;
}

export function trimInteriorSentences(text, maxWordsToRemove) {
  if (maxWordsToRemove <= 0) {
    return { text, removedWords: 0 };
  }

  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  if (sentences.length < 3) {
    return { text, removedWords: 0 };
  }

  const keep = sentences.map(() => true);
  let removedWords = 0;
  for (let index = sentences.length - 2; index > 0; index -= 1) {
    const sentenceWords = wordCount(sentences[index]);
    if (removedWords + sentenceWords <= maxWordsToRemove) {
      keep[index] = false;
      removedWords += sentenceWords;
    }
    if (removedWords === maxWordsToRemove) {
      break;
    }
  }

  return {
    text: sentences.filter((_, index) => keep[index]).join(" "),
    removedWords
  };
}

export function responseCompletionIssues(response) {
  const issues = [];
  if (response?.status !== "completed") {
    issues.push(`OpenAI response status is ${response?.status ?? "missing"}, not completed.`);
  }
  if (response?.incomplete_details) {
    issues.push(`OpenAI response is incomplete: ${response.incomplete_details.reason ?? "unknown reason"}.`);
  }
  return issues;
}

export function buildRevisionContext(draft, issues) {
  if (!draft) {
    return issues.length === 0
      ? ""
      : `\nA previous attempt was rejected for these reasons:\n${issues.map((issue) => `- ${issue}`).join("\n")}\nStart over and correct every issue.`;
  }

  const spokenWords = wordCount(stripSources(draft));
  const wordDelta = TARGET_EPISODE_WORDS - spokenWords;
  const lengthDirection = wordDelta > 0
    ? `Expand the spoken script by approximately ${wordDelta} words.`
    : `Condense the spoken script by approximately ${Math.abs(wordDelta)} words.`;

  return `

REVISION REQUIRED
The rejected draft below has ${spokenWords} spoken words. ${lengthDirection}
Return a complete replacement document from the H1 through the Sources section; do not return a continuation, outline, patch, or commentary. Preserve useful research and valid sources, correct every listed defect, deepen the technical explanations and operational lessons, and avoid padding or repetition.

Rejected-draft issues:
${issues.map((issue) => `- ${issue}`).join("\n")}

--- BEGIN REJECTED DRAFT ---
${draft}
--- END REJECTED DRAFT ---`;
}

export function validateAudioDuration(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return ["Generated audio does not have a valid positive duration."];
  }
  if (durationSeconds < MIN_AUDIO_SECONDS || durationSeconds > MAX_AUDIO_SECONDS) {
    return [
      `Generated audio is ${(durationSeconds / 60).toFixed(1)} minutes; expected 25-35 minutes.`
    ];
  }
  return [];
}

export function validateEpisodeDocument(markdown) {
  const issues = [];
  const spokenScript = stripSources(markdown);
  const spokenWords = wordCount(spokenScript);

  if (!/^# Weekly SRE - \d{4}-\d{2}-\d{2}\s*$/m.test(markdown)) {
    issues.push("Episode must start with an H1 in the form '# Weekly SRE - YYYY-MM-DD'.");
  }

  for (const section of REQUIRED_SECTIONS) {
    const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`^## ${escaped}\\s*$`, "mi").test(markdown)) {
      issues.push(`Missing required section: ${section}.`);
    }
  }

  if (spokenWords < MIN_EPISODE_WORDS || spokenWords > MAX_EPISODE_WORDS) {
    issues.push(
      `Spoken script is ${spokenWords} words; expected ${MIN_EPISODE_WORDS}-${MAX_EPISODE_WORDS} words for a roughly 30-minute episode.`
    );
  }

  const softwareSignalCount = SOFTWARE_SRE_SIGNALS.filter((pattern) => pattern.test(spokenScript)).length;
  if (softwareSignalCount < 6) {
    issues.push(
      `Script has only ${softwareSignalCount} distinct software-SRE signals; expected at least 6.`
    );
  }

  for (const { label, pattern } of OUT_OF_SCOPE_SIGNALS) {
    if (pattern.test(spokenScript)) {
      issues.push(`Script includes out-of-scope ${label}.`);
    }
  }

  const sources = markdown.match(/^## Sources\s*$([\s\S]*)$/im)?.[1] ?? "";
  const linkOpeners = sources.match(/\]\(/g)?.length ?? 0;
  const links = [...sources.matchAll(/\[[^\]\n]+\]\((https:\/\/[^\s)]+)\)/g)];

  if (links.length < MIN_SOURCE_LINKS) {
    issues.push(`Sources section has ${links.length} valid HTTPS links; expected at least ${MIN_SOURCE_LINKS}.`);
  }
  if (linkOpeners !== links.length) {
    issues.push("Sources section contains a malformed or truncated Markdown link.");
  }

  for (const [, url] of links) {
    try {
      new URL(url);
    } catch {
      issues.push(`Sources section contains an invalid URL: ${url}`);
    }
  }

  return {
    issues,
    spokenWords,
    softwareSignalCount,
    sourceLinkCount: links.length
  };
}
