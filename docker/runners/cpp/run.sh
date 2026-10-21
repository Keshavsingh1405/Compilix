#!/bin/sh
set -e

cd /workspace

if [ ! -f main.cpp ]; then
  echo "Error: main.cpp not found" >&2
  exit 1
fi

# Compile C++ source
# Redirect compiler output to compiler_output.txt or directly to stderr
if ! g++ -O2 -std=c++17 -Wall -Wextra main.cpp -o main; then
  exit 42  # Specific status code for compilation failure
fi

# Execute compiled binary with standard input
if [ -f input.txt ]; then
  ./main < input.txt
else
  ./main
fi
