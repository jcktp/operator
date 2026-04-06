<div align="center">

# Operator

**Local-first AI workspace for documents, investigations, and team intelligence**

Upload documents. Get structured AI analysis. Everything runs on your machine.

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

</div>

---

## What it does

Operator is a private intelligence workspace. Upload documents, images, and audio to get structured AI analysis — summaries, metrics, risk flags, entity extraction, timelines, and period-over-period comparisons. Everything runs locally; no data leaves your machine unless you choose a cloud AI provider.

| Feature | Description |
|---|---|
| **Projects** | Organise work into named projects — documents, entities, timelines, story maps, and dispatch are all scoped to the active project |
| **Document analysis** | AI extracts summaries, metrics, risks, opportunities, and follow-up questions from every upload — with mode-specific framing per domain |
| **Image uploads** | Upload photos and screenshots — AI describes the image, extracts text (OCR), and reads EXIF metadata (date, camera, GPS, focal length, exposure, aperture, ISO) automatically |
| **Audio uploads** | Upload MP3, WAV, M4A, and other audio files — transcribed automatically using a dedicated audio model; shows a warning if no audio-capable model is configured |
| **Background uploads** | Files are parsed immediately and queued for AI analysis so you can navigate away — no waiting |
| **Library** | Every document stored with full history; dedicated Photos tab for image uploads with thumbnail gallery and lightbox |
| **Dashboard** | Cross-area overview with AI-generated health signals across all documents |
| **Metrics board** | KPI board aggregating every metric extracted across all documents, grouped by area |
| **Dispatch** | AI chat with mode-specific personas; has full document context, remembers facts across conversations, and supports web search when enabled in Settings |
| **Inspector sidebar** | Click any entity or map pin to open a panel showing the report summary, source documents, and connected entities — without leaving the page |
| **Entities page** | Four-tab hub: entity management, timeline, interactive story map with zoom controls, and AI-assisted storyline builder (Journalism & Legal) — all filtered by active project |
| **Files** | Browse and manage files saved by Operator, organised by project and area. Analyse documents directly from the folder view without re-uploading |
| **Pulse** | Feed aggregator for RSS, Reddit, YouTube, Bluesky, and Mastodon — with keyword monitoring and auto-refresh |
| **Journal** | Private note-taking with folder organisation and AI grammar correction |
| **One-pager** | AI-generated executive brief across all documents; export to PDF |
| **Remote submissions** | Shareable link so others can submit files from any device; lands directly in your library |
| **Entity Network** | Force-directed graph of all extracted entities — pan, zoom, drag nodes, highlight connected clusters. Journalism mode only |
| **FOIA Tracker** | Track public records requests from draft through receipt with 7 status stages, overdue alerts, and per-request notes. Journalism mode only |
| **Claims Tracker** | Log factual claims from sources and mark them verified, disputed, false, or needs-more-info. Journalism mode only |
| **File Cleaner** | Strip EXIF metadata and identifying information from images and documents before sharing or publishing. Journalism mode only |
| **Risk Register** | Log risks with probability × impact scoring, owner assignment, and status tracking. Executive and Legal modes |
| **Decision Log** | Capture key decisions with context, rationale, and outcome — a searchable audit trail. Executive mode |
| **Blockers / Action Tracker** | Track sprint blockers (Team Lead) or HR follow-up actions with assignee, due date, priority, and overdue detection |
| **Policy Register** | Maintain HR policies with owner, category, review dates, and 30-day review alerts. Human Resources mode |
| **Deadline Tracker** | Track legal filing deadlines and HR milestones — urgency indicators, one-click mark complete. Legal and HR modes |
| **Quote Bank** | Capture verbatim quotes from interviews and surveys with source type, speaker, tags, and full-text search. Market Research mode |
| **Themes Board** | Synthesise patterns across research into candidate / confirmed / rejected themes. Market Research mode |
| **Capacity Planning** | AIHR-formula capacity calculator, demand gap → FTE analysis, recruiting cost estimator, and headcount registry. HR mode |

---

## App modes

Switch modes in **Settings** to adapt the interface, AI framing, and terminology to your domain.

| Mode | Use case |
|---|---|
| 📊 Executive | Business reporting & team oversight |
| 📰 Journalism | Field notes, sources & story research |
| 👥 Team Lead | Team updates, blockers & sprint tracking |
| 🔍 Market Research | Interviews, surveys & pattern discovery |
| ⚖️ Legal | Case files, evidence & matter management |
| 🫂 Human Resources | People operations, talent & workforce analytics |

<details>
<summary>Mode-specific feature flags</summary>

| Feature | Exec | Journalism | Team Lead | Market Research | Legal | HR |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Document comparison | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Metrics board | ✓ | | | | | ✓ |
| Entity extraction | | ✓ | | ✓ | ✓ | |
| Timeline | | ✓ | ✓ | | ✓ | |
| Redaction detection | | ✓ | | | ✓ | |
| Verification checklist | | ✓ | | ✓ | ✓ | |
| Keyword monitoring | | ✓ | | | | |
| Investigation template | | ✓ | | | ✓ | |
| Risk Register | ✓ | | | | ✓ | |
| Decision Log | ✓ | | | | | |
| Blockers / Action Tracker | | | ✓ | | | ✓ |
| Policy Register | | | | | | ✓ |
| Deadline Tracker | | | | | ✓ | ✓ |
| Quote Bank | | | | ✓ | | |
| Themes Board | | | | ✓ | | |
| Capacity Planning | | | | | | ✓ |

</details>

---

## Requirements

