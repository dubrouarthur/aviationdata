#!/usr/bin/env bash
# PostToolUse formatter for Write|Edit (from the mind "ahmed"). No-op when no formatter fits.
set -u
INPUT="$(cat)"
FILE="$(printf '%s' "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
[ -n "$FILE" ] && [ -f "$FILE" ] || exit 0
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PRETTIER=""
if [ -x "$ROOT/web/node_modules/.bin/prettier" ]; then PRETTIER="$ROOT/web/node_modules/.bin/prettier"
elif command -v prettier >/dev/null 2>&1; then PRETTIER="prettier"; fi
case "$FILE" in
  */data/*|*/public/data/*|*/tests/fixtures/*) exit 0 ;;  # never reformat data files
  *.js|*.jsx|*.ts|*.tsx|*.json|*.css|*.scss|*.html|*.yaml|*.yml)
    [ -n "$PRETTIER" ] && "$PRETTIER" --log-level silent --write "$FILE" >/dev/null 2>&1 ;;
  *.py)
    if command -v ruff >/dev/null 2>&1; then ruff format -q "$FILE" >/dev/null 2>&1
    elif command -v black >/dev/null 2>&1; then black -q "$FILE" >/dev/null 2>&1; fi ;;
esac
exit 0
