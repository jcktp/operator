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

# ── no-admin support ──────────────────────────────────────────────────────────
# User-space bin dir — on PATH so binaries installed here are found immediately
HOME_BIN="$HOME/.local/bin"
mkdir -p "$HOME_BIN"
export PATH="$HOME_BIN:$PATH"

# Also pick up Python user-scheme scripts (pip3 install --user on macOS puts
# binaries in ~/Library/Python/X.Y/bin rather than ~/.local/bin)
if [ "$PLATFORM" = "macOS" ] && command -v python3 &>/dev/null; then
  PY_USER_BIN="$(python3 -c 'import sysconfig; print(sysconfig.get_path("scripts", "posix_user"))' 2>/dev/null || true)"
  [ -n "$PY_USER_BIN" ] && export PATH="$PY_USER_BIN:$PATH"
fi

# Returns 0 if the current user can gain admin/root privileges
has_admin() {
  case "$PLATFORM" in
    macOS)  groups 2>/dev/null | grep -qw admin ;;
    Linux)  sudo -n true 2>/dev/null || groups 2>/dev/null | grep -qE '\b(sudo|wheel|admin)\b' ;;
    *)      return 1 ;;
  esac
}

# Install nvm (no admin required) and source it into the current shell
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
ensure_nvm() {
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    return 0
  fi
  step "Installing nvm (no-admin Node.js version manager)..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash >/dev/null 2>&1 || return 1
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
}

open_browser() {
  case "$PLATFORM" in
    macOS)   open "$1" ;;
    Linux)   xdg-open "$1" 2>/dev/null || true ;;
    Windows) start "$1" 2>/dev/null || true ;;
  esac
}

set_status() {
  local step_msg="$1"
  local detail_msg="${2:-}"
  printf '{"step":"%s","detail":"%s","ready":false}' "$step_msg" "$detail_msg" > "$STATUS_FILE"
}

set_ready() {
  printf '{"step":"Ready","detail":"","ready":true}' > "$STATUS_FILE"
}

rm -f "$STATUS_FILE"

bold "\nOperator — starting up in production mode (${PLATFORM})\n"

# ── 1. Homebrew (macOS only) ──────────────────────────────────────────────────
if [ "$PLATFORM" = "macOS" ]; then
  if ! command -v brew &>/dev/null; then
    if has_admin; then
      step "Homebrew not found — installing..."
      echo -e "${YELLOW}  You may be prompted for your password.${NC}"
      NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
        || warn "Homebrew install failed — will use no-admin fallbacks for each tool."
      if [ -f /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
      elif [ -f /usr/local/bin/brew ]; then
        eval "$(/usr/local/bin/brew shellenv)"
      fi
      command -v brew &>/dev/null && step "Homebrew installed"
    else
      warn "No admin access and Homebrew is not installed — using no-admin install paths for each tool."
    fi
  else
    step "Homebrew found ($(brew --version | head -1))"
    if [ -f /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
  fi
fi

# ── 2. Node.js ────────────────────────────────────────────────────────────────
# Source nvm if present (makes node available even if not on system PATH yet)
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

step "Checking Node.js..."
if ! command -v node &>/dev/null; then
  warn "Node.js not found — installing..."
  case "$PLATFORM" in
    macOS)
      if has_admin && command -v brew &>/dev/null; then
        brew install node || error "Failed to install Node.js via Homebrew"
      else
        warn "No admin access — installing Node.js via nvm (no password required)..."
        ensure_nvm || error "Could not install nvm. Install Node.js manually: https://nodejs.org"
        nvm install --lts >/dev/null 2>&1 || error "nvm could not install Node.js LTS"
        step "Node.js installed via nvm"
      fi
      ;;
    Linux)
      if has_admin; then
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
      else
        warn "No sudo access — installing Node.js via nvm (no password required)..."
        ensure_nvm || error "Could not install nvm. Install Node.js manually: https://nodejs.org"
        nvm install --lts >/dev/null 2>&1 || error "nvm could not install Node.js LTS"
        step "Node.js installed via nvm"
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