| | |
|---|---|
| **macOS or Linux** | Windows supported via WSL |
| **Node.js 18+** | Auto-installed by `start.sh` if missing |
| **Ollama** | Auto-installed by `start.sh` if missing |
| **~5 GB free disk** | For `phi4-mini` (~2.5 GB) and `llava-phi3` (~2.9 GB) |
| **8 GB RAM** | 16 GB recommended for local inference |

Cloud AI (Anthropic, OpenAI, Google Gemini, Groq, xAI, Perplexity, Mistral) is optional — use any provider instead of or alongside Ollama.

---

## Installation

**Option A — Download ZIP** *(no git required)*

1. Click **Code → Download ZIP**, extract it
2. Move it somewhere permanent (not Downloads)

**Option B — Clone**

```bash
git clone https://github.com/jcktp/operator.git
cd operator
```

### Run

```bash
bash start.sh
```

On first run this installs Homebrew (macOS), Node.js, Ollama, and Tesseract if missing, sets up the database, pulls the default AI models, and opens the app at `http://localhost:3000`. Subsequent runs skip all setup and start in seconds.

> **`start-dev.sh`** runs a hot-reload development server and is intended for contributors only.

---

## First-time setup

On first launch, an onboarding wizard walks you through:

1. **Appearance** — Light, Dark, or Auto
2. **Mode** — pick your use case
3. **Profile** — name, company, and role so the AI tailors its responses

All settings can be changed later in **Settings**.

---

## AI providers

### Local (default)

Ollama runs entirely on your machine. Nothing is sent anywhere.

Three model setup modes are available in **Settings → AI**:

| Mode | Models | Best for |
|---|---|---|
| **Text + Vision** *(default)* | Small text model + dedicated vision model | Most users — low RAM, fast text |
| **Full split** | Separate text, vision, and audio models | Handles all file types with minimal RAM per task |
| **All-in-one** | Single model for text, vision, and audio | Simpler setup; requires more RAM |

**Default models**

| Role | Model | Size |
|---|---|---|
| Text | `phi4-mini` | ~2.5 GB |
| Vision | `llava-phi3` | ~2.9 GB — loaded on demand for image uploads |
| Audio | configured separately in Full split mode | — |

**Audio-capable models** (Full split mode)

| Model | Size | Notes |
|---|---|---|
| `whisper:small` | 0.6 GB | Transcription only — lightest option |
| `whisper:medium` | 1.5 GB | Better accuracy, still lightweight |
| `gemma4:e2b` | 7.2 GB | Full multimodal — text, vision, and audio |
| `phi4-multimodal` | ~8.5 GB | Full multimodal — generally faster than gemma4 |

The model list in Settings refreshes live from [ollama.com/search](https://ollama.com/search) and falls back to a curated list when offline.

### Cloud

Enter API keys in **Settings → AI**. Keys are encrypted with AES-256-GCM and never leave your machine except in direct API calls to the provider you've selected.

| Provider | Key format |
|---|---|
| Anthropic (Claude) | `sk-ant-...` |
| OpenAI (GPT) | `sk-...` |
| Google (Gemini) | `AIza...` |
| Groq | `gsk_...` |
| xAI (Grok) | `xai-...` |
| Perplexity | `pplx-...` |
| Mistral | `...` |

---

## Remote submissions

Enable in **Settings → Remote** to get a public URL others can use to submit files directly to your library — no app required. The tunnel is temporary and closes when Operator shuts down.

---

## Security

| | |
|---|---|
| **Encryption at rest** | API keys encrypted with AES-256-GCM; key file set to `0600` permissions |
| **Session auth** | Password-protected; session tokens stored as SHA-256 hashes; HTTP-only cookies expire on browser close |
| **All routes protected** | Every API endpoint requires a valid session — no unauthenticated access |
| **Injection prevention** | Shell commands use `execFile` with argument arrays; no raw string interpolation |
| **Path traversal guard** | File download routes validate paths against the reports root before serving |
| **Local only** | Binds to `localhost`; nothing is reachable externally unless you enable the tunnel |
| **No telemetry** | No analytics, no tracking, no external calls except to AI providers you've configured |

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | SQLite via Prisma 7 + `better-sqlite3` |
| Local AI | Ollama (`phi4-mini` text, `llava-phi3` vision) |
| Styling | Tailwind CSS v4 |
| Maps | OpenLayers + MapLibre GL |
| EXIF | exifr |
| Tunnel | Cloudflare Quick Tunnel |
| Auth | SHA-256 session tokens, HTTP-only cookies, AES-256-GCM key storage |

---

## Development

### Running tests

```bash
npm test                  # all tests
npm run test:unit         # unit tests only (fast, no DB)
npm run test:integration  # integration tests (uses a real test SQLite DB)
npm run test:watch        # watch mode for active development
npm run test:coverage     # generate coverage report
npm run test:smoke        # smoke test — requires the dev server to be running
```

The test suite covers:
- **Unit tests** — pure functions in `lib/` (parsers, utilities, auth crypto, model capabilities, capacity planning formulas)
- **Integration tests** — database-backed functions using an isolated test database

### API reference

See [`docs/api.md`](./docs/api.md) for a full reference of all API routes with request/response shapes.

---

## License

Released under **BSL 1.1**. Non-commercial use is free. Commercial use (deploying as or within a product or service offered to third parties) requires a commercial license. Converts to MIT on January 1, 2032.

Full text: [`license.md`](./license.md)

---

## Disclaimer

AI-generated outputs are probabilistic and must not be treated as professional legal, financial, medical, or journalistic advice. Verify all analysis before acting on it.

Excel file parsing uses the `exceljs` library. Only upload Excel files from sources you trust.

---

<div align="center">
Built by Jorick.
</div>
