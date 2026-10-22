#!/bin/sh
set -e
umask 0000

cd /workspace

ENTRY="${ENTRY_FILE:-}"
if [ -z "$ENTRY" ]; then
  ENTRY=$(ls *.java 2>/dev/null | head -n 1)
fi

if [ -z "$ENTRY" ] || [ ! -f "$ENTRY" ]; then
  echo "Error: No .java source file found in /workspace" >&2
  exit 1
fi

# Compile Java source (support multiple .java files if present)
if ! javac -d . *.java; then
  exit 42  # Compilation error status code
fi

# Determine the class containing public static void main
MAIN_CLASS=""

# First check if the class matching the ENTRY file has a main method
BASE_NAME=$(basename "$ENTRY" .java)
for cfile in $(find . -name "${BASE_NAME}.class"); do
  cname=$(echo "$cfile" | sed 's|^\./||; s|\.class$||; s|/|.|g')
  if javap -public "$cname" 2>/dev/null | grep -q 'public static void main(java\.lang\.String\[\])'; then
    MAIN_CLASS="$cname"
    break
  fi
done

# If not found in the primary entry class, inspect all compiled classes
if [ -z "$MAIN_CLASS" ]; then
  for cfile in $(find . -name "*.class" | sort); do
    cname=$(echo "$cfile" | sed 's|^\./||; s|\.class$||; s|/|.|g')
    if javap -public "$cname" 2>/dev/null | grep -q 'public static void main(java\.lang\.String\[\])'; then
      MAIN_CLASS="$cname"
      break
    fi
  done
fi

# If no class has main, fall back to class matching filename so JVM outputs standard "Main method not found" error
if [ -z "$MAIN_CLASS" ]; then
  MAIN_CLASS="$BASE_NAME"
fi

# Execute Java class with unbuffered/direct standard I/O
if [ -f input.txt ]; then
  exec java -XX:+UseSerialGC -Xmx192m "$MAIN_CLASS" < input.txt
else
  exec java -XX:+UseSerialGC -Xmx192m "$MAIN_CLASS"
fi
