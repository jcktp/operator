#!/bin/bash
set -euo pipefail

# ── colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
step()  { echo -e "${GREEN}▶${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $1"; }
error() { echo -e "${RED}✗${NC}  $1"; exit 1; }
bold()  { echo -e "${BOLD}$1${NC}"; }

cd "$(dirname "$0")"
PORT=3000
PID_FILE="/tmp/operator-next.pid"
LOG_FILE="/tmp/operator.log"
STATUS_FILE="/tmp/operator-startup.json"

# ── detect OS ─────────────────────────────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
  Darwin)  PLATFORM="macOS" ;;
  Linux)   PLATFORM="Linux" ;;
  MINGW*|CYGWIN*|MSYS*) PLATFORM="Windows" ;;
  *)       PLATFORM="unknown" ;;
esac

open_browser() {
  case "$PLATFORM" in
    macOS)   open -g "$1" ;;
    Linux)   xdg-open "$1" 2>/dev/null || true ;;
    Windows) start "$1" 2>/dev/null || true ;;
  esac
}

# Write current status to the file the /starting page polls
set_status() {
  local step_msg="$1"
  local detail_msg="${2:-}"
  printf '{"step":"%s","detail":"%s","ready":false}' "$step_msg" "$detail_msg" > "$STATUS_FILE"
}

set_ready() {
  printf '{"step":"Ready","detail":"","ready":true}' > "$STATUS_FILE"
}

# Clear any previous run's status
rm -f "$STATUS_FILE"

bold "\nOperator — starting up in dev mode (${PLATFORM})\n"

# ── 1. Homebrew (macOS only) ──────────────────────────────────────────────────
if [ "$PLATFORM" = "macOS" ]; then
  if ! command -v brew &>/dev/null; then
    step "Homebrew not found — installing..."
    echo -e "${YELLOW}  You may be prompted for your password.${NC}"
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
      || error "Failed to install Homebrew. Install it manually from https://brew.sh then re-run this script."
    if [ -f /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -f /usr/local/bin/brew ]; then
      eval "$(/usr/local/bin/brew shellenv)"
    fi
    step "Homebrew installed"
  else
    step "Homebrew found ($(brew --version | head -1))"
    if [ -f /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
  fi
fi

# ── 2. Node.js ────────────────────────────────────────────────────────────────
step "Checking Node.js..."
if ! command -v node &>/dev/null; then
  warn "Node.js not found — installing..."
  case "$PLATFORM" in
    macOS)
      brew install node || error "Failed to install Node.js via Homebrew"
      ;;
    Linux)
      if command -v apt-get &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - \
          && sudo apt-get install -y nodejs \
          || error "Failed to install Node.js. Install manually from https://nodejs.org"
      elif command -v dnf &>/dev/null; then
        sudo dnf install -y nodejs || error "Failed to install Node.js. Install manually from https://nodejs.org"
      elif command -v yum &>/dev/null; then
        sudo yum install -y nodejs || error "Failed to install Node.js. Install manually from https://nodejs.org"
      elif command -v pacman &>/dev/null; then
        sudo pacman -Sy --noconfirm nodejs npm || error "Failed to install Node.js. Install manually from https://nodejs.org"
      else
        error "Node.js not found. Install from https://nodejs.org"
      fi
      ;;
    Windows)
      error "Node.js not found. Install from https://nodejs.org/en/download/ then re-run this script."
      ;;
    *)
      error "Node.js not found. Install from https://nodejs.org"
      ;;
  esac
fi
step "Node $(node --version)"

# ── 3. Ollama ─────────────────────────────────────────────────────────────────
step "Checking Ollama..."
if ! command -v ollama &>/dev/null; then
  warn "Ollama not found — installing..."
  case "$PLATFORM" in
    macOS)
      brew install ollama || error "Failed to install Ollama via Homebrew"
      ;;
    Linux)
      curl -fsSL https://ollama.com/install.sh | sh || error "Failed to install Ollama. Visit https://ollama.com"
      ;;
    Windows)
      error "Please install Ollama from https://ollama.com/download/windows then re-run this script."
      ;;
    *)
      error "Ollama not found. Install from https://ollama.com"
      ;;
  esac
  step "Ollama installed"
