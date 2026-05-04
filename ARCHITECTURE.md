# Operator — Architecture

## lib/ Directory Structure

```
lib/
├── ai.ts                   ← barrel: re-exports everything from lib/ai/ and lib/ai/journalism + vision
├── ai/
│   ├── analyze.ts          ← report analysis, comparison, resolved-flags (analyzeReport, compareReports)
│   ├── anthropic.ts        ← Anthropic provider implementation
│   ├── catch-up.ts         ← catch-me-up digest generation
│   ├── dispatch.ts         ← chat stream dispatcher (routes to provider, handles tool calls)
│   ├── google.ts           ← Google Gemini provider implementation
│   ├── journalism.ts       ← journalism-specific extractions (entities, timeline, redactions, verification, extractMerged)
│   ├── knowledge.ts        ← area knowledge injection for cloud analysis
│   ├── ollama.ts           ← Ollama provider implementation
│   ├── openai.ts           ← OpenAI provider implementation
│   ├── stream-utils.ts     ← streaming response helpers
│   ├── tools.ts            ← tool definitions, implementations, and intent detection
│   ├── types.ts            ← shared AI types
│   └── vision.ts           ← image description + audio transcription
├── collab/
│   ├── feature-flag.ts     ← collab feature gate
│   ├── identity.ts         ← peer identity management
│   ├── invite.ts           ← invite token handling
│   ├── mdns.ts             ← mDNS peer discovery
│   ├── signing.ts          ← payload signing/verification
│   ├── sync-apply.ts       ← inbound sync: applies incoming peer records to local DB
│   ├── sync-push.ts        ← outbound sync: pushes local changes to peers
│   ├── sync.ts             ← sync orchestration
│   └── types.ts            ← SyncPayload, SyncRecord types
├── map/
│   └── mlMap.ts            ← geospatial / OpenLayers map utilities
├── media/
│   ├── face-utils.ts       ← facial recognition helpers (path validation, embedding serialization)
│   ├── forensics.ts        ← ELA + deepfake detection (pure image math, no ML)
│   └── metadata.ts         ← EXIF extraction via exifr
├── models/
│   ├── caps-shared.ts      ← MODEL_CAPS_REGISTRY + client-safe helpers (safe to import in components)
│   └── capabilities.ts     ← server-side model routing (RAM checks, routeVisionModel, routeAudioModel)
├── personas/               ← journalism persona definitions (legacy, kept for compatibility)
├── api-auth.ts             ← requireAuth — used as first line in every API route handler
├── api-error.ts            ← standardised error responses
├── audit.ts                ← logAction — append-only audit trail
├── auth.ts                 ← session hashing, cookie helpers
├── db.ts                   ← Prisma client singleton
├── embeddings.ts           ← Ollama embedding generation for semantic search
├── encryption.ts           ← AES-256-GCM API key encryption
├── file-cleaner.ts         ← metadata stripping via mat2/exiftool
├── file-cleaner-shared.ts  ← shared file-cleaner types
├── file-scan.ts            ← malware/MIME safety scan before upload
├── files-types.ts          ← file type constants
├── google-fetch.ts         ← Google Docs/Sheets export URL fetching
├── knowledge-seed.ts       ← glossary seeding
├── mode-gate.ts            ← feature gate helper
├── mode-labels.ts          ← UI label overrides per mode
├── mode.ts                 ← getModeConfig — feature flags and labels for journalism mode
├── osint-resources.ts      ← static OSINT resource list
├── parsers.ts              ← MIME detection, content extraction, normalisation
├── patterns.ts             ← regex patterns for content analysis
├── rate-limit.ts           ← request rate limiting
├── reports-folder.ts       ← report file storage root resolution
├── settings.ts             ← DB settings access (loadAiSettings, getSecret)
├── tunnel.ts               ← cloudflared tunnel management
├── uninstall.ts            ← cleanup utilities
├── upload-pipeline.ts      ← per-item AI processing (called by upload-queue worker)
├── upload-queue.ts         ← job queue orchestrator (worker loop, kickWorker)
├── url-safety.ts           ← SSRF protection (isInternalUrl)
├── use-fetch.ts            ← client-side fetch hook
├── use-settings.ts         ← client-side settings hook
├── username-search.ts      ← Sherlock-style username search (TS port)
├── utils.ts                ← general utilities (JSON parsing, text helpers)
└── web-monitor.ts          ← website change monitoring
```

---

## Upload Pipeline

A file upload follows this path:

