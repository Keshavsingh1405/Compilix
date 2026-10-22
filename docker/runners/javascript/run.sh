#!/bin/sh
set -e

cd /workspace

ENTRY="${ENTRY_FILE:-}"
if [ -z "$ENTRY" ]; then
  ENTRY=$(ls *.js *.mjs 2>/dev/null | head -n 1)
fi

if [ -z "$ENTRY" ] || [ ! -f "$ENTRY" ]; then
  echo "Error: No JavaScript source file found in /workspace" >&2
  exit 1
fi

# Execute JavaScript with Node.js
if [ -f input.txt ]; then
  exec node "$ENTRY" < input.txt
else
  exec node "$ENTRY"
fi
