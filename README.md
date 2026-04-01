<div align="center">

# Operator

**Local-first AI workspace for documents, investigations, and team intelligence**

Upload documents. Get structured AI analysis. Everything runs on your machine.

<br>

![Local-first](https://img.shields.io/badge/runs%20locally-no%20cloud%20required-18181b?style=flat-square&labelColor=18181b&color=22c55e)
![License](https://img.shields.io/badge/license-BSL%201.1-18181b?style=flat-square&labelColor=18181b&color=6366f1)
![Next.js](https://img.shields.io/badge/Next.js%2016-Turbopack-18181b?style=flat-square&labelColor=18181b&color=3f3f46)
![SQLite](https://img.shields.io/badge/database-SQLite-18181b?style=flat-square&labelColor=18181b&color=3f3f46)
![Tailwind](https://img.shields.io/badge/styling-Tailwind%20v4-18181b?style=flat-square&labelColor=18181b&color=3f3f46)

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

Operator is a private intelligence workspace. Upload documents and images to get structured AI analysis — summaries, key metrics, risk flags, entity extraction, timelines, and period-over-period comparisons. Everything runs locally; no data leaves your machine unless you choose a cloud AI provider.

| Feature | Description |
|---|---|
| **Document analysis** | AI extracts summaries, metrics, risks, opportunities, and follow-up questions from every upload — with mode-specific framing per domain |
| **Image uploads** | Upload photos and screenshots — AI describes the image, extracts text (OCR), and reads EXIF metadata (date, camera, GPS, focal length, exposure, aperture, ISO) automatically |
| **Background uploads** | Files are parsed immediately and queued for AI analysis so you can navigate away — no waiting |
| **Re-analysis** | Re-run AI analysis on any document without re-uploading — useful after switching models or AI providers |
| **Library** | Every document stored with full history; dedicated Photos tab for image uploads with thumbnail gallery and full-screen lightbox |
| **Dashboard** | Cross-area overview with AI-generated health signals across all documents |
| **Metrics board** | KPI board aggregating every metric extracted across all documents, grouped by area with source attribution |
| **Dispatch** | AI chat with 3 mode-specific personas; has access to all your document context, supports web search, and remembers facts across conversations |
| **Inspector sidebar** | Click any entity or map pin to open a panel showing its source documents, connected entities, and analyst notes — without leaving the page |
| **Entities page** | Four-tab hub for entity management, timeline, interactive story map, and AI-assisted storyline builder (Journalism & Legal modes) |
| **Browser** | In-app web browser with reader and live modes, bookmark management, and one-click save to journal or dispatch |
| **Pulse** | Feed aggregator for RSS, Reddit, YouTube, Bluesky, and Mastodon — with keyword monitoring and auto-refresh |
| **Journal** | Private note-taking with folder organisation and AI grammar correction |
| **One-pager** | AI-generated executive brief across all documents; export to PDF |
| **Remote submissions** | Shareable link so others can submit files from any device; lands directly in your library |
| **Works offline** | Local LLM via Ollama — no data leaves your machine unless you choose a cloud provider |

---

## App modes

Switch modes in **Settings** to adapt the interface, AI framing, and terminology to your use case. Each mode renames navigation labels, document types, and areas to match the domain, and gives every AI persona purpose-built instructions.

| Mode | Use case | Dispatch personas |
|---|---|---|
| ![Executive](https://img.shields.io/badge/Executive-📊-18181b?style=flat-square&labelColor=18181b&color=6366f1) | Business reporting & team oversight | Dispatch · Debrief · Recon |
| ![Journalism](https://img.shields.io/badge/Journalism-📰-18181b?style=flat-square&labelColor=18181b&color=f59e0b) | Field notes, sources & story research | Analyst · Editor · Scout |
| ![Team Lead](https://img.shields.io/badge/Team%20Lead-👥-18181b?style=flat-square&labelColor=18181b&color=22c55e) | Team updates, blockers & sprint tracking | Tracker · Retro · Spark |
| ![Market Research](https://img.shields.io/badge/Market%20Research-🔍-18181b?style=flat-square&labelColor=18181b&color=0ea5e9) | Interviews, surveys & pattern discovery | Signal · Probe · Horizon |
| ![Legal](https://img.shields.io/badge/Legal-⚖️-18181b?style=flat-square&labelColor=18181b&color=a78bfa) | Case files, evidence & matter management | Clerk · Counsel · Brief |
| ![HR](https://img.shields.io/badge/Human%20Resources-🫂-18181b?style=flat-square&labelColor=18181b&color=f472b6) | People operations, talent & workforce analytics | Compass · Advocate · Spark |

### Mode-specific features

Features are enabled per mode based on what makes sense for that domain.

| Feature | Exec | Journalism | Team Lead | Market Research | Legal | HR |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Document comparison | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Metrics board | ✓ | | | | | ✓ |
| Entity extraction | | ✓ | | ✓ | ✓ | |
| Entity graph | | ✓ | | ✓ | ✓ | |
| Entities page (tabs) | | ✓ | | | ✓ | |
| Timeline | | ✓ | ✓ | | ✓ | |
| Redaction detection | | ✓ | | | ✓ | |
| Verification checklist | | ✓ | | ✓ | ✓ | |
| Keyword monitoring | | ✓ | | | | |
| Investigation template | | ✓ | | | ✓ | |

**Entities page** (Journalism & Legal) includes four tabs:
- **Entities** — named persons, organisations, locations, dates, and financial figures with cross-document linking
- **Timeline** — interactive chronological timeline (TimelineJS) built from all documents in the mode
- **Story Map** — geocoded interactive map of all location entities extracted across documents; click a pin to see what happened there
- **Storyline** — AI-assisted narrative arc builder: select source documents, generate a story brief with timeline events and verifiable claims, track claim readiness to publication

---

## Requirements

| | |
|---|---|
| **macOS, Linux, or Windows (WSL)** | Native Windows supported with some manual steps |
| **Node.js 18+** | Installed automatically by `start.sh` if missing (macOS/Linux) |
| **Ollama** | Installed automatically by `start.sh` if missing; required for local AI |
| **~5 GB free disk space** | For the default text model (`phi4-mini`, ~2.5 GB) and vision model (`moondream`, ~1.7 GB) |
| **8 GB RAM minimum** | 16 GB recommended for comfortable local inference |

Ollama swaps models in and out on demand — the text and vision models never run simultaneously, so peak RAM usage is the larger of the two (~2.5 GB for phi4-mini).

Cloud AI providers (Anthropic, OpenAI, Google Gemini, Groq, xAI, Perplexity, Mistral) are optional — use any of them instead of or alongside Ollama.

---

## Installation

### Step 1 — Download

**Option A: Download ZIP** *(no git required)*

1. Click the green **Code** button → **Download ZIP**
2. Find the ZIP in **Downloads** and double-click to extract

**Option B: Clone with git**

```bash
git clone https://github.com/jcktp/operator.git
```

### Step 2 — Move the folder somewhere permanent

```bash
mkdir -p ~/Projects && mv ~/Downloads/operator ~/Projects/operator
```

Not in Downloads — it may get cleaned up.

### Step 3 — Run

```bash
cd ~/Projects/operator
bash start-dev.sh
```

The script handles everything on first run:

1. Installs Homebrew if missing (macOS only)
2. Installs Node.js if missing
3. Installs Ollama if missing
4. Installs cloudflared if missing (needed for remote submissions)
5. Creates `.env.local` on first run
6. Installs npm dependencies
7. Sets up and migrates the SQLite database
8. Starts the Ollama server
9. Pulls the default text model (`phi4-mini`) — **takes a few minutes the first time**
10. Pulls the vision model (`moondream`) for image analysis — **also takes a few minutes the first time**
11. Starts the app on `http://localhost:3000` and opens it in your browser

```
Operator — starting up

▶ Node v22.0.0
▶ Ollama found
▶ Dependencies already installed
▶ Database ready
▶ Model: phi4-mini — already available
▶ Vision model (moondream) already available
▶ Ready!

Operator is running at http://localhost:3000
Press Ctrl+C to stop.
```

> **Every subsequent run:** Just `cd` to the folder and run `bash start-dev.sh`. All setup steps are skipped — starts in a few seconds.

Two scripts are available:

| Script | Mode | Best for |
|---|---|---|
| `bash start-dev.sh` | Development — no rebuild needed | Day-to-day personal use |
| `bash start.sh` | Production — full build first | Sharing with others, maximum stability |

---

## First-time setup

On first launch, Operator runs an onboarding wizard:

1. **Appearance** — choose Light, Dark, or Auto (follows system preference)
2. **Mode** — pick the mode that matches your use case
3. **Profile** — enter your name, company, and role so the AI can tailor its responses

You can change all of these later in **Settings**.

---

## AI providers

### Local (default)

Ollama runs entirely on your machine. No data is sent anywhere.

| | Default |
|---|---|
| Text model | `phi4-mini` (~2.5 GB) |
| Vision model | `moondream` (~1.7 GB) — auto-pulled; used for image uploads |
| Host | `http://localhost:11434` |

Switch to any other Ollama model (e.g. `llama3.1:8b`, `gemma3:4b`, `mistral`) in **Settings → AI**. The model downloads automatically and the previous model is removed to save space.

When switching from Ollama to a cloud provider, Settings will offer to remove the local models to free up disk space — this is optional, and Ollama itself stays installed.

### Cloud providers

Enter API keys in **Settings → AI**. Keys are encrypted with AES-256-GCM in the local database — they never leave your machine except in direct API calls to the provider you've selected.

| Provider | Key format | |
|---|---|---|
| Anthropic (Claude) | `sk-ant-...` | console.anthropic.com |
| OpenAI (GPT) | `sk-...` | platform.openai.com |
| Google (Gemini) | `AIza...` | aistudio.google.com |
| Groq | `gsk_...` | console.groq.com |
| xAI (Grok) | `xai-...` | console.x.ai |
| Perplexity | `pplx-...` | perplexity.ai/settings/api |
| Mistral | `...` | console.mistral.ai/api-keys |

---

## Remote submissions

Others can submit files to you from any device — no app required. Enable in **Settings → Remote**:

1. Click **Enable remote access** — starts a Cloudflare Quick Tunnel
2. Copy the generated public URL and share it
3. Recipients upload in any browser; the file lands in your library

The tunnel is temporary (new URL each session) and closes when Operator shuts down.

---

## Security

| | |
|---|---|
| **Encryption at rest** | All API keys encrypted with AES-256-GCM before storage |
| **Session auth** | Password-protected on first run; signed HTTP-only cookies, invalidated on shutdown |
| **Local only by default** | Binds to `localhost`; nothing is reachable externally unless you enable the tunnel |
| **No telemetry** | No analytics, no tracking, no external calls except to AI providers you've configured |

---

## Directory structure

<details>
<summary>Show structure</summary>

```
operator/
├── app/                   # Next.js App Router pages and API routes
│   ├── api/               # Backend API routes (AI, documents, settings, etc.)
│   ├── browser/           # In-app web browser (reader + live modes, bookmarks)
│   ├── directs/           # Contact management (direct reports, sources, team members)
│   ├── dispatch/          # AI chat panel (full-page and floating widget)
│   ├── entities/          # Investigation Hub (entities, timeline, story map, storyline)
│   │   ├── tabs/          # Hub tab components (TimelineJS, OpenLayers map, Storyline)
│   │   └── storyline/     # Storyline editor, claims tracker, report picker
│   ├── journal/           # Private notes
│   ├── library/           # Document browser (including Photos tab for image uploads)
│   ├── metrics/           # KPI board
│   ├── one-pager/         # AI executive brief with PDF export
│   ├── pulse/             # Feed aggregator
│   ├── reports/           # Individual document view with re-analysis
│   ├── settings/          # App configuration
│   ├── timeline/          # Standalone chronological event view
│   └── upload/            # File upload
├── components/            # Shared React components
│   ├── InspectorContext.tsx  # Inspector sidebar global state
│   ├── InspectorSidebar.tsx  # Entity/location inspector panel
│   └── FloatingDispatch.tsx  # Floating dispatch chat widget
├── lib/                   # Core logic
│   ├── ai/                # Analysis functions (analyze, catch-up, knowledge injection)
│   ├── ai-providers.ts    # Provider implementations (Ollama, Anthropic, OpenAI, etc.)
│   ├── image-metadata.ts  # EXIF metadata extraction from image uploads
│   ├── upload-queue.ts    # Background upload job worker
│   ├── personas/          # Per-mode AI persona definitions (one file per mode)
│   ├── map/               # OpenLayers story map initialisation
│   └── mode.ts            # App mode configurations and feature flags
├── prisma/                # Database schema and migrations
│   └── dev.db             # SQLite database (created on first run, gitignored)
├── public/
│   └── timelinejs/        # TimelineJS3 static assets (copied by postinstall)
├── start.sh               # Production startup script
├── start-dev.sh           # Development startup script
└── .env.local             # Environment variables (created on first run, gitignored)
```

</details>

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | SQLite via Prisma 7 + `better-sqlite3` adapter |
| Local AI | Ollama (`phi4-mini` text, `moondream` vision) |
| Styling | Tailwind CSS v4 |
| Rich text | Tiptap |
| Maps | OpenLayers |
| Timeline | TimelineJS3 |
| EXIF extraction | exifr |
| Tunnel | Cloudflare Quick Tunnel (`cloudflared`) |
| Auth | PBKDF2 password hashing, HTTP-only session cookies |

---

## License

Operator is released under the **Business Source License 1.1** (BSL 1.1). The licensor is Jorick Thijs Polderman.

- **Non-commercial use is permitted** — personal projects, academic research, journalism, and internal business tooling are allowed at no cost.
- **Commercial use** — deploying Operator as or within a product or service offered to third parties requires a commercial license. Contact the licensor for terms.
- **Change date** — on January 1, 2032, the license automatically converts to MIT.

Full license text: [`license.md`](./license.md)

---

## Disclaimer

Operator is provided as-is, without warranty of any kind. AI-generated outputs are probabilistic and must not be treated as professional legal, financial, medical, journalistic, or other expert advice. All analysis should be independently verified before acting on it. The author(s) accept no responsibility for decisions made based on content produced by this software.

---

<div align="center">

Built with purpose by Jorick.

</div>
