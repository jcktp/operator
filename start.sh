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

bold "\nOperator — starting up\n"

# ── 1. Node.js ────────────────────────────────────────────────────────────────
step "Checking Node.js..."
command -v node &>/dev/null || error "Node.js not found. Install it from https://nodejs.org"
step "Node $(node --version)"

# ── 2. Ollama ─────────────────────────────────────────────────────────────────
step "Checking Ollama..."
command -v ollama &>/dev/null || error "Ollama not found. Install it from https://ollama.com"
step "Ollama found"

# ── 3. Dependencies ───────────────────────────────────────────────────────────
if [ ! -d "node_modules" ]; then
  step "Installing dependencies (first run)..."
  npm install --silent
else
  step "Dependencies already installed"
fi

# ── 4. Database ───────────────────────────────────────────────────────────────
step "Setting up database..."
npx prisma migrate deploy 2>/dev/null || true
npx prisma generate 2>/dev/null || true
step "Database ready"

# ── 5. Ollama server ──────────────────────────────────────────────────────────
if pgrep -x "ollama" &>/dev/null; then
  step "Ollama already running"
else
  step "Starting Ollama server..."
  ollama serve &>/tmp/ollama.log 2>&1 &
  sleep 2
  pgrep -x "ollama" &>/dev/null || error "Ollama failed to start. Check /tmp/ollama.log"
  step "Ollama server started"
fi

# ── 6. Model ──────────────────────────────────────────────────────────────────
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

# ── 7. Start Next.js ─────────────────────────────────────────────────────────
step "Starting Operator server..."
npm run dev -- --port $PORT > "$LOG_FILE" 2>&1 &
NEXT_PID=$!
echo $NEXT_PID > "$PID_FILE"

# ── 8. Wait for server to be ready ───────────────────────────────────────────
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

# ── 9. Open browser ───────────────────────────────────────────────────────────
step "Opening Operator in your browser..."
open "http://localhost:$PORT"

bold "\nOperator is running at http://localhost:${PORT}"
echo -e "Press ${BOLD}Ctrl+C${NC} to stop, or use the power button in the app.\n"

# ── 10. Shutdown handler ─────────────────────────────────────────────────────
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
