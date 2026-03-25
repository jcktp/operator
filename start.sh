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
fi
step "Ollama found"

# ── 4. cloudflared (optional — installed in background, non-blocking) ─────────
install_cloudflared_bg() {
  case "$PLATFORM" in
    macOS)
      brew install cloudflared >/dev/null 2>&1 || true ;;
    Linux)
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
else
  warn "cloudflared not found — installing in background..."
  install_cloudflared_bg &
fi

# ── 5. Environment file ───────────────────────────────────────────────────────
if [ ! -f ".env.local" ]; then
  step "Creating .env.local (first run)..."
  cat > .env.local <<EOF
DATABASE_URL="file:$(pwd)/prisma/dev.db"

# Optional: set API keys here as an alternative to the Settings page in the app.
# Keys entered in Settings are stored in the local database and take precedence.
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""
GOOGLE_API_KEY=""
GROQ_API_KEY=""
XAI_API_KEY=""
PERPLEXITY_API_KEY=""
EOF
  step ".env.local created"
else
  step ".env.local already exists"
fi

# ── 6. Dependencies ───────────────────────────────────────────────────────────
if [ ! -d "node_modules" ]; then
  step "Installing dependencies (first run — this takes a minute)..."
  npm install --loglevel=error
else
  step "Dependencies already installed"
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
  DEFAULT_MODEL="llama3.2:3b"
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
