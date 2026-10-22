#!/bin/sh
set -e

cd /workspace

ENTRY="${ENTRY_FILE:-}"
if [ -z "$ENTRY" ]; then
  ENTRY=$(ls *.py 2>/dev/null | head -n 1)
fi

if [ -z "$ENTRY" ] || [ ! -f "$ENTRY" ]; then
  echo "Error: No Python source file found in /workspace" >&2
  exit 1
fi

# Execute Python script with unbuffered standard I/O
if [ -f input.txt ]; then
  exec python3 -u "$ENTRY" < input.txt
else
  exec python3 -u "$ENTRY"
fi
