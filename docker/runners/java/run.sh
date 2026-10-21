#!/bin/sh
set -e

cd /workspace

if [ ! -f Main.java ]; then
  echo "Error: Main.java not found" >&2
  exit 1
fi

# Compile Java source
if ! javac Main.java; then
  exit 42  # Compilation error status code
fi

# Execute Java class
if [ -f input.txt ]; then
  java -XX:+UseSerialGC -Xmx192m Main < input.txt
else
  java -XX:+UseSerialGC -Xmx192m Main
fi