else
  # Ollama is present — attempt an upgrade so models requiring newer versions work.
  OLLAMA_CURRENT="$(ollama --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo 'unknown')"
  step "Ollama found (v${OLLAMA_CURRENT}) — checking for updates..."
  case "$PLATFORM" in
    macOS)
      if brew list --cask ollama &>/dev/null 2>&1; then
        brew upgrade --cask ollama 2>/dev/null && step "Ollama updated (cask) to $(ollama --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo 'latest')" \
          || step "Ollama already up to date"
      elif brew list ollama &>/dev/null 2>&1; then
        brew upgrade ollama 2>/dev/null && step "Ollama updated to $(ollama --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo 'latest')" \
          || step "Ollama already up to date"
      else
        warn "Ollama not managed by Homebrew — update manually at ollama.com/download if you get version errors"
      fi
      ;;
    Linux)
      curl -fsSL https://ollama.com/install.sh | sh >/dev/null 2>&1 \
        && step "Ollama updated" \
        || step "Ollama already up to date"
      ;;
    *)
      step "Ollama up to date check skipped on this platform"
      ;;
  esac
fi

# ── 3b. Tesseract OCR (for image text extraction) ────────────────────────────
if ! command -v tesseract &>/dev/null; then
  step "Tesseract OCR not found — installing..."
  case "$PLATFORM" in
    macOS)
      brew install tesseract || warn "Could not install Tesseract — image text extraction will fall back to vision model"
      ;;
    Linux)
      if command -v apt-get &>/dev/null; then
        sudo apt-get install -y tesseract-ocr >/dev/null 2>&1 || warn "Could not install Tesseract"
      elif command -v dnf &>/dev/null; then
        sudo dnf install -y tesseract >/dev/null 2>&1 || warn "Could not install Tesseract"
      elif command -v pacman &>/dev/null; then
        sudo pacman -Sy --noconfirm tesseract tesseract-data-eng >/dev/null 2>&1 || warn "Could not install Tesseract"
      else
        warn "Tesseract not available — image text extraction will fall back to vision model"
      fi
      ;;
    *)
      warn "Tesseract not available on this platform — image text extraction will fall back to vision model"
      ;;
  esac
else
  step "Tesseract OCR found"
fi

# ── 3c. Python 3.12 (required for TensorFlow / DeepFace) ─────────────────────
step "Ensuring Python 3.12 is installed..."
case "$PLATFORM" in
  macOS)
    if ! command -v python3.12 &>/dev/null; then
      step "  Installing python@3.12 via brew..."
      brew install python@3.12 >/dev/null 2>&1 || warn "  Could not install python@3.12"
    else
      brew upgrade python@3.12 >/dev/null 2>&1 || true
    fi
    ;;
  Linux)
    if ! command -v python3.12 &>/dev/null; then
      if command -v apt-get &>/dev/null; then
        sudo apt-get install -y python3.12 python3.12-venv >/dev/null 2>&1 || warn "  Could not install python3.12"
      fi
    fi
    ;;
esac

# ── 3d. Face recognition service ─────────────────────────────────────────────
FACE_PID=0
FACES_VENV=".venv-faces"
FACES_SKIP=false
step "Setting up facial recognition..."

# TensorFlow requires Python 3.9-3.12; prefer 3.12
FACES_PYTHON=""
for _v in python3.12 python3.11 python3.10 python3.9; do
  if command -v "$_v" &>/dev/null; then FACES_PYTHON="$_v"; break; fi
done
if [ -z "$FACES_PYTHON" ]; then
  warn "  No compatible Python (3.9-3.12) found — facial recognition will be unavailable"
  FACES_SKIP=true
fi

# Create isolated virtualenv (avoids macOS externally-managed-environment error)
if [ "$FACES_SKIP" = "false" ] && [ ! -f "$FACES_VENV/bin/python3" ]; then
  step "  Creating face service virtual environment ($FACES_PYTHON)..."
  "$FACES_PYTHON" -m venv "$FACES_VENV" \
    || { warn "  Could not create venv — facial recognition will be unavailable"; FACES_SKIP=true; }
fi

