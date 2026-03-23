# Operator

> Local-first executive reporting — AI analysis of your direct reports' submissions, running entirely on your machine.

![Local-first](https://img.shields.io/badge/runs%20locally-no%20cloud%20required-black?style=flat-square)
![Ollama](https://img.shields.io/badge/AI-Ollama%20%7C%20Claude%20%7C%20GPT-black?style=flat-square)
![SQLite](https://img.shields.io/badge/database-SQLite-black?style=flat-square)
![Next.js](https://img.shields.io/badge/framework-Next.js%2016-black?style=flat-square)

---

## What it does

Upload reports from your direct reports — CSV, Excel, PDF, Word, or plain text — and get structured AI analysis: summaries, key metrics, risk flags, follow-up questions, and period-over-period comparisons.

| Feature | Description |
|---|---|
| **Report analysis** | AI extracts summary, metrics, risks, opportunities, and follow-up questions from each document |
| **Library** | Every report stored with full history; compare two periods side by side |
| **Dashboard** | Cross-area overview with AI-generated health signals across all reports |
| **Dispatch** | AI chat assistant with access to all your report context; remembers facts across conversations |
| **Journal** | Private note-taking space with folder organisation and AI grammar correction |
| **Remote submissions** | Shareable link so direct reports can submit files from any device, no app required |
| **Works offline** | Local LLM via Ollama — no data leaves your machine unless you choose a cloud provider |

---

## Requirements

| Requirement | Notes |
|---|---|
| **macOS, Linux, or Windows (WSL)** | Native Windows supported with some manual steps |
| **Node.js 18+** | Installed automatically by `start.sh` if missing (macOS/Linux) |
| **Ollama** | Installed automatically by `start.sh` if missing; required for local AI |
| **~4 GB free disk space** | For the default model (`llama3.2:3b`) |
| **8 GB RAM minimum** | 16 GB recommended for comfortable local inference |

Cloud AI providers (Anthropic, OpenAI, Google Gemini, Groq, xAI, Perplexity) are optional — use any of them instead of or alongside Ollama.

---

## Installation

### Step 1 — Download

**Option A: Download ZIP (no git required)**

1. Go to the repository page on GitHub
2. Click the green **Code** button → **Download ZIP**
3. Once downloaded, find the ZIP file in your **Downloads** folder and double-click it to extract

**Option B: Clone with git**

```bash
git clone https://github.com/jcktp/operator.git
```

---

### Step 2 — Move the folder

Move the `operator` folder somewhere permanent on your machine — not in Downloads where it might get cleaned up.

A good home is your user folder or a dedicated projects directory:

```
~/operator                    # directly in your home folder
~/Projects/operator           # inside a Projects folder
~/Documents/operator          # inside Documents
```

**On macOS:** Open Finder, drag the `operator` folder from Downloads to your preferred location.

**From the terminal:**

```bash
# Move to your home folder
mv ~/Downloads/operator ~/operator

# Or move to a Projects folder (creates it if it doesn't exist)
mkdir -p ~/Projects
mv ~/Downloads/operator ~/Projects/operator
```

---

### Step 3 — Open a terminal and navigate to the folder

Open **Terminal** (macOS: `Cmd + Space` → type Terminal → Enter).

Then navigate to wherever you placed the folder:

```bash
# If you moved it to your home folder
cd ~/operator

# If you moved it to Projects
cd ~/Projects/operator

# If you're not sure where it is, find it
find ~ -name "operator" -type d 2>/dev/null
```

Confirm you're in the right place:

```bash
ls
```

You should see files like `start.sh`, `package.json`, `README.md`, and folders like `app/`, `components/`, `prisma/`.

---

### Step 4 — Run

```bash
bash start.sh
```

That's it. The script handles everything automatically:

1. Installs Homebrew if missing (macOS only)
2. Installs Node.js if missing
3. Installs Ollama if missing
4. Installs cloudflared if missing (optional — needed for remote submissions)
5. Creates `.env.local` on first run
6. Installs npm dependencies
7. Sets up and migrates the SQLite database
8. Starts the Ollama server
9. Pulls the default AI model (`llama3.2:3b`) — **this takes a few minutes the very first time**
10. Starts the app on port 3000 and opens it in your browser

```
Operator — starting up (macOS)

▶ Homebrew found
▶ Node v22.0.0
▶ Ollama found
▶ cloudflared found
▶ .env.local already exists
▶ Dependencies already installed
▶ Generating Prisma client...
▶ Setting up database...
▶ Database ready
▶ Starting Operator server...
▶ Waiting for server to be ready...
▶ Opening Operator in your browser...
▶ Starting AI engine...
▶ Model: llama3.2:3b
▶ Model already available
▶ Ready!

Operator is running at http://localhost:3000
Press Ctrl+C to stop, or use the power button in the app.
```

To stop the app, press **Ctrl+C** in the terminal window, or click the power button inside the app.

> **Every subsequent run:** Just open a terminal, `cd` to the operator folder, and run `bash start.sh` again. All setup steps are skipped — it starts in a few seconds.

---

## First-time setup inside the app

Once Operator is running, go to **Settings** to personalise it:

1. **Profile** — enter your name, company, and role. The AI will address you by name and tailor its responses to your context.
2. **App mode** — choose between Executive, Team Lead, and other modes to adjust the navigation and AI framing.
3. **AI provider** — defaults to Ollama (local). To use a cloud model, enter an API key for any supported provider and select it.

---

## AI providers

### Local (default)

Ollama runs entirely on your machine. No data is sent anywhere.

| Setting | Default |
|---|---|
| Model | `llama3.2:3b` |
| Host | `http://localhost:11434` |

You can switch to a different Ollama model (e.g. `mistral`, `llama3.1:8b`, `gemma3:4b`) in **Settings → AI**. The model downloads automatically.

### Cloud providers

Enter API keys in **Settings → AI**. Keys are stored encrypted in the local SQLite database — they never leave your machine except when making a direct API call to the provider you've selected.

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

Direct reports can submit files to you from any device — no app required. Enable this in **Settings → Remote**:

1. Click **Enable remote access** — starts a Cloudflare Quick Tunnel
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
│   ├── dispatch/          # AI chat (Dispatch, Debrief, Recon)
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
- **Session auth** — the app is protected by a password on first run; sessions use signed HTTP-only cookies and are invalidated on shutdown
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

---

Built with purpose by Jorick.
