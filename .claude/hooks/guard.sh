#!/usr/bin/env bash
# PreToolUse guard for Bash (from the mind "ahmed"). Blocks destructive commands.
# Exit 2 = block, and stderr is shown to Claude as feedback.
set -u
INPUT="$(cat)"
CMD="$(printf '%s' "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -n1)"
[ -n "$CMD" ] || exit 0

deny() { printf 'guard.sh blocked: %s\nReason: %s\nAsk the user to run it manually if it is intended.\n' "$CMD" "$1" >&2; exit 2; }

printf '%s' "$CMD" | grep -Eq 'rm -[a-zA-Z]*r[a-zA-Z]* +(/|~|\$HOME|\.|\*)([ ;&|]|$)' && deny "recursive delete of a root, home or current directory"
printf '%s' "$CMD" | grep -Eq 'git push[^|;&]*(--force|-f)[^|;&]*(main|master)' && deny "force push to a protected branch"
printf '%s' "$INPUT" | grep -Eiq 'drop (table|database|schema)' && deny "destructive SQL"
printf '%s' "$CMD" | grep -Eq 'git (reset --hard|clean -[a-z]*f)' && deny "history/worktree wipe (git reset --hard / git clean -f)"
printf '%s' "$CMD" | grep -Eq '(^|[;&| ])(mkfs|dd if=|shutdown|reboot)([ ;&|]|$)' && deny "system-level destructive command"
# Project-specific: never delete the raw DGAC downloads or the published site by hand.
printf '%s' "$CMD" | grep -Eq 'rm -[a-zA-Z]*r[a-zA-Z]* +[^;&|]*data/raw' && deny "deleting raw DGAC data (re-run etl/fetch.py instead)"
printf '%s' "$CMD" | grep -Eq 'git push[^|;&]*gh-pages' && deny "manual push to gh-pages (the workflow deploys)"
exit 0
