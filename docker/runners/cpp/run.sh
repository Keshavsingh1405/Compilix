#!/bin/sh
set -e
umask 0000

cd /workspace

ENTRY="${ENTRY_FILE:-}"
if [ -z "$ENTRY" ]; then
  ENTRY=$(ls *.cpp *.cc *.cxx 2>/dev/null | head -n 1)
fi

if [ -z "$ENTRY" ] || [ ! -f "$ENTRY" ]; then
  echo "Error: No C++ source file found in /workspace" >&2
  exit 1
fi

# Compile C++ source (supporting ENTRY or all cpp files if multiple)
CPP_COUNT=$(ls *.cpp *.cc *.cxx 2>/dev/null | wc -l)
if [ "$CPP_COUNT" -gt 1 ]; then
  COMPILE_CMD="g++ -O2 -std=c++17 -Wall -Wextra *.cpp -o main"
else
  COMPILE_CMD="g++ -O2 -std=c++17 -Wall -Wextra \"$ENTRY\" -o main"
fi

if ! eval "$COMPILE_CMD"; then
  exit 42  # Specific status code for compilation failure
fi

# Execute compiled binary with standard input
if [ -f input.txt ]; then
  exec ./main < input.txt
else
  exec ./main
fi
