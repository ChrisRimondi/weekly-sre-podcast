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

The Codex weekly automation prepares the public-safe note in `notes/weekly-sre-YYYY-MM-DD.md`. Network access from Codex automation runs may be restricted, so publishing is delegated to GitHub Actions:

1. The automation commits the note to GitHub.
2. `.github/workflows/publish-episode.yml` runs on GitHub infrastructure.
3. The workflow generates the MP3 with OpenAI TTS, updates `feed.xml`, commits the audio and feed, and pushes the result to GitHub Pages.

You can also run the workflow manually from GitHub Actions with the note path as input.

## Public content rule

GitHub Pages output is public. Keep summaries free of internal incidents, customer names, credentials, private architecture details, and anything that should not be indexed.

## TTS

The audio script uses OpenAI's Speech endpoint with `gpt-4o-mini-tts` and the `cedar` voice. Long scripts are split into multiple TTS segments and stitched into a single MP3 with `ffmpeg`.

For a roughly 30-minute episode, write about 4,300 to 4,800 spoken words. The podcast description and episode descriptions disclose that the voice is AI-generated.
