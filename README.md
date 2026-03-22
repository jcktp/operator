# Operator

Operator is a local-first executive reporting tool. Upload reports from your direct reports — CSV, Excel, PDF, Word, or plain text — and get structured AI analysis: summaries, key metrics, risk flags, follow-up questions, and period-over-period comparisons. Everything runs on your machine, or you can connect a cloud AI provider for higher quality output.

Built for executives and team leads who want a single place to read, review, and interrogate reports without everything going through a third-party cloud service.

---

## What it does

- **Structured report analysis** — AI extracts a summary, key metrics, risks, opportunities, and suggested follow-up questions from each uploaded document
- **Library** — every report stored with full history; compare two periods side by side with diff highlighting
- **Dashboard** — cross-area overview with AI-generated insights and health signals across all reports
- **Dispatch** — AI chat assistant (Dispatch, Debrief, Recon) with access to all your report context; remembers facts across conversations
- **Journal** — private note-taking space with folder organisation and AI grammar correction
- **Remote submissions** — generate a shareable link so direct reports can submit files without needing the app installed (via Cloudflare Quick Tunnel)
- **Multi-file upload** — process multiple documents in a single run
- **Works offline** — local LLM via Ollama; no data leaves your machine unless you choose a cloud provider

---

## Requirements

| Requirement | Notes |
|---|---|
| **macOS, Linux, or Windows (WSL)** | Native Windows supported with some manual steps |
| **Node.js 18+** | Installed automatically by `start.sh` if missing (macOS/Linux) |
| **Ollama** | Installed automatically by `start.sh` if missing; required for local AI |
| **~4 GB free disk space** | For the default LLM model (`llama3.2:3b`) |
| **8 GB RAM minimum** | 16 GB recommended for comfortable local inference |

Cloud AI providers (Anthropic, OpenAI, Google Gemini, Groq, xAI Grok, Perplexity) are all optional — you can use any of them instead of or alongside Ollama.

---

## Quick start

### 1. Get the code

```bash
git clone https://github.com/jcktp/operator.git
cd operator
```

Or download the ZIP from GitHub and extract it.

### 2. Run the start script

```bash
bash start.sh
```

That's it. The script handles everything from scratch:

1. Checks for Node.js — installs it if missing (via Homebrew on macOS, NodeSource on Linux)
2. Checks for Ollama — installs it if missing
3. Checks for cloudflared — installs it if missing (optional; needed for remote submissions)
4. Creates `.env.local` on first run
5. Installs npm dependencies (`npm install`)
6. Sets up and migrates the SQLite database (`prisma migrate deploy`)
7. Starts the Ollama server in the background
8. Pulls the default AI model (`llama3.2:3b`) if not already downloaded — **this can take a few minutes the very first time**
9. Starts the Next.js dev server on port 3000
10. Opens `http://localhost:3000` in your browser

```
▶ Checking Node.js...
▶ Node v20.11.0
▶ Checking Ollama...
▶ Ollama found
▶ Checking cloudflared (optional)...
▶ cloudflared found
▶ Creating .env.local (first run)...
▶ Installing dependencies (first run)...
▶ Setting up database...
▶ Database ready
▶ Starting Ollama server...
▶ Model: llama3.2:3b
▶ Pulling llama3.2:3b — this may take a few minutes on first run...
▶ Model llama3.2:3b ready
▶ Starting Operator server...
▶ Waiting for server to be ready...
▶ Opening Operator in your browser...

Operator is running at http://localhost:3000
Press Ctrl+C to stop, or use the power button in the app.
```

To stop the app, press **Ctrl+C** in the terminal, or click the power button inside the app.

---

## First-time setup inside the app

Once Operator is running, go to **Settings** to personalise it:

1. **Profile** — enter your name and role (e.g. "CEO"). The AI will address you by name and tailor its responses to your role.
2. **Company name** — used in report context.
3. **AI provider** — defaults to Ollama (local). To use a cloud model, enter an API key for any provider (Anthropic, OpenAI, Google, Groq, xAI, or Perplexity) and select it as the active provider.

---

## AI providers

### Local (default)

Ollama runs entirely on your machine. No data is sent anywhere.

| Setting | Default |
|---|---|
| Model | `llama3.2:3b` |
| Host | `http://localhost:11434` |

You can switch to a different Ollama model (e.g. `mistral`, `llama3.1:8b`, `gemma3:4b`) in Settings. The model will be downloaded automatically.

### Cloud providers

Enter API keys in the **Settings → AI Provider** section. Keys are stored encrypted in the local SQLite database — they never leave your machine except when making a direct API call to the provider.

| Provider | Key format | Where to get it |
|---|---|---|
| Anthropic (Claude) | `sk-ant-...` | console.anthropic.com |
| OpenAI (GPT) | `sk-...` | platform.openai.com |
| Google (Gemini) | `AIza...` | aistudio.google.com |
| Groq | `gsk_...` | console.groq.com |
| xAI (Grok) | `xai-...` | console.x.ai |
| Perplexity | `pplx-...` | perplexity.ai/settings/api |

---

## Remote report submissions

Direct reports can submit files to you without having the app installed. Enable this in **Settings → Remote Submissions**:

1. Click **Enable remote access** — this starts a Cloudflare Quick Tunnel (requires `cloudflared` to be installed; `start.sh` installs it automatically)
2. Copy the generated public URL (e.g. `https://random-name.trycloudflare.com`)
3. Share it with your direct reports — they open it in any browser and upload their file
4. The report lands directly in your Operator Library

The tunnel is temporary (new URL each session) and shuts down when you close Operator.

---

## Directory structure

```
operator/
├── app/                   # Next.js App Router pages and API routes
│   ├── api/               # Backend API routes (AI, reports, settings, etc.)
│   ├── dashboard/         # Cross-area dashboard
│   ├── dispatch/          # AI chat (Dispatch/Debrief/Recon)
│   ├── journal/           # Private notes
│   ├── library/           # Report browser
│   ├── reports/           # Individual report view
│   ├── settings/          # App configuration
│   └── upload/            # File upload and report generation
├── components/            # Shared React components
├── lib/                   # Core logic (AI, settings, encryption, personas, tunnel)
├── prisma/                # Database schema and migrations
│   └── dev.db             # SQLite database (created on first run, gitignored)
├── public/                # Static assets
├── start.sh               # One-command startup script
└── .env.local             # Environment variables (created on first run, gitignored)
```

---

## Security

- **Encryption at rest** — all API keys are encrypted with AES-256-GCM before being stored in the database
- **Session auth** — the app is protected by a password on first run; sessions use signed HTTP-only cookies
- **Local only by default** — the app binds to `localhost`; nothing is reachable from outside your machine unless you explicitly enable the tunnel
- **No telemetry** — no analytics, no tracking, no external calls except to AI provider APIs you've configured

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | SQLite via Prisma 7 + `better-sqlite3` adapter |
| Local AI | Ollama |
| Styling | Tailwind CSS |
| Rich text | Tiptap |
| Tunnel | Cloudflare Quick Tunnel (`cloudflared`) |
| Auth | PBKDF2 password hashing, HTTP-only session cookies |
