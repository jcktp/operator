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

bold "\nOperator — starting up (${PLATFORM})\n"

# ── 1. Node.js ────────────────────────────────────────────────────────────────
step "Checking Node.js..."
if ! command -v node &>/dev/null; then
  warn "Node.js not found — attempting install..."
  case "$PLATFORM" in
    macOS)
      if command -v brew &>/dev/null; then
        brew install node || error "Failed to install Node.js via Homebrew"
      else
        error "Node.js not found. Install from https://nodejs.org or install Homebrew (https://brew.sh) first."
      fi
      ;;
    Linux)
      if command -v apt-get &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs \
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

# ── 2. Ollama ─────────────────────────────────────────────────────────────────
step "Checking Ollama..."
if ! command -v ollama &>/dev/null; then
  warn "Ollama not found — installing..."
  case "$PLATFORM" in
    macOS)
      if command -v brew &>/dev/null; then
        brew install ollama || error "Failed to install Ollama via Homebrew"
      else
        curl -fsSL https://ollama.com/install.sh | sh || error "Failed to install Ollama. Visit https://ollama.com"
      fi
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

# ── 3. Environment file ───────────────────────────────────────────────────────
if [ ! -f ".env.local" ]; then
  step "Creating .env.local (first run)..."
  cat > .env.local <<'EOF'
DATABASE_URL="file:./prisma/dev.db"

# Optional: set API keys here as an alternative to the Settings page in the app.
# Keys entered in Settings are stored in the local database and take precedence.
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""
GOOGLE_API_KEY=""
GROQ_API_KEY=""
EOF
  step ".env.local created"
else
  step ".env.local already exists"
fi

# ── 4. Dependencies ───────────────────────────────────────────────────────────
if [ ! -d "node_modules" ]; then
  step "Installing dependencies (first run)..."
  npm install --loglevel=error
else
  step "Dependencies already installed"
fi

# ── 5. Database ────────────────────────────────────────────────────────────────
step "Setting up database..."
npx prisma migrate deploy 2>/dev/null || true
npx prisma generate 2>/dev/null || true
step "Database ready"

# ── 6. Ollama server ──────────────────────────────────────────────────────────
if pgrep -x "ollama" &>/dev/null; then
  step "Ollama already running"
else
  step "Starting Ollama server..."
  ollama serve >/tmp/ollama.log 2>&1 &
  sleep 2
  pgrep -x "ollama" &>/dev/null || error "Ollama failed to start. Check /tmp/ollama.log"
  step "Ollama server started"
fi

# ── 7. Model ──────────────────────────────────────────────────────────────────
# Read saved model from database (falls back to default)
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

# Check if the model is already pulled
if ollama list 2>/dev/null | grep -q "^${MODEL}"; then
  step "Model already available"
else
  step "Pulling $MODEL — this may take a few minutes on first run..."
  ollama pull "$MODEL" || error "Failed to pull model $MODEL"
  step "Model $MODEL ready"
fi

# ── 8. Start Next.js ─────────────────────────────────────────────────────────
step "Starting Operator server..."
npm run dev -- --port $PORT > "$LOG_FILE" 2>&1 &
NEXT_PID=$!
echo $NEXT_PID > "$PID_FILE"

# ── 9. Wait for server to be ready ───────────────────────────────────────────
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

# ── 10. Open browser ──────────────────────────────────────────────────────────
step "Opening Operator in your browser..."
open_browser "http://localhost:$PORT"

bold "\nOperator is running at http://localhost:${PORT}"
echo -e "Press ${BOLD}Ctrl+C${NC} to stop, or use the power button in the app.\n"

# ── 11. Shutdown handler ─────────────────────────────────────────────────────
cleanup() {
  echo ""
  step "Shutting down..."
  [ -f "$PID_FILE" ] && kill "$(cat $PID_FILE)" 2>/dev/null; rm -f "$PID_FILE"
  pkill -x "ollama" 2>/dev/null || true
  step "Stopped. Goodbye."
  exit 0
}
trap cleanup SIGINT SIGTERM

# If Next.js exits on its own (e.g., via /api/shutdown), clean up
wait $NEXT_PID 2>/dev/null || true
cleanup
