import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { escapeXml, markdownToPlainText, readJson } from "./lib.mjs";

const config = await readJson("config/podcast.json");

async function getEpisodes() {
  const noteFiles = (await readdir("notes"))
    .filter((file) => file.endsWith(".md"))
    .sort()
    .reverse();

  const episodes = [];
  for (const noteFile of noteFiles) {
    const slug = noteFile.replace(/\.md$/i, "");
    const audioPath = path.join("episodes", `${slug}.mp3`);
    let audioStats;
    try {
      audioStats = await stat(audioPath);
    } catch {
      continue;
    }

    const dateMatch = slug.match(/(\d{4}-\d{2}-\d{2})$/);
    const pubDate = dateMatch ? new Date(`${dateMatch[1]}T12:00:00-04:00`) : new Date();
    const note = await readFile(path.join("notes", noteFile), "utf8");
    const firstHeading = note.match(/^#\s+(.+)$/m)?.[1] ?? slug;
    const summary = markdownToPlainText(note).slice(0, 500);

    episodes.push({
      slug,
      title: firstHeading,
      description: `${summary}\n\nDisclosure: this episode is AI-generated.`,
      pubDate,
      audioUrl: `${config.siteUrl}/episodes/${slug}.mp3`,
      length: audioStats.size
    });
  }
  return episodes;
}

const episodes = await getEpisodes();
const latestDate = episodes[0]?.pubDate ?? new Date();

const items = episodes
  .map((episode) => `    <item>
      <title>${escapeXml(episode.title)}</title>
      <description>${escapeXml(episode.description)}</description>
      <pubDate>${episode.pubDate.toUTCString()}</pubDate>
      <guid isPermaLink="false">${escapeXml(episode.slug)}</guid>
      <enclosure url="${escapeXml(episode.audioUrl)}" length="${episode.length}" type="audio/mpeg"/>
      <itunes:explicit>${config.explicit ? "true" : "false"}</itunes:explicit>
    </item>`)
  .join("\n");

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(config.title)}</title>
    <link>${escapeXml(config.siteUrl)}</link>
    <description>${escapeXml(config.description)} Disclosure: episodes use AI-generated voices.</description>
    <language>${escapeXml(config.language)}</language>
    <lastBuildDate>${latestDate.toUTCString()}</lastBuildDate>
    <itunes:author>${escapeXml(config.author)}</itunes:author>
    <itunes:owner>
      <itunes:name>${escapeXml(config.ownerName)}</itunes:name>
      <itunes:email>${escapeXml(config.ownerEmail)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${escapeXml(config.imageUrl)}"/>
    <itunes:category text="${escapeXml(config.category)}"/>
    <itunes:explicit>${config.explicit ? "true" : "false"}</itunes:explicit>
${items}
  </channel>
</rss>
`;

await writeFile("feed.xml", feed);
console.log(`feed.xml (${episodes.length} episode${episodes.length === 1 ? "" : "s"})`);
