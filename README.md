# Weekly SRE Podcast

Static GitHub Pages podcast feed for the weekly SRE briefing.

## Setup

1. Update `config/podcast.json` with your owner email.
2. Add cover art at `artwork/cover.jpg`.
3. Enable GitHub Pages for the repository.
4. Set `OPENAI_API_KEY` as a GitHub Actions repository secret.

## Generate an episode

Create a note in `notes/weekly-sre-YYYY-MM-DD.md`, then run:

```sh
npm run publish:episode -- notes/weekly-sre-YYYY-MM-DD.md
```

This generates the MP3 with OpenAI TTS, updates `feed.xml`, commits the new episode, and pushes it.

## Recurring automation

GitHub Actions runs the whole weekly podcast pipeline on a Saturday cron:

1. `.github/workflows/publish-episode.yml` generates the public-safe note with OpenAI and web search.
2. The workflow generates the MP3 with OpenAI TTS.
3. The workflow updates `feed.xml`, commits the note/audio/feed, and pushes the result to GitHub Pages.

Publication is blocked unless the generated episode:

- stays focused on Google-style SRE for software services and distributed systems;
- contains 4,000 to 5,200 spoken words, excluding the Sources section;
- includes every required section and at least eight complete HTTPS source links; and
- produces 25 to 35 minutes of playable audio.

The generator first creates a researched draft, then expands each spoken section independently to its minimum word budget. The strict 4,000-to-5,200-word document gate remains authoritative for maximum length. If the researched draft or any expanded section cannot pass its gates after three attempts, the workflow fails without publishing a short or off-topic episode.

Required repository secret:

- `OPENAI_API_KEY`

Optional repository variable:

- `OPENAI_TEXT_MODEL` defaults to `gpt-4.1` if unset.

You can also run the workflow manually from GitHub Actions. Provide `note_path` to publish an existing note, or `episode_date` to generate a specific date. Set `regenerate` with `episode_date` to replace an existing note and rebuild its audio.

## Public content rule

GitHub Pages output is public. Keep summaries free of internal incidents, customer names, credentials, private architecture details, and anything that should not be indexed.

## TTS

The audio script uses OpenAI's Speech endpoint with `gpt-4o-mini-tts` and the `cedar` voice. Long scripts are split into multiple TTS segments and stitched into a single MP3 with `ffmpeg`.

For a roughly 30-minute episode, write about 4,300 to 4,800 spoken words. The publisher enforces a broad 4,000-to-5,200-word gate and a 25-to-35-minute audio gate. The podcast description and episode descriptions disclose that the voice is AI-generated.
