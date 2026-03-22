# Operator

Operator is a local-first data analysis tool. Upload CSV, Excel, PDF, or Word files and generate structured reports using a local LLM (via Ollama) or a cloud AI provider of your choice.

## Features

- **Local AI** — runs entirely on your machine with [Ollama](https://ollama.com); no data leaves your device
- **Cloud AI** — optionally connect Anthropic, OpenAI, Google, or Groq for higher-quality output
- **Reports** — structured analysis with history, diffs, and follow-up questions
- **Library** — browse all past reports in one place
- **Multi-file upload** — process multiple documents in one run

## Requirements

- [Node.js](https://nodejs.org) 18+
- [Ollama](https://ollama.com) (installed automatically on first run if missing)

## Quick start

```bash
./start.sh
```

The startup script will:
1. Install Node.js and Ollama if they are not already present
2. Install npm dependencies
3. Set up the local SQLite database
4. Pull the default LLM model if not already downloaded
5. Open the app in your browser at `http://localhost:3000`

## Configuration

API keys for cloud providers can be entered in the **Settings** page inside the app. They are stored locally in the SQLite database and never sent anywhere other than the provider's own API.

Environment variables (`.env.local`) are created automatically on first run. You can also set keys there as an alternative to the Settings UI:

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
GROQ_API_KEY=gsk_...
```

## Tech stack

- [Next.js](https://nextjs.org) (App Router)
- [Prisma](https://www.prisma.io) + SQLite
- [Ollama](https://ollama.com) for local inference
- [Tailwind CSS](https://tailwindcss.com)
