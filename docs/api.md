# Operator API Reference

All routes are served by Next.js App Router under `/api/`. The app binds to `localhost:3000` by default.

## Authentication

Most routes require a valid session. Authentication is enforced via the `requireAuth` helper (`lib/api-auth.ts`), which reads the `op_session` HTTP-only cookie. Routes that do **not** require auth are marked **Public**.

A valid session cookie is obtained through `/api/auth/login` or `/api/auth/setup`. Session tokens are stored in the database as SHA-256 hashes; only the raw token is set in the cookie.

**Unauthenticated response** (all protected routes):
```json
{ "error": "Unauthorized" }   // HTTP 401
```

---

## Auth

### `GET /api/auth/status` — **Public**

Returns the current setup and lockout state. Safe to call before auth is configured.

**Response**
```json
{
  "setupComplete": true,
  "failedAttempts": 0,
  "attemptsLeft": 3,
  "dbError": false   // true if DB is not yet initialised
}
```

---

### `POST /api/auth/setup` — **Public**

One-time setup. Creates the password and initial session. Returns 400 if already configured.

**Body**
```json
{
  "name": "Alice",         // required
  "password": "...",       // required, min 6 chars
  "role": "Analyst",       // optional
  "appMode": "journalism"  // optional — sets initial app mode
}
```

**Response** — sets `op_session` cookie
```json
{ "ok": true }
```

**Errors**
- `400 Already set up`
- `400 Password must be at least 6 characters`
- `400 Name is required`

---

### `POST /api/auth/login` — **Public**

Validates password and creates a new session. After 3 failed attempts the app self-destructs (triggers uninstall).

**Body**
```json
{ "password": "..." }
```

**Response** — sets `op_session` cookie
```json
{ "ok": true }
```

**Errors**
- `400 Not set up`
- `401` incorrect password with attempts remaining
- `403` max attempts reached → triggers uninstall

---

### `POST /api/auth/logout`

Clears the session from the database and removes the cookie.

**Response**
```json
{ "ok": true }
```

---

## Health & Status

### `GET /api/health` — **Public**

Returns machine suitability, app memory usage, CPU load, storage usage, and AI reachability. Used by the settings dashboard and client-side RAM warning logic.

**Response**
```json
{
  "status": "ok",        // ok | warn | error (worst of all sub-checks)
  "ai":      { "status": "ok", "label": "phi4-mini", "detail": "3 models available", "ollamaVersion": "0.6.3" },
  "memory":  { "rss": 142, "heap": 98, "status": "ok", "systemRamMb": 16384, "warnMb": 5734, "errorMb": 9011 },
  "cpu":     { "load": 0.4, "loadPct": 5, "status": "ok", "cores": 8 },
  "storage": { "totalMb": 320, "totalGb": 0.3, "status": "ok", "thresholdGb": 5 },
  "machine": {
    "status": "ok", "ramGb": 16, "ramStatus": "ok", "ramTier": "Good",
    "ramNote": "...", "cores": 8, "coresStatus": "ok",
    "cpuModel": "Apple M2", "arch": "arm64"
  }
}
```

---

### `GET /api/startup-status`

Returns whether all startup steps have completed (Ollama running, models available).

**Response**
```json
{ "ready": true, "steps": [...] }
```

---

### `GET /api/ollama-check`

Checks if Ollama is reachable and returns the configured model's availability.

**Response**
```json
{ "ok": true, "model": "phi4-mini", "available": true }
```

---

### `GET /api/ollama-status`

Returns Ollama version, running state, and list of pulled models.

**Response**
```json
{ "running": true, "version": "0.6.3", "models": ["phi4-mini", "llava-phi3"] }
```

---

## Models

### `GET /api/models-refresh`

Returns a deduplicated model list scraped from `ollama.com/search` (1-hour server-side cache). Falls back to a curated static list when offline.

**Response**
```json
{
  "models": ["phi4-mini", "llava-phi3", "gemma2:2b", "..."],
  "source": "live"  // live | cache | static
}
```

---

### `POST /api/model-pull`

Initiates an Ollama model pull. Streams SSE progress events.

**Body**
```json
{ "model": "phi4-mini" }
```

**Response** — `text/event-stream`
```
data: {"status":"pulling manifest"}
data: {"status":"done"}
```

---

### `POST /api/model-remove`

Removes an Ollama model from local storage.

**Body**
```json
{ "model": "phi4-mini" }
```

**Response**
```json
{ "ok": true }
```

---

