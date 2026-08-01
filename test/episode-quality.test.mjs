import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRevisionContext,
  extractEpisodeSection,
  replaceEpisodeSources,
  responseCompletionIssues,
  sectionMeetsMinimumWordCount,
  SPOKEN_SECTION_BUDGETS,
  stripSources,
  trimInteriorSentences,
  validateAudioDuration,
  validateEpisodeDocument,
  validateSourceList,
  wordCount
} from "../scripts/episode-quality.mjs";

const sections = [
  "Intro",
  "Highlights",
  "Incidents and Postmortems",
  "Platform/Cloud Updates",
  "Observability and Tooling",
  "Practical Takeaways",
  "Watchlist for next week"
];

function paragraph(wordTarget) {
  const vocabulary = (
    "Site Reliability Engineering teams operate distributed systems and software services with service level objectives SLOs service level indicators SLIs error budgets availability latency cloud Kubernetes databases storage networking observability telemetry tracing on-call incident response postmortems deployments releases rollouts capacity scaling load balancing queues caches"
  ).split(/\s+/);
  return Array.from({ length: wordTarget }, (_, index) => vocabulary[index % vocabulary.length]).join(" ");
}

function validEpisode() {
  const body = sections.map((section) => `## ${section}\n\n${paragraph(610)}`).join("\n\n");
  const sources = Array.from(
    { length: 8 },
    (_, index) => `- [Primary engineering source ${index + 1}](https://example.com/source-${index + 1})`
  ).join("\n");
  return `# Weekly SRE - 2026-08-01\n\n${body}\n\n## Sources\n\n${sources}\n`;
}

test("accepts an on-scope, full-length episode", () => {
  const result = validateEpisodeDocument(validEpisode());
  assert.deepEqual(result.issues, []);
  assert.equal(result.spokenWords >= 4000, true);
  assert.equal(result.sourceLinkCount, 8);
});

test("rejects a short episode", () => {
  const result = validateEpisodeDocument(validEpisode().replaceAll(paragraph(610), paragraph(50)));
  assert.equal(result.issues.some((issue) => issue.includes("Spoken script is")), true);
});

test("rejects physical reliability drift", () => {
  const result = validateEpisodeDocument(validEpisode().replace("## Highlights", "## Highlights\n\nA tornado damaged the power grid."));
  assert.equal(result.issues.some((issue) => issue.includes("weather or natural-disaster")), true);
  assert.equal(result.issues.some((issue) => issue.includes("energy-grid or nuclear")), true);
});

test("rejects a truncated source link", () => {
  const result = validateEpisodeDocument(validEpisode().replace(
    "https://example.com/source-8)",
    "https://example.com/source-8"
  ));
  assert.equal(result.issues.some((issue) => issue.includes("malformed or truncated")), true);
});

test("validates and replaces a source list independently", () => {
  const sources = Array.from(
    { length: 8 },
    (_, index) => `- [Source ${index + 1}](https://example.com/${index + 1})`
  ).join("\n");
  assert.deepEqual(validateSourceList(sources), { issues: [], sourceLinkCount: 8 });

  const repaired = replaceEpisodeSources(
    validEpisode().replace(/- \[Primary engineering source 8\][\s\S]*$/, ""),
    sources
  );
  assert.equal(extractEpisodeSection(repaired, "Sources"), sources);
  assert.equal(validateEpisodeDocument(repaired).sourceLinkCount, 8);
});

test("checks Responses API completion state", () => {
  assert.deepEqual(responseCompletionIssues({ status: "completed", incomplete_details: null }), []);
  assert.equal(
    responseCompletionIssues({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }).length,
    2
  );
});

test("builds a complete-document expansion request from a short draft", () => {
  const draft = `${paragraph(900)}\n\n## Sources\n\n- [Source](https://example.com/source)`;
  const context = buildRevisionContext(draft, ["Spoken script is too short."]);
  assert.match(context, /has 900 spoken words/);
  assert.match(context, /Expand the spoken script by approximately 3600 words/);
  assert.match(context, /complete replacement document/);
  assert.match(context, /BEGIN REJECTED DRAFT/);
  assert.match(context, /Spoken script is too short/);
});

test("extracts section bodies for independent expansion", () => {
  const episode = validEpisode();
  assert.equal(wordCount(extractEpisodeSection(episode, "Highlights")), 610);
  assert.match(extractEpisodeSection(episode, "Sources"), /Primary engineering source 8/);
  assert.equal(extractEpisodeSection(episode, "Missing"), "");
});

test("lets the strict document gate own maximum length", () => {
  const highlights = SPOKEN_SECTION_BUDGETS.find(({ name }) => name === "Highlights");
  assert.equal(sectionMeetsMinimumWordCount(highlights, 800), true);
  assert.equal(sectionMeetsMinimumWordCount(highlights, 1067), true);
  assert.equal(sectionMeetsMinimumWordCount(highlights, 799), false);
});

test("normalizes overlong prose without chopping opening or closing sentences", () => {
  const prose = [
    "Opening context stays intact.",
    "First removable technical detail has several useful words.",
    "Second removable technical detail also has several useful words.",
    "Closing takeaway stays intact."
  ].join(" ");
  const result = trimInteriorSentences(prose, 20);
  assert.match(result.text, /^Opening context stays intact\./);
  assert.match(result.text, /Closing takeaway stays intact\.$/);
  assert.equal(result.removedWords > 0, true);
  assert.equal(result.text.endsWith("."), true);
});

test("checks final audio duration", () => {
  assert.deepEqual(validateAudioDuration(30 * 60), []);
  assert.equal(validateAudioDuration(5 * 60).length, 1);
  assert.equal(validateAudioDuration(40 * 60).length, 1);
});

test("excludes Sources from spoken word count", () => {
  const document = `${paragraph(20)}\n\n## Sources\n\n${paragraph(50)}`;
  assert.equal(wordCount(stripSources(document)), 20);
});
