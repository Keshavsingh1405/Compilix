#!/bin/sh
set -e

cd /workspace

if [ ! -f main.py ]; then
  echo "Error: main.py not found" >&2
  exit 1
fi

# Execute Python script with unbuffered standard I/O
if [ -f input.txt ]; then
  python3 -u main.py < input.txt
else
  python3 -u main.py
fi