### `POST /api/ai-test`

Sends a test prompt to the currently configured AI provider to verify connectivity.

**Body**
```json
{ "provider": "ollama", "model": "phi4-mini" }
```

**Response**
```json
{ "ok": true, "response": "Hello from phi4-mini" }
```

---

## Settings

### `GET /api/settings`

Returns all settings. Sensitive keys (API keys, passwords) are returned as `"__saved__"` if set, or `""` if not. Plaintext is never returned.

**Response**
```json
{
  "settings": {
    "app_mode": "journalism",
    "ai_provider": "ollama",
    "ollama_model": "phi4-mini",
    "anthropic_key": "__saved__",
    "ceo_name": "Alice",
    "dark_mode": "true"
  }
}
```

---

### `POST /api/settings`

Updates one or more settings. Only keys in the `ALLOWED_KEYS` allowlist are accepted; unknown keys are silently ignored. Sensitive keys are encrypted with AES-256-GCM before storage.

**Body**
```json
{
  "ollama_model": "phi4-mini",
  "app_mode": "legal",
  "anthropic_key": "sk-ant-..."
}
```

**Response**
```json
{ "ok": true }
```

---

## Projects

### `GET /api/projects`

Returns all projects and the currently active project ID.

**Response**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Investigation Alpha",
      "area": "Crime",
      "status": "in_progress",
      "startDate": "2025-03-01T00:00:00.000Z",
      "description": "...",
      "createdAt": "...",
      "_count": { "reports": 12 }
    }
  ],
  "currentProjectId": "uuid"
}
```

---

### `POST /api/projects`

Creates a new project and sets it as the active project.

**Body**
```json
{
  "name": "Project Name",     // required
  "area": "Politics",         // optional
  "startDate": "2025-01-01",  // optional ISO date
  "status": "in_progress",    // optional: in_progress | completed
  "description": "..."        // optional
}
```

**Response**
```json
{ "project": { "id": "uuid", "name": "Project Name", "..." } }
```

---

### `PATCH /api/projects/[id]`

Updates a project's fields.

**Body** — any subset of project fields
```json
{ "name": "Updated Name", "status": "completed" }
```

**Response**
```json
{ "project": { "id": "uuid", "..." } }
```

---

### `DELETE /api/projects/[id]`

Deletes a project. Reports scoped to the project are not deleted — their `projectId` is set to null.

**Response**
```json
{ "ok": true }
```

---

## Reports

### `GET /api/reports`

Returns reports, optionally filtered.

**Query params**
| Param | Description |
|---|---|
| `area` | Filter by area |
| `directReportId` | Filter by direct report |
| `limit` | Max results (default: 50) |

**Response**
```json
{ "reports": [{ "id": "uuid", "title": "...", "area": "Finance", "..." }] }
```

---

### `DELETE /api/reports`

Deletes a report by ID.

**Query params**: `id` (required)

**Response**
```json
{ "success": true }
```

---

### `GET /api/reports/[id]`

Returns a single report with all fields.

**Response**
```json
{ "report": { "id": "uuid", "title": "...", "summary": "...", "metrics": "...", "..." } }
```

---

### `PATCH /api/reports/[id]`

Updates editable fields on a report (notes, area, date, etc.).

**Body**
```json
{ "userNotes": "Analyst comment", "area": "Finance" }
```

**Response**
```json
{ "report": { "..." } }
```

---

## Upload

### `POST /api/upload`

Parses files immediately, queues them for background AI analysis, and returns a job ID. Accepts `multipart/form-data`.

**Form fields**
| Field | Type | Description |
|---|---|---|
| `files` | File[] | One or more uploaded files |
| `area` | string | Classification area |
| `title` | string | Optional title override |
| `directReportId` | string | Optional source person |
| `reportDate` | string | Optional ISO date |
| `projectId` | string | Optional project scope |

**Response**
```json
{ "jobId": "uuid", "count": 3 }
```

**Supported file types:** PDF, DOCX, DOC, XLSX, XLS, CSV, TXT, MD, JPG, JPEG, PNG, WEBP, GIF, HEIC, MP3, WAV, M4A, OGG, WEBM, FLAC, AAC, OPUS

---

### `GET /api/upload-jobs`

Returns active and recently completed upload jobs (last 2 hours). Also acts as a watchdog — restarts the background worker if queued items exist but no worker is running.

**Response**
```json
{
  "jobs": [
    {
      "id": "uuid",
      "status": "processing",
      "total": 3,
      "processed": 1,
      "items": [
        { "id": "uuid", "title": "Report.pdf", "status": "processing", "step": "Analysing...", "reportId": null, "error": null }
      ]
    }
  ]
}
```

---

### `POST /api/upload-background`

Internal endpoint called by the upload queue worker to process a single queued item. Not intended for direct external use.

---

### `GET /api/upload-link`

Returns the currently active remote submission link (requires tunnel to be running).

**Response**
```json
{ "url": "https://xxx.trycloudflare.com/submit/TOKEN", "token": "TOKEN" }
```

---

## Journal

### `GET /api/journal`

Returns all journal entries ordered by last update.

**Response**
```json
{ "entries": [{ "id": "uuid", "title": "...", "folder": "General", "content": "...", "updatedAt": "..." }] }
```

---

### `POST /api/journal`

Creates a new entry or updates an existing one (pass `id` to update).

**Body**
```json
{
  "id": "uuid",        // omit to create
  "title": "My note",
  "folder": "Leads",
  "content": "...",
  "projectId": "uuid"  // optional
}
```

**Response**
```json
{ "entry": { "id": "uuid", "..." } }
```

---

### `DELETE /api/journal`

Deletes a journal entry.

**Body**
```json
{ "id": "uuid" }
```

**Response**
```json
{ "ok": true }
```

---

## Dispatch

### `GET /api/dispatch`

Returns all chat sessions ordered by last update.

**Response**
```json
{ "chats": [{ "id": "uuid", "title": "...", "messages": "[]", "updatedAt": "..." }] }
```

---

### `POST /api/dispatch`

Creates a new chat session.

**Body**
```json
{ "title": "Chat title", "messages": [] }
```

**Response**
```json
{ "chat": { "id": "uuid", "title": "...", "messages": "[]" } }
```

---

### `POST /api/dispatch/[id]/chat`

Sends a message to an AI persona and streams the response.

**Body**
```json
{
  "messages": [{ "role": "user", "content": "What happened?" }],
  "persona": "investigator",
  "reportContext": ["uuid1", "uuid2"],
  "webSearch": false
}
```

**Response** — `text/event-stream`

---

### `PATCH /api/dispatch/[id]`

Updates a chat's title or messages.

**Body**
```json
{ "title": "Updated title", "messages": "[...]" }
```

**Response**
```json
{ "chat": { "..." } }
```

---

### `DELETE /api/dispatch/[id]`

Deletes a chat session.

**Response**
```json
{ "ok": true }
```

---

## Entities

### `GET /api/entities`

Returns extracted entities, optionally filtered.

**Query params**: `type` (person | organisation | location | date | financial), `q` (search query)

**Response**
```json
{
  "entities": [
    { "id": "uuid", "name": "Alice Smith", "type": "person", "context": "...", "count": 3, "reportIds": ["uuid"] }
  ]
}
```

---

### `GET /api/entities/graph`

Returns entity relationship graph data for the story map visualisation.

**Query params**: `projectId` (optional)

**Response**
```json
{ "nodes": [...], "edges": [...] }
```

---

## Timeline

### `GET /api/timeline`

Returns timeline events for a set of reports.

**Query params**: `reportIds` (required, comma-separated)

**Response**
```json
{
  "events": [
    { "id": "uuid", "dateText": "March 2025", "event": "...", "reportId": "uuid", "reportTitle": "..." }
  ]
}
```

---

## Storyline

### `GET /api/storyline`

Returns all stories.

**Response**
```json
{ "stories": [{ "id": "uuid", "title": "...", "status": "researching", "..." }] }
```

---

### `POST /api/storyline`

Creates a new story.

**Body**
```json
{ "title": "Story title", "description": "...", "reportIds": ["uuid1"] }
```

**Response**
```json
{ "story": { "id": "uuid", "..." } }
```

---

### `GET /api/storyline/[id]`

Returns a single story with evidence and sources.

---

### `PATCH /api/storyline/[id]`

Updates a story's fields (title, narrative, status, events, etc.).

---

### `DELETE /api/storyline/[id]`

Deletes a story.

---

### `POST /api/storyline/generate`

Runs AI analysis to generate a narrative for a story from its source documents. Streams SSE.

**Body**
```json
{ "storyId": "uuid", "reportIds": ["uuid1", "uuid2"] }
```

---

## Pulse (Feed Aggregator)

### `GET /api/pulse`

Returns all feeds and their recent items.

---

### `POST /api/pulse`

Creates a new feed.

**Body**
```json
{ "name": "BBC News", "url": "https://...", "type": "rss" }
```

**Types:** `rss` | `reddit` | `youtube` | `bluesky` | `mastodon`

---

### `DELETE /api/pulse/[id]`

Deletes a feed and all its items.

---

### `POST /api/pulse/refresh`

Fetches the latest items for all enabled feeds.

---

## Directs (People / Sources)

### `GET /api/directs`

Returns all people (direct reports / sources), ordered by name.

---

### `POST /api/directs`

Creates a new person record.

**Body**
```json
{ "name": "Alice", "title": "Editor", "area": "Politics", "email": "...", "phone": "..." }
```

---

### `PATCH /api/directs/[id]`

Updates a person's fields.

---

### `DELETE /api/directs/[id]`

Deletes a person record.

---

## Report Requests

### `GET /api/report-requests`

Returns all open report requests (shareable submission links).

---

### `POST /api/report-requests`

Creates a new report request with a unique submission token.

**Body**
```json
{ "title": "Q1 Update", "area": "Finance", "directReportId": "uuid", "message": "Please submit..." }
```

---

### `POST /api/report-requests/[token]/submit` — **Public**

Public endpoint for remote submissions. Accepts files uploaded via the shareable link.

---

## Analysis & AI

### `GET /api/catch-me-up`

Generates an AI summary of recent activity across all documents. Streams SSE.

---

### `GET /api/insights`

Returns AI-generated cross-document insights for a specified area or project.

---

### `POST /api/reports/[id]/reanalyze`

Re-runs AI analysis on a report. Streams SSE progress.

---

### `POST /api/one-pager/generate`

Generates an executive one-pager brief across all project documents. Streams SSE.

---

### `POST /api/one-pager/save`

Saves a one-pager to the database.

---

### `POST /api/extract-pdf`

Extracts text content from an uploaded PDF without running AI analysis.

---

### `GET /api/topic-search`

Searches documents by semantic topic query.

**Query params**: `q` (required), `projectId` (optional)

---

### `POST /api/audio-check`

Validates that an audio-capable model is configured and reachable.

---

## Knowledge Base

### `GET /api/knowledge`

Returns glossary terms and area briefings for the current mode.

---

### `POST /api/knowledge`

Creates or updates a knowledge entry (glossary term or area briefing).

---

## Audit Log

### `GET /api/audit`

Returns the last 200 audit log entries, ordered newest first.

**Response**
```json
{ "logs": [{ "id": "uuid", "action": "auth:login", "detail": "Successful login", "createdAt": "..." }] }
```

---

## Browser

### `POST /api/browser/fetch`

Fetches a URL and returns the page content (reader mode or raw HTML).

**Body**
```json
{ "url": "https://...", "mode": "reader" }
```

---

### `GET /api/browser/bookmarks`

Returns all browser bookmarks.

---

### `POST /api/browser/bookmarks`

Creates a bookmark.

---

### `DELETE /api/browser/bookmarks/[id]`

Deletes a bookmark.

---

## Search

### `GET /api/search`

Full-text search across reports, journal entries, and entities.

**Query params**: `q` (required)

**Response**
```json
{
  "reports": [...],
  "journal": [...],
  "entities": [...]
}
```

---

## Geocode

### `GET /api/geocode`

Resolves a place name to coordinates for map display.

**Query params**: `q` (place name)

**Response**
```json
{ "lat": 51.5, "lon": -0.12, "displayName": "London, England" }
```

---

## Tunnel

### `POST /api/tunnel/start`

Starts a Cloudflare Quick Tunnel for remote submissions.

**Response**
```json
{ "url": "https://xxx.trycloudflare.com", "token": "TOKEN" }
```

---

### `POST /api/tunnel/stop`

Stops the active tunnel.

---

## Backup & Export

### `GET /api/backup`

Downloads a full database backup as a SQLite file.

---

### `POST /api/backup/restore`

Restores the database from an uploaded backup file.

---

## System

### `POST /api/shutdown`

Gracefully shuts down the Next.js server process.

**Response**
```json
{ "ok": true }
```

---

### `POST /api/uninstall`

Triggers the full uninstall sequence (deletes app data and stops the server). Requires auth.

---

### `GET /api/history`

Returns the version/change history for a report, showing diffs between analyses.

**Query params**: `reportId` (required)

---

### `POST /api/open-folder`

Opens the reports folder in the native OS file browser.

**Response**
```json
{ "ok": true }
```
