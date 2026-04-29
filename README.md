<div align="center">

# Operator

**Local-first AI workspace for investigative journalism**

Upload notes, sources, photos, and documents. Get structured AI analysis — entities, timelines, claims, redactions. Everything runs on your machine.

<br>

![Local-first](https://img.shields.io/badge/runs%20locally-no%20cloud%20required-18181b?style=flat-square&labelColor=18181b&color=22c55e)
![License](https://img.shields.io/badge/license-BSL%201.1-18181b?style=flat-square&labelColor=18181b&color=6366f1)
![Next.js](https://img.shields.io/badge/Next.js%2016-Turbopack-18181b?style=flat-square&labelColor=18181b&color=3f3f46)
![SQLite](https://img.shields.io/badge/database-SQLite-18181b?style=flat-square&labelColor=18181b&color=3f3f46)

<br>

![AI providers](https://img.shields.io/badge/AI-Ollama-18181b?style=flat-square&labelColor=18181b&color=a1a1aa)
![AI providers](https://img.shields.io/badge/AI-Claude-18181b?style=flat-square&labelColor=18181b&color=a1a1aa)
![AI providers](https://img.shields.io/badge/AI-GPT-18181b?style=flat-square&labelColor=18181b&color=a1a1aa)
![AI providers](https://img.shields.io/badge/AI-Gemini-18181b?style=flat-square&labelColor=18181b&color=a1a1aa)
![AI providers](https://img.shields.io/badge/AI-Groq-18181b?style=flat-square&labelColor=18181b&color=a1a1aa)
![AI providers](https://img.shields.io/badge/AI-Mistral-18181b?style=flat-square&labelColor=18181b&color=a1a1aa)
![AI providers](https://img.shields.io/badge/AI-xAI-18181b?style=flat-square&labelColor=18181b&color=a1a1aa)
![AI providers](https://img.shields.io/badge/AI-Perplexity-18181b?style=flat-square&labelColor=18181b&color=a1a1aa)

[![Watch the demo](https://img.youtube.com/vi/GQbDxk5euKE/maxresdefault.jpg)](https://www.youtube.com/watch?v=GQbDxk5euKE)

</div>

---

## What it does

Operator is a private journalism workspace. Upload documents, images, and audio to get structured AI analysis — summaries, claims, entity extraction, timelines, and comparisons — with framing tuned for investigative reporting. Everything runs locally; no data leaves your machine unless you choose a cloud AI provider.

### Core

- **Stories** — organise work into scoped stories with documents, entities, timelines, and dispatch
- **Document analysis** — AI extracts summaries, claims, flags, and follow-up questions framed for journalism
- **Image & audio uploads** — photos get OCR + EXIF extraction; audio files are transcribed with speaker diarization
- **Library** — full document history with keyword and semantic search, auto-tagging, duplicate detection, and annotations
- **Dashboard** — cross-beat overview with health signals, document digest, and one-pager export
- **Dispatch** — AI chat with document context, memory, web search, and journalism-tuned personas
- **Pulse** — feed aggregator (RSS, Reddit, YouTube, Bluesky, Mastodon) with keyword monitoring
- **Journal** — private notes with folder organisation and AI grammar correction
- **Remote submissions** — shareable link for sources to submit files directly to your library
- **P2P collaboration** — LAN-based sync with threaded chat and conflict resolution

### Analysis tools

- **Entities** — extraction, timeline, interactive story map, and AI-assisted storyline builder
- **Entity Network** — force-directed graph of extracted entities with cluster highlighting
- **Claims Tracker** — log and verify factual claims from sources
- **Risk Register** — probability x impact scoring, owner assignment, auto-creation from uploads
- **Actions** — task tracking with assignee, due date, priority, and auto-extraction from documents

### Investigation tools

- **Image Analysis** — face extraction/comparison, Error Level Analysis, deepfake detection, reverse search
- **Photo Map** — geotagged photos on an interactive map with EXIF details
- **Speaker Diarization** — speaker-segmented transcripts with talk-time stats and speaker library
- **Web Monitor** — track web pages for changes with configurable intervals, CSS selector targeting, diff view, and AI change summaries
- **Research Tools** — Wayback Machine lookups, document diff, structured research workflows
- **FOIA Tracker** — public records requests with 7 status stages and overdue alerts
- **File Cleaner** — strip EXIF metadata before sharing

---

## Requirements

- **macOS or Linux** (Windows via WSL) — **Node.js 18+** — **Ollama** — **~5 GB disk** — **8 GB RAM** (16 GB recommended)
- All dependencies auto-installed by `start.sh`
- Cloud AI (Anthropic, OpenAI, Google, Groq, xAI, Perplexity, Mistral) optional — configure in Settings

---

## Installation

```bash
# Clone
git clone https://github.com/jcktp/operator.git && cd operator

# Run (installs everything on first run, starts in seconds after)
bash start.sh
```

Or download the ZIP from [Releases](https://github.com/jcktp/operator/releases), extract, and run `bash start.sh`.

---

## AI providers

**Local (default):** Ollama runs on-device. Default models: `phi4-mini` (text, ~2.5 GB) and `llava-phi3` (vision, ~2.9 GB). Optional audio models: `gemma4:e2b` or `phi4-multimodal`. Three setup modes available: Text + Vision, Full split, or All-in-one.

**Cloud:** Enter API keys in Settings. Keys are AES-256-GCM encrypted and never leave your machine except in direct API calls.

Supported: Anthropic, OpenAI, Google Gemini, Groq, xAI, Perplexity, Mistral.

---

## Security

- AES-256-GCM encrypted API keys; SHA-256 session hashing; HTTP-only cookies
- All 60+ API routes require authentication; shell commands use `execFile` with argument arrays
- File paths validated against root before serving; binds to localhost only
- No telemetry, no tracking, no external calls except to configured AI providers

---

## Tech stack

Next.js 16 (Turbopack) · SQLite + Prisma 7 · Ollama · Tailwind CSS v4 · OpenLayers · Cloudflare Quick Tunnel

---

## Development

```bash
npm test              # all tests (unit + integration)
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

API reference: [`docs/api.md`](./docs/api.md)

---

## License

**BSL 1.1** — non-commercial use is free. Commercial use requires a license. Converts to MIT on January 1, 2032. Full text: [`license.md`](./license.md)

AI outputs are probabilistic — verify all analysis before acting on it.

---

<div align="center">
Built by Jorick.
</div>
