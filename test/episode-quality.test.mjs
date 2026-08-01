import assert from "node:assert/strict";
import test from "node:test";
import {
  responseCompletionIssues,
  stripSources,
  validateAudioDuration,
  validateEpisodeDocument,
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

test("checks Responses API completion state", () => {
  assert.deepEqual(responseCompletionIssues({ status: "completed", incomplete_details: null }), []);
  assert.equal(
    responseCompletionIssues({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }).length,
    2
  );
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