# ── 3. Ollama — install or update ─────────────────────────────────────────────
step "Checking Ollama..."
if ! command -v ollama &>/dev/null; then
  warn "Ollama not found — installing..."
  case "$PLATFORM" in
    macOS)
      if has_admin && command -v brew &>/dev/null; then
        brew install ollama || error "Failed to install Ollama via Homebrew"
      else
        warn "No admin access — downloading Ollama binary to $HOME_BIN (no password required)..."
        ARCH="$(uname -m)"
        case "$ARCH" in arm64|aarch64) OLLAMA_BIN="ollama-darwin-arm64" ;; *) OLLAMA_BIN="ollama-darwin-amd64" ;; esac
        curl -fsSL "https://github.com/ollama/ollama/releases/latest/download/${OLLAMA_BIN}" \
          -o "$HOME_BIN/ollama" \
          && chmod +x "$HOME_BIN/ollama" \
          || error "Failed to download Ollama. Visit https://ollama.com/download"
        step "Ollama installed to $HOME_BIN/ollama"
      fi
      ;;
    Linux)
      if has_admin; then
        curl -fsSL https://ollama.com/install.sh | sh || error "Failed to install Ollama. Visit https://ollama.com"
      else
        warn "No sudo access — downloading Ollama binary to $HOME_BIN (no password required)..."
        ARCH="$(uname -m)"
        case "$ARCH" in aarch64|arm64) OLLAMA_BIN="ollama-linux-arm64" ;; *) OLLAMA_BIN="ollama-linux-amd64" ;; esac
        curl -fsSL "https://github.com/ollama/ollama/releases/latest/download/${OLLAMA_BIN}" \
          -o "$HOME_BIN/ollama" \
          && chmod +x "$HOME_BIN/ollama" \
          || error "Failed to download Ollama. Visit https://ollama.com/download"
        step "Ollama installed to $HOME_BIN/ollama"
      fi
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
      # Detect whether Ollama was installed via brew cask (desktop app) or formula (CLI only)
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
      # The install script doubles as an updater
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
      if has_admin && command -v brew &>/dev/null; then
        brew install tesseract || warn "Could not install Tesseract — image text extraction will fall back to vision model"
      else
        warn "No admin access — skipping Tesseract install. Image text extraction will fall back to vision model."
      fi
      ;;
    Linux)
      if has_admin; then
        if command -v apt-get &>/dev/null; then
          sudo apt-get install -y tesseract-ocr >/dev/null 2>&1 || warn "Could not install Tesseract"
        elif command -v dnf &>/dev/null; then
          sudo dnf install -y tesseract >/dev/null 2>&1 || warn "Could not install Tesseract"
        elif command -v pacman &>/dev/null; then
          sudo pacman -Sy --noconfirm tesseract tesseract-data-eng >/dev/null 2>&1 || warn "Could not install Tesseract"
        else
          warn "Tesseract not available — image text extraction will fall back to vision model"
        fi
      else
        warn "No sudo access — skipping Tesseract install. Image text extraction will fall back to vision model."
      fi
      ;;
    *)
      warn "Tesseract not available on this platform — image text extraction will fall back to vision model"
      ;;
  esac
else
  step "Tesseract OCR found"
fi

