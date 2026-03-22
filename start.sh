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

# ── 1. Homebrew (macOS only — needed for Node, Ollama, cloudflared) ───────────
if [ "$PLATFORM" = "macOS" ]; then
  if ! command -v brew &>/dev/null; then
    step "Homebrew not found — installing..."
    echo -e "${YELLOW}  You may be prompted for your password.${NC}"
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
      || error "Failed to install Homebrew. Install it manually from https://brew.sh then re-run this script."
    # Add brew to PATH for the rest of this session (Apple Silicon vs Intel paths differ)
    if [ -f /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -f /usr/local/bin/brew ]; then
      eval "$(/usr/local/bin/brew shellenv)"
    fi
    step "Homebrew installed"
  else
    step "Homebrew found ($(brew --version | head -1))"
    # Ensure brew is on PATH even if it was installed in a non-standard location
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

# ── 4. cloudflared (optional — enables remote report submissions) ─────────────
step "Checking cloudflared (optional — needed for remote report submissions)..."
if command -v cloudflared &>/dev/null; then
  step "cloudflared found"
else
  warn "cloudflared not found — will attempt to install..."
  CLOUDFLARED_OK=false
  case "$PLATFORM" in
    macOS)
      # Homebrew is already installed and on PATH by this point (step 1 above)
      brew install cloudflared && CLOUDFLARED_OK=true \
        || warn "brew install cloudflared failed — remote submissions unavailable."
      ;;
    Linux)
      ARCH="$(uname -m)"
      case "$ARCH" in
        x86_64)        CF_ARCH="amd64" ;;
        aarch64|arm64) CF_ARCH="arm64" ;;
        armv7l)        CF_ARCH="arm" ;;
        *)             CF_ARCH="amd64" ;;
      esac
      CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}"
      step "Downloading cloudflared binary (${CF_ARCH})..."
      if curl -fsSL "$CF_URL" -o /tmp/cloudflared-dl; then
        sudo install -m 0755 /tmp/cloudflared-dl /usr/local/bin/cloudflared \
          && CLOUDFLARED_OK=true \
          || warn "Could not install cloudflared — remote submissions unavailable."
        rm -f /tmp/cloudflared-dl
      else
        warn "Could not download cloudflared — remote submissions unavailable."
      fi
      ;;
    Windows)
      warn "On Windows, install cloudflared manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
      warn "Remote submissions will not be available until cloudflared is installed."
      ;;
    *)
      warn "Unknown platform — skipping cloudflared. Remote submissions unavailable."
      ;;
  esac
  if [ "$CLOUDFLARED_OK" = true ]; then
    step "cloudflared installed"
  fi
fi

# ── 5. Environment file ───────────────────────────────────────────────────────
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
XAI_API_KEY=""
PERPLEXITY_API_KEY=""
EOF
  step ".env.local created"
else
  step ".env.local already exists"
fi

# ── 6. Dependencies ───────────────────────────────────────────────────────────
if [ ! -d "node_modules" ]; then
  step "Installing dependencies (first run)..."
  npm install --loglevel=error
else
  step "Dependencies already installed"
fi

# ── 7. Database ───────────────────────────────────────────────────────────────
step "Setting up database..."
npx prisma migrate deploy 2>/dev/null || true
npx prisma generate 2>/dev/null || true
step "Database ready"

# ── 8. Ollama server ──────────────────────────────────────────────────────────
if pgrep -x "ollama" &>/dev/null; then
  step "Ollama already running"
else
  step "Starting Ollama server..."
  ollama serve >/tmp/ollama.log 2>&1 &
  sleep 2
  pgrep -x "ollama" &>/dev/null || error "Ollama failed to start. Check /tmp/ollama.log"
  step "Ollama server started"
fi

# ── 9. Model ──────────────────────────────────────────────────────────────────
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

if ollama list 2>/dev/null | grep -q "^${MODEL}"; then
  step "Model already available"
else
  step "Pulling $MODEL — this may take a few minutes on first run..."
  ollama pull "$MODEL" || error "Failed to pull model $MODEL"
  step "Model $MODEL ready"
fi

# ── 10. Start Next.js ────────────────────────────────────────────────────────
step "Starting Operator server..."
npm run dev -- --port $PORT > "$LOG_FILE" 2>&1 &
NEXT_PID=$!
echo $NEXT_PID > "$PID_FILE"

# ── 11. Wait for server to be ready ──────────────────────────────────────────
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

# ── 12. Open browser ─────────────────────────────────────────────────────────
step "Opening Operator in your browser..."
open_browser "http://localhost:$PORT"

bold "\nOperator is running at http://localhost:${PORT}"
echo -e "Press ${BOLD}Ctrl+C${NC} to stop, or use the power button in the app.\n"

# ── 13. Shutdown handler ─────────────────────────────────────────────────────
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
