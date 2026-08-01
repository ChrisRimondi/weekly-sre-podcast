const REQUIRED_SECTIONS = [
  "Intro",
  "Highlights",
  "Incidents and Postmortems",
  "Platform/Cloud Updates",
  "Observability and Tooling",
  "Practical Takeaways",
  "Watchlist for next week",
  "Sources"
];

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
export const MIN_AUDIO_SECONDS = 25 * 60;
export const MAX_AUDIO_SECONDS = 35 * 60;
export const MIN_SOURCE_LINKS = 8;

export function stripSources(markdown) {
  return markdown.replace(/^## Sources\s*$[\s\S]*$/im, "").trim();
}

export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
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