# ── 3c. MAT2 (metadata stripping for journalism mode) ────────────────────────
if ! command -v mat2 &>/dev/null; then
  step "MAT2 not found — installing..."
  case "$PLATFORM" in
    macOS)
      # Prefer Homebrew — pip3 install on macOS 15+ fails with externally-managed-environment
      if has_admin && command -v brew &>/dev/null; then
        brew install mat2 >/dev/null 2>&1 \
          && step "MAT2 installed" \
          || warn "Could not install MAT2 — File Cleaner will use ExifTool only"
      else
        warn "No admin access — skipping MAT2 (File Cleaner will use ExifTool only)"
      fi
      ;;
    Linux)
      if has_admin; then
        if command -v apt-get &>/dev/null; then
          sudo apt-get install -y mat2 >/dev/null 2>&1 \
            || pip3 install mat2 --quiet 2>/dev/null \
            || warn "Could not install MAT2"
        elif command -v dnf &>/dev/null; then
          sudo dnf install -y mat2 >/dev/null 2>&1 \
            || pip3 install mat2 --quiet 2>/dev/null \
            || warn "Could not install MAT2"
        elif command -v pacman &>/dev/null; then
          sudo pacman -Sy --noconfirm python-mat2 >/dev/null 2>&1 \
            || warn "Could not install MAT2"
        else
          warn "Could not install MAT2 — unknown Linux package manager"
        fi
      else
        # Fall back to user-space pip install
        if command -v pip3 &>/dev/null; then
          pip3 install mat2 --user --quiet 2>/dev/null \
            || warn "Could not install MAT2 — File Cleaner will use ExifTool only"
        else
          warn "No sudo access and pip3 not found — skipping MAT2 (File Cleaner will use ExifTool only)"
        fi
      fi
      ;;
    *)
      warn "MAT2 not available on this platform — File Cleaner will use ExifTool only"
      ;;
  esac
else
  step "MAT2 found"
fi

# ── 4. cloudflared + supporting tools (updated in background, non-blocking) ────
# Note: Ollama is already upgraded synchronously in step 3 — not repeated here.
update_tools_bg() {
  case "$PLATFORM" in
    macOS)
      command -v brew &>/dev/null && brew upgrade cloudflared tesseract >/dev/null 2>&1 || true ;;
    Linux)
      # Update cloudflared binary — install to system path if admin, else user bin
      ARCH="$(uname -m)"
      case "$ARCH" in x86_64) CF_ARCH="amd64" ;; aarch64|arm64) CF_ARCH="arm64" ;; *) CF_ARCH="amd64" ;; esac
      CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}"
      curl -fsSL "$CF_URL" -o /tmp/cloudflared-dl 2>/dev/null || return
      if has_admin; then
        sudo install -m 0755 /tmp/cloudflared-dl /usr/local/bin/cloudflared 2>/dev/null || true
      else
        install -m 0755 /tmp/cloudflared-dl "$HOME_BIN/cloudflared" 2>/dev/null || true
      fi
      rm -f /tmp/cloudflared-dl ;;
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

# ── 9. Build ──────────────────────────────────────────────────────────────────
set_status "Building…"
step "Building Operator (production)..."
npm run build || error "Build failed. Check the output above for errors."
step "Build complete"

# ── 10. Start Next.js (production mode) ───────────────────────────────────────
set_status "Starting server…"
step "Starting Operator server..."
npm start -- --port $PORT > "$LOG_FILE" 2>&1 &
NEXT_PID=$!
echo $NEXT_PID > "$PID_FILE"

# ── 11. Wait for server, then open browser ────────────────────────────────────
step "Waiting for server to be ready..."
ATTEMPTS=0
MAX=60
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

step "Opening Operator in your browser..."
open_browser "http://localhost:$PORT/starting"

# ── 12. Ollama server ─────────────────────────────────────────────────────────
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

# ── 13. Model (only when Ollama is the active AI provider) ───────────────────
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

# ── 14. All done ──────────────────────────────────────────────────────────────
set_ready
step "Ready!"

bold "\nOperator is running at http://localhost:${PORT}"
echo -e "Press ${BOLD}Ctrl+C${NC} to stop, or use the power button in the app.\n"

# ── 15. Shutdown handler ─────────────────────────────────────────────────────
cleanup() {
  echo ""
  step "Shutting down..."
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
  pkill -x "ollama" 2>/dev/null || true
  rm -f "$STATUS_FILE"
  step "Stopped. Goodbye."
  exit 0
}
trap cleanup SIGINT SIGTERM

wait $NEXT_PID 2>/dev/null || true
cleanup
