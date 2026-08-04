#!/usr/bin/env bash
# Launch the voice bridge. Needs GEMINI_API_KEY exported (or saved in .env here).
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a; source .env; set +a
fi

if [ -z "$GEMINI_API_KEY" ]; then
  echo "No GEMINI_API_KEY set. Get a free key at https://aistudio.google.com,"
  echo "then either:  export GEMINI_API_KEY=...   or put GEMINI_API_KEY=... in voice-bridge/.env"
  exit 1
fi

export PATH="/usr/bin:$PATH"   # system node for openclaw calls
exec node bridge.js
