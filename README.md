# Weekly SRE Podcast

Static GitHub Pages podcast feed for the weekly SRE briefing.

## Setup

1. Update `config/podcast.json` with your owner email.
2. Add cover art at `artwork/cover.jpg`.
3. Enable GitHub Pages for the repository.
4. Set `OPENAI_API_KEY` in the environment where the automation runs.

## Generate an episode

Create a note in `notes/weekly-sre-YYYY-MM-DD.md`, then run:

```sh
npm run publish:episode -- notes/weekly-sre-YYYY-MM-DD.md
```

This generates the MP3 with OpenAI TTS, updates `feed.xml`, commits the new episode, and pushes it.

## Public content rule

GitHub Pages output is public. Keep summaries free of internal incidents, customer names, credentials, private architecture details, and anything that should not be indexed.

## TTS

The audio script uses OpenAI's Speech endpoint with `gpt-4o-mini-tts` and the `cedar` voice. The podcast description and episode descriptions disclose that the voice is AI-generated.
