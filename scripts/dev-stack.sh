#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BACKEND_PID=""
FRONTEND_PID=""
ML_PID=""

cleanup() {
  for pid in "$BACKEND_PID" "$FRONTEND_PID" "$ML_PID"; do
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
    fi
  done
}

trap cleanup EXIT INT TERM

echo "Starting EldiMind backend on http://localhost:4000"
(
  cd "$ROOT_DIR"
  npm run dev
) &
BACKEND_PID=$!

echo "Starting EldiMind frontend on http://localhost:5173"
(
  cd "$ROOT_DIR/frontend"
  npm run dev -- --host 0.0.0.0
) &
FRONTEND_PID=$!

echo "Starting EldiMind ML service on http://localhost:8000"
(
  cd "$ROOT_DIR/ml_service"
  if command -v uvicorn >/dev/null 2>&1; then
    uvicorn app:app --reload --host 0.0.0.0 --port 8000
  elif command -v python3 >/dev/null 2>&1; then
    python3 -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
  else
    echo "Could not find uvicorn or python3 for the ML service." >&2
    exit 1
  fi
) &
ML_PID=$!

echo
echo "EldiMind dev stack is starting."
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:4000"
echo "ML API:   http://localhost:8000"
echo
echo "MongoDB is not started locally because MONGODB_URI points to MongoDB Atlas."
echo "Press Ctrl+C to stop all services."

wait