# Install deps into the venv if not already present
if [ "$FACES_SKIP" = "false" ] && ! "$FACES_VENV/bin/python3" -c "import deepface" 2>/dev/null; then
  step "  Installing DeepFace dependencies (first run — this may take a few minutes)..."
  "$FACES_VENV/bin/pip" install -q --no-cache-dir --prefer-binary -r requirements-faces.txt \
    || { warn "  Could not install DeepFace — facial recognition will be unavailable"; FACES_SKIP=true; }
fi

# Download ArcFace + RetinaFace model weights on first run (non-interactive)
if [ "$FACES_SKIP" = "false" ]; then
  "$FACES_VENV/bin/python3" -c "
from deepface import DeepFace
import numpy as np, cv2, tempfile, os
dummy = np.zeros((112,112,3), dtype=np.uint8)
with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
    cv2.imwrite(f.name, dummy)
    tmp = f.name
try:
    DeepFace.represent(tmp, model_name='ArcFace', detector_backend='retinaface', enforce_detection=False)
except:
    pass
os.unlink(tmp)
print('  Face models ready.')
" 2>/dev/null || step "  Face model pre-download skipped (will download on first use)."

  pkill -f face_service.py 2>/dev/null || true
  "$FACES_VENV/bin/python3" face_service.py &
  FACE_PID=$!
  step "  Face service started (PID $FACE_PID)"
else
  warn "  Facial recognition service skipped"
fi

# ── 3e. Image analysis (ELA + deepfake) ───────────────────────────────────────
# Ported to TypeScript (lib/image-forensics.ts) — no Python service needed.
step "Image analysis: using built-in TypeScript module (no Python service needed)"

# ── 3f. Media service (speaker diarization) ──────────────────────────────────
MEDIA_PID=0
MEDIA_VENV=".venv-media"
MEDIA_SKIP=false
step "Setting up media analysis service..."

if ! command -v python3 &>/dev/null; then
  MEDIA_SKIP=true
fi

if [ "$MEDIA_SKIP" = "false" ] && [ ! -f "$MEDIA_VENV/bin/python3" ]; then
  step "  Creating media service virtual environment..."
  python3 -m venv "$MEDIA_VENV" \
    || { warn "  Could not create media venv — speaker diarization will be unavailable"; MEDIA_SKIP=true; }
fi

if [ "$MEDIA_SKIP" = "false" ] && ! "$MEDIA_VENV/bin/python3" -c "import resemblyzer; import faster_whisper" 2>/dev/null; then
  step "  Installing media dependencies (resemblyzer + faster-whisper)..."
  "$MEDIA_VENV/bin/pip" install -q --no-cache-dir --prefer-binary -r requirements-media.txt \
    || { warn "  Could not install media deps — speaker diarization will be unavailable"; MEDIA_SKIP=true; }
fi

if [ "$MEDIA_SKIP" = "false" ]; then
  pkill -f media_service.py 2>/dev/null || true
  "$MEDIA_VENV/bin/python3" media_service.py &
  MEDIA_PID=$!
  step "  Media service started (PID $MEDIA_PID)"
else
  warn "  Media analysis service skipped"
fi

# ── 4. cloudflared + supporting tools (updated in background, non-blocking) ────
# Note: Ollama is already upgraded synchronously in step 3 — not repeated here.
update_tools_bg() {
  case "$PLATFORM" in
    macOS)
      command -v brew &>/dev/null || return
      brew install cloudflared tesseract >/dev/null 2>&1 || true
      brew upgrade cloudflared tesseract >/dev/null 2>&1 || true ;;
    Linux)
      # Update cloudflared binary
      ARCH="$(uname -m)"
      case "$ARCH" in x86_64) CF_ARCH="amd64" ;; aarch64|arm64) CF_ARCH="arm64" ;; *) CF_ARCH="amd64" ;; esac
      CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}"
      curl -fsSL "$CF_URL" -o /tmp/cloudflared-dl 2>/dev/null \
        && sudo install -m 0755 /tmp/cloudflared-dl /usr/local/bin/cloudflared 2>/dev/null \
        && rm -f /tmp/cloudflared-dl || true ;;
  esac
}
if command -v cloudflared &>/dev/null; then
  step "cloudflared ready"
  update_tools_bg &
else
  warn "cloudflared not found — installing in background..."
  update_tools_bg &
fi

