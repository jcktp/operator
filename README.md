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

Operator is a private intelligence workspace. Upload documents and images to get structured AI analysis — summaries, metrics, risk flags, entity extraction, timelines, and period-over-period comparisons. Everything runs locally; no data leaves your machine unless you choose a cloud AI provider.

| Feature | Description |
|---|---|
| **Projects** | Organise work into named projects — all documents, analysis, and dispatch are scoped to the active project |
| **Document analysis** | AI extracts summaries, metrics, risks, opportunities, and follow-up questions from every upload — with mode-specific framing per domain |
| **Image uploads** | Upload photos and screenshots — AI describes the image, extracts text (OCR), and reads EXIF metadata (date, camera, GPS, focal length, exposure, aperture, ISO) automatically |
| **Background uploads** | Files are parsed immediately and queued for AI analysis so you can navigate away — no waiting |
| **Library** | Every document stored with full history; dedicated Photos tab for image uploads with thumbnail gallery and lightbox |
| **Dashboard** | Cross-area overview with AI-generated health signals across all documents |
| **Metrics board** | KPI board aggregating every metric extracted across all documents, grouped by area |
| **Dispatch** | AI chat with mode-specific personas; has full document context, supports web search, and remembers facts across conversations |
| **Inspector sidebar** | Click any entity or map pin to open a panel showing source documents and connected entities — without leaving the page |
| **Entities page** | Four-tab hub: entity management, timeline, interactive story map, and AI-assisted storyline builder (Journalism & Legal) |
| **Browser** | In-app web browser with reader and live modes, bookmark management, and one-click save to journal or dispatch |
| **Pulse** | Feed aggregator for RSS, Reddit, YouTube, Bluesky, and Mastodon — with keyword monitoring and auto-refresh |
| **Journal** | Private note-taking with folder organisation and AI grammar correction |
| **One-pager** | AI-generated executive brief across all documents; export to PDF |
| **Remote submissions** | Shareable link so others can submit files from any device; lands directly in your library |

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

</details>

---

## Requirements

| | |
|---|---|
| **macOS or Linux** | Windows supported via WSL |
| **Node.js 18+** | Auto-installed by `start.sh` if missing |
| **Ollama** | Auto-installed by `start.sh` if missing |
| **~5 GB free disk** | For `phi4-mini` (~2.5 GB) and `moondream` (~1.7 GB) |
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

| | Default |
|---|---|
| Text model | `phi4-mini` (~2.5 GB) |
| Vision model | `llava-phi3` (~1.7 GB) — pulled on first run for image uploads |
| Host | `http://localhost:11434` |

Switch to any Ollama model in **Settings → AI** — it downloads automatically.

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
| **Encryption at rest** | API keys encrypted with AES-256-GCM |
| **Session auth** | Password-protected; signed HTTP-only cookies invalidated on shutdown |
| **Local only** | Binds to `localhost`; nothing is reachable externally unless you enable the tunnel |
| **No telemetry** | No analytics, no tracking, no external calls except to AI providers you've configured |

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | SQLite via Prisma 7 + `better-sqlite3` |
| Local AI | Ollama (`phi4-mini` text, `moondream` vision) |
| Styling | Tailwind CSS v4 |
| Maps | OpenLayers + MapLibre GL |
| Timeline | TimelineJS3 |
| EXIF | exifr |
| Tunnel | Cloudflare Quick Tunnel |
| Auth | PBKDF2, HTTP-only session cookies |

---

## License

Released under **BSL 1.1**. Non-commercial use is free. Commercial use (deploying as or within a product or service offered to third parties) requires a commercial license. Converts to MIT on January 1, 2032.

Full text: [`license.md`](./license.md)

---

## Disclaimer

AI-generated outputs are probabilistic and must not be treated as professional legal, financial, medical, or journalistic advice. Verify all analysis before acting on it.

Excel file parsing uses the `xlsx` library, which has known CVEs with no upstream fix currently available. Only upload Excel files from sources you trust.

---

<div align="center">
Built by Jorick.
</div>
