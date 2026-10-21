#!/bin/sh
set -e

cd /workspace

if [ ! -f main.js ]; then
  echo "Error: main.js not found" >&2
  exit 1
fi

# Execute JavaScript with Node.js
if [ -f input.txt ]; then
  node main.js < input.txt
else
  node main.js
fi