# ── 5. Environment file ───────────────────────────────────────────────────────
if [ ! -f ".env.local" ]; then
  step "Creating .env.local (first run)..."
  cat > .env.local <<EOF
DATABASE_URL="file:$(pwd)/prisma/dev.db"

# ── AI provider ───────────────────────────────────────────────────────────────
# Which AI backend to use. Options: ollama | anthropic | openai | google | groq | xai | perplexity | mistral
# Can also be changed from the Settings page inside the app.
# AI_PROVIDER="ollama"

# ── Ollama (local, default) ───────────────────────────────────────────────────
# OLLAMA_HOST="http://localhost:11434"
# OLLAMA_MODEL="phi4-mini"          # text model — change in Settings or here
# OLLAMA_VISION_MODEL="moondream:1.8b-v2-q4_K_M"   # vision model for image uploads
#                                   # moondream is ~1.7 GB; Ollama swaps it in/out on demand
# OLLAMA_WEB_ACCESS="false"         # set to "true" to enable web search in Dispatch (requires BRAVE_SEARCH_KEY)

# ── Cloud API keys ────────────────────────────────────────────────────────────
# Optional: set here as an alternative to the Settings page in the app.
# Keys entered in Settings are stored in the local database and take precedence.
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""
GOOGLE_API_KEY=""
GROQ_API_KEY=""
XAI_API_KEY=""
PERPLEXITY_API_KEY=""
# MISTRAL_API_KEY=""

# ── Model overrides (cloud providers) ────────────────────────────────────────
# ANTHROPIC_MODEL="claude-haiku-4-5-20251001"
# OPENAI_MODEL="gpt-4o-mini"
# GOOGLE_MODEL="gemini-2.5-flash"
# MISTRAL_MODEL="mistral-small-latest"
# GROQ_MODEL="llama-3.1-8b-instant"
# XAI_MODEL="grok-2-latest"
# PERPLEXITY_MODEL="sonar"

# ── Optional features ─────────────────────────────────────────────────────────
# BRAVE_SEARCH_KEY=""               # Brave Search API key for Dispatch web search
# AIR_GAP_MODE="false"              # set to "true" to block all outbound network calls (Ollama only)
EOF
  step ".env.local created"
else
  step ".env.local already exists"
fi

# ── 6. Dependencies ───────────────────────────────────────────────────────────
if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules" ]; then
  step "Installing dependencies..."
  npm install --loglevel=error
else
  step "Dependencies up to date"
fi

# ── 6a. Collaboration dependencies (optional — installed when COLLAB_ENABLED=true) ────
if grep -q 'COLLAB_ENABLED=true' .env.local 2>/dev/null; then
  if ! node -e "require('multicast-dns')" 2>/dev/null; then
    step "Installing collaboration dependencies (multicast-dns)..."
    npm install multicast-dns --loglevel=error || warn "Could not install multicast-dns — local network peer discovery unavailable"
  fi
fi

# ── 6b. Prisma generate (skip if client already up to date) ──────────────────
export DATABASE_URL="file:$(pwd)/prisma/dev.db"
PRISMA_CLIENT="node_modules/.prisma/client/index.js"
PRISMA_SCHEMA="prisma/schema.prisma"
if [ ! -f "$PRISMA_CLIENT" ] || [ "$PRISMA_SCHEMA" -nt "$PRISMA_CLIENT" ]; then
  step "Generating Prisma client..."
  npx prisma generate 2>/dev/null || true
else
  step "Prisma client up to date"
fi

# ── 7. Database (skip migrate if DB exists and no pending migrations) ─────────
DB_FILE="prisma/dev.db"
MIGRATIONS_DIR="prisma/migrations"
if [ ! -f "$DB_FILE" ]; then
  step "Setting up database..."
  npx prisma migrate deploy || error "Database migration failed"
  step "Database ready"
else
  # Check if any migration files are newer than the DB — if so, run migrations
  NEEDS_MIGRATE=false
  if [ -d "$MIGRATIONS_DIR" ]; then
    while IFS= read -r -d '' f; do
      if [ "$f" -nt "$DB_FILE" ]; then NEEDS_MIGRATE=true; break; fi
    done < <(find "$MIGRATIONS_DIR" -name "*.sql" -print0 2>/dev/null)
  fi
  if [ "$NEEDS_MIGRATE" = true ]; then
    step "Applying database migrations..."
    npx prisma migrate deploy || error "Database migration failed"
    step "Database ready"
  else
    step "Database up to date"
  fi