```
POST /api/upload
  │
  ├─ requireAuth
  ├─ scanFile (malware/MIME check)
  ├─ Save file to disk (reports-folder.ts)
  ├─ Create UploadJob + UploadJobItem in DB
  │    (status: 'queued', rawContent placeholder)
  ├─ Return job ID to client immediately
  └─ kickWorker() ← schedules background processing

Background worker (upload-queue.ts → runWorker)
  │
  ├─ Dequeue next UploadJobItem
  └─ processItem(itemId) [upload-pipeline.ts]
       │
       ├─ Audio?  → transcribeAudio() [ai/vision.ts]
       ├─ Image?  → describeImage() [ai/vision.ts]
       │
       ├─ analyzeReport() [ai/analyze.ts]
       │    └─ summary, metrics, insights, questions
       │
       ├─ Create Report in DB (visible in UI immediately)
       │
       ├─ compareReports() — diff against previous report
       ├─ checkResolvedFlags() — which prior risks are now resolved
       │
       ├─ extractMerged() [ai/journalism.ts]
       │    └─ entities + timeline + redactions + verification
       │         in ONE prompt for Ollama, parallel for cloud
       │
       ├─ compareDocumentsJournalism() — passage-level diff
       │
       ├─ Auto-create: risks, claims, action items, embeddings
       │
       └─ Mark item 'done'

  After batch empty:
  ├─ refreshBriefingsForBatch() — regenerate area briefings
  └─ unloadOllamaModel() — free RAM/VRAM
```

`POST /api/upload-link` follows a shorter version of this path (no queue — runs analysis inline, no extractMerged or journalism features).

---

## AI Layer

```
lib/ai.ts  (barrel — all callers import from here)
     │
     ├── ai/analyze.ts        analyzeReport, compareReports, checkResolvedFlags
     ├── ai/journalism.ts     extractEntities, extractTimeline, detectRedactions,
     │                        compareDocumentsJournalism, generateVerificationChecklist,
     │                        extractMerged (single Ollama prompt vs parallel cloud)
     ├── ai/vision.ts         describeImage, transcribeAudio
     ├── ai/dispatch.ts       dispatchChatStream — chat with tools, streaming
     ├── ai/catch-up.ts       generateCatchMeUp — digest of recent reports
     ├── ai/knowledge.ts      loadKnowledgeForArea — injects briefing + glossary into prompts
     └── ai/tools.ts          tool definitions, executeTool, intent detection
           │
           └── ai-providers.ts  chat(), getProvider(), maxContentLength()
                 │
                 ├── ai/ollama.ts
                 ├── ai/anthropic.ts
                 ├── ai/openai.ts
                 └── ai/google.ts

Model capabilities:
  lib/models/caps-shared.ts    MODEL_CAPS_REGISTRY — safe to import in components
  lib/models/capabilities.ts   routeVisionModel, routeAudioModel, maxCharsForModel (server only)
```

**Key rules:**
- Never parallelise Ollama calls — `extractMerged` combines extractions into one prompt for this reason
- Always set `num_ctx` (right-sized) and `think: false` in Ollama chat options
- `extractMemoryFacts` runs every 4th message to avoid blocking replies

---

## Collab Sync

```
Peer connects via mDNS (lib/collab/mdns.ts)
     │
     ├─ Identity verified (lib/collab/identity.ts + signing.ts)
     │
     ├─ Outbound: sync-push.ts
     │    └─ Pushes local changes to connected peers
     │
     └─ Inbound: sync-apply.ts
          └─ applySyncPayload(payload)
               │
               ├─ Verifies signature
               └─ Dispatches by table type:
                    ├─ applyReport()         Last-Write-Wins + conflict detection
                    ├─ applyAppendOnly()     ReportEntity, TimelineEvent (skip if exists)
                    ├─ applyClaim()          Status conflict detection
                    ├─ applyFoia()           Status conflict detection
                    ├─ applyChatMessage()    syncClock versioning, deletion consensus
                    ├─ applyJournalEntry()   Shared-flag gate + LWW
                    └─ applyEntryStructure() Parent-shared gate + LWW

Conflict window: 5 minutes (CONFLICT_WINDOW_MS)
Conflicts logged to syncConflict table (deduplicated)
```

---

## Where to Add New Code

| What | Where |
|---|---|
| New AI analysis function | `lib/ai/journalism.ts` (journalism) or `lib/ai/analyze.ts` (general) |
| New chat tool | `lib/ai/tools.ts` — add definition + implementation |
| New upload processing step | `lib/upload-pipeline.ts` — add inside `processItem()` |
| New model in registry | `lib/models/caps-shared.ts` — append to `MODEL_CAPS_REGISTRY` |
| New media utility | `lib/media/` |
| New API route | `app/api/<feature>/route.ts` — first two lines must be `requireAuth` |
| New sync table type | `lib/collab/sync-apply.ts` — add handler + wire into dispatcher |
| New feature flag | `lib/mode.ts` — add to `journalism` config features |
| New settings key | `lib/settings.ts` + `ALLOWED_KEYS` in `app/api/settings/route.ts` |