fi

# ── 8. Kill any existing server on this port ─────────────────────────────────
if lsof -ti ":$PORT" &>/dev/null; then
  step "Stopping existing process on port $PORT..."
  lsof -ti ":$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# ── 8b. Clear previous session so user must log in fresh ─────────────────────
step "Clearing previous session..."
node -e "
  const path = require('path');
  const db = path.resolve(process.cwd(), 'prisma', 'dev.db');
  if (!require('fs').existsSync(db)) process.exit(0);
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
  const { PrismaClient } = require('@prisma/client');
  const adapter = new PrismaBetterSqlite3({ url: db });
  const prisma = new PrismaClient({ adapter });
  prisma.setting.updateMany({ where: { key: 'auth_session_token' }, data: { value: '' } })
    .then(() => process.exit(0)).catch(() => process.exit(0));
" 2>/dev/null || true

# ── 9. Start Next.js (dev mode — hot reload, see changes instantly) ──────────
# Kill any stale Next.js process on the target port to avoid ChunkLoadError from
# two servers serving mismatched chunks to the same browser session
if lsof -ti ":$PORT" &>/dev/null; then
  step "  Killing existing process on port $PORT..."
  lsof -ti ":$PORT" | xargs kill -9 2>/dev/null || true
fi
set_status "Starting server…"
step "Starting Operator (dev mode)..."
npm run dev -- --port $PORT > "$LOG_FILE" 2>&1 &
NEXT_PID=$!
echo $NEXT_PID > "$PID_FILE"

# ── 10. Wait for server, then open browser ────────────────────────────────────
step "Waiting for server to be ready..."
ATTEMPTS=0
MAX=120
until curl -sf "http://localhost:$PORT" &>/dev/null; do
  sleep 1
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ $ATTEMPTS -ge $MAX ]; then
    error "Server didn't start in time. Check $LOG_FILE"
  fi
  if ! kill -0 $NEXT_PID 2>/dev/null; then
    error "Server crashed. Check $LOG_FILE"
  fi
done

# Open the browser
step "Opening Operator in your browser..."
open_browser "http://localhost:$PORT/starting"

# ── 11. Ollama server (browser is already open, user sees loading screen) ─────
set_status "Starting AI engine…"
if pgrep -x "ollama" &>/dev/null; then
  step "Ollama already running"
else
  step "Starting Ollama server..."
  ollama serve >/tmp/ollama.log 2>&1 &
  sleep 2
  pgrep -x "ollama" &>/dev/null || error "Ollama failed to start. Check /tmp/ollama.log"
  step "Ollama server started"
fi

# ── 12. Model (only when Ollama is the active AI provider) ───────────────────
AI_PROVIDER=$(node -e "
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), 'prisma', 'dev.db') });
const prisma = new PrismaClient({ adapter });
prisma.setting.findUnique({ where: { key: 'ai_provider' } })
  .then(s => { console.log(s?.value || 'ollama'); process.exit(0); })
  .catch(() => { console.log('ollama'); process.exit(0); });
" 2>/dev/null || echo "ollama")

if [ "$AI_PROVIDER" != "ollama" ]; then
  step "Cloud AI provider ($AI_PROVIDER) — skipping model download"
  sleep 2
else
  # On first run onboarding_complete is not set — skip the pull so the
  # onboarding flow lets the user choose their model before downloading.
  ONBOARDING_DONE=$(node -e "
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), 'prisma', 'dev.db') });
const prisma = new PrismaClient({ adapter });
prisma.setting.findUnique({ where: { key: 'onboarding_complete' } })
  .then(s => { console.log(s?.value === 'true' ? 'true' : 'false'); process.exit(0); })
  .catch(() => { console.log('false'); process.exit(0); });
" 2>/dev/null || echo "false")

  if [ "$ONBOARDING_DONE" != "true" ]; then
    step "First run — skipping model download (onboarding will handle it)"
    sleep 1
  else
    DEFAULT_MODEL="phi4-mini"
    MODEL=$(node -e "
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), 'prisma', 'dev.db') });
const prisma = new PrismaClient({ adapter });
prisma.setting.findUnique({ where: { key: 'ollama_model' } })
  .then(s => { console.log(s?.value || '${DEFAULT_MODEL}'); process.exit(0); })
  .catch(() => { console.log('${DEFAULT_MODEL}'); process.exit(0); });
" 2>/dev/null || echo "$DEFAULT_MODEL")

    step "Model: $MODEL"

    if ollama list 2>/dev/null | grep -q "^${MODEL}"; then
      step "Model already available"
      sleep 2
    else
      step "Pulling $MODEL — this may take a few minutes on first run..."
      set_status "Downloading AI model…" "$MODEL — this only happens once"
      ollama pull "$MODEL" || error "Failed to pull model $MODEL"
      step "Model $MODEL ready"
    fi

    # Vision model — prefer DB setting (saved by onboarding), then .env.local, then default
    DEFAULT_VISION_MODEL="llava-phi3"
    VISION_MODEL=$(node -e "
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), 'prisma', 'dev.db') });
const prisma = new PrismaClient({ adapter });
prisma.setting.findUnique({ where: { key: 'ollama_vision_model' } })
  .then(s => { console.log(s?.value || '${DEFAULT_VISION_MODEL}'); process.exit(0); })
  .catch(() => { console.log('${DEFAULT_VISION_MODEL}'); process.exit(0); });
" 2>/dev/null || echo "$DEFAULT_VISION_MODEL")
    if [ -f ".env.local" ]; then
      VISION_MODEL_OVERRIDE=$(grep -E '^OLLAMA_VISION_MODEL=' .env.local | head -1 | sed 's/OLLAMA_VISION_MODEL=//;s/"//g;s/'"'"'//g' || true)
      [ -n "$VISION_MODEL_OVERRIDE" ] && VISION_MODEL="$VISION_MODEL_OVERRIDE"
    fi
    if ollama list 2>/dev/null | grep -q "^${VISION_MODEL}"; then
      step "Vision model ($VISION_MODEL) already available"
    else
      step "Pulling vision model $VISION_MODEL (~1.7 GB — for image uploads, only happens once)…"
      set_status "Downloading vision model…" "$VISION_MODEL — needed for image uploads"
      ollama pull "$VISION_MODEL" || warn "Could not pull vision model $VISION_MODEL — image analysis will be skipped"
    fi
  fi
fi

# ── 13. All done — signal the loading page to redirect ───────────────────────
set_ready
step "Ready!"

bold "\nOperator is running at http://localhost:${PORT}"
echo -e "Press ${BOLD}Ctrl+C${NC} to stop, or use the power button in the app.\n"

# ── 14. Shutdown handler ─────────────────────────────────────────────────────
cleanup() {
  echo ""
  step "Shutting down..."
  # Invalidate session so user must log in again on next startup
  node -e "
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    const { PrismaClient } = require('@prisma/client');
    const path = require('path');
    const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), 'prisma', 'dev.db') });
    const prisma = new PrismaClient({ adapter });
    prisma.setting.updateMany({ where: { key: 'auth_session_token' }, data: { value: '' } })
      .then(() => process.exit(0)).catch(() => process.exit(0));
  " 2>/dev/null || true
  [ -f "$PID_FILE" ] && kill "$(cat $PID_FILE)" 2>/dev/null; rm -f "$PID_FILE"
  [ "$FACE_PID" -gt 0 ] 2>/dev/null && kill "$FACE_PID" 2>/dev/null || true
  pkill -f face_service.py 2>/dev/null || true
  # analysis_service.py removed — now handled by TypeScript
  [ "$MEDIA_PID" -gt 0 ] 2>/dev/null && kill "$MEDIA_PID" 2>/dev/null || true
  pkill -f media_service.py 2>/dev/null || true
  pkill -x "ollama" 2>/dev/null || true
  rm -f "$STATUS_FILE"
  step "Stopped. Goodbye."
  exit 0
}
trap cleanup SIGINT SIGTERM

# If Next.js exits on its own (e.g., via /api/shutdown), clean up
wait $NEXT_PID 2>/dev/null || true
cleanup
