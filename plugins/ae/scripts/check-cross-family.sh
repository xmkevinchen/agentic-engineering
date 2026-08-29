#!/bin/bash
# Check cross-family availability at session start.
#
# Registered via plugin.json `hooks.SessionStart`. BL-023 closure empirically verified
# 2026-05-20 (T1 ship: plugin.json hooks block auto-registers and fires on SessionStart).
# See `docs/references/cc-plugin-contract.md` BL-023 closure evidence.
#
# It is driven by the `cross_family` table and by each seat's own declared probe, so adding a
# family — or a whole new seat — does not edit this file. The previous version carried one
# hardcoded block per transport (a Node check, a binary check, a bundle-and-key check), which
# is the concrete extension cost F-082 set out to remove: the fourth family would have meant a
# fourth block here.
#
# A seat declares its probe in its own frontmatter:
#     probe: command -v codex >/dev/null 2>&1
#     probe: '[ -n "${GEMINI_API_KEY:-}" ] && [ -f "$AE_PLUGIN_ROOT/…" ]'
# The probe runs with AE_ENDPOINT / AE_MODEL / AE_FAMILY set from the entry, and
# AE_PLUGIN_ROOT pointing at the plugin. It is repo-controlled text executed by a
# repo-controlled hook — the same trust level as the rest of this script.
#
# The second form exists because a shell-shaped value starting with `[` is a flow sequence to
# YAML, so the whole frontmatter block failed to parse and the host dropped every field. The
# fix is to quote the scalar — but this file reads the line with `sed`, not a YAML parser, so
# the value arrives with its quote bytes still attached and `bash -c` would run the entire
# scalar as one command name. Hence `decode_probe`.
#
# Never fatal: this reports to stderr and exits 0. A session must start even with no backend.

set -u

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
AE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SELF_DIR/.." && pwd)}"
AGENTS="$AE_PLUGIN_ROOT/agents/workflow"

# The table belongs to the PROJECT, the script belongs to the PLUGIN, and on an installed path
# those are different trees. Deriving the project from this file's own location finds
# `<plugin-cache>/.claude/pipeline.yml`, which never exists — so every installed user would be
# told their families were not checked. A SessionStart hook runs with the project as its
# working directory.
PIPELINE=""
for cand in "${AE_PIPELINE:-}" ".claude/pipeline.yml" "$SELF_DIR/../../../.claude/pipeline.yml"; do
  [ -n "$cand" ] && [ -f "$cand" ] && { PIPELINE="$cand"; break; }
done
READER="$SELF_DIR/read-family-table.py"
export AE_PLUGIN_ROOT

ISSUES=()

# Turn the raw bytes after `probe:` into the command the seat meant.
#
# Exactly two forms are decoded, because exactly two are written: the legacy plain scalar,
# used as-is, and the YAML single-quoted scalar, where the surrounding quotes are stripped and
# a doubled `''` is one literal quote. No `eval` — the text is handed to `bash -c` by the
# caller and nothing here re-parses it.
#
# An unterminated quote, or any material after the closing one, is REJECTED rather than
# repaired. The alternative is guessing what the author meant about a string that is about to
# be executed, and a wrong guess runs the leftover bytes. The caller reports the rejection as
# unknown availability, which is the same fail-closed answer it gives a seat with no probe.
decode_probe() { # $1 = raw text after `probe:`; prints the command, or returns non-zero
  local raw=$1 rest chunk out trailing
  case $raw in
    "'"*) ;;
    *) printf '%s' "$raw"; return 0 ;;
  esac
  rest=${raw#\'}
  out=''
  while :; do
    case $rest in
      *"'"*) ;;
      *) return 1 ;;                       # ran out of line with the scalar still open
    esac
    chunk=${rest%%\'*}
    out=$out$chunk
    rest=${rest#"$chunk"\'}
    case $rest in
      "'"*) out=$out\'; rest=${rest#\'} ;; # '' is one literal quote, scalar continues
      *) break ;;                          # this was the closing quote
    esac
  done
  trailing=$(printf '%s' "${rest%%#*}" | tr -d ' \t')
  [ -z "$trailing" ] || return 1           # only spaces or a YAML comment may follow
  printf '%s' "$out"
}

# A probe is author-supplied text, so its own timeout is author-supplied too — and a probe that
# forgets one blocks SessionStart with nothing to stop it. `timeout(1)` is not present on a
# stock macOS, so the ceiling is enforced here with a watchdog rather than assumed.
PROBE_LIMIT_S="${AE_PROBE_TIMEOUT_S:-8}"
run_probe() { # $1 = probe string; returns probe's status, or 124 if it hit the ceiling
  bash -c "$1" >/dev/null 2>&1 &
  local pid=$! rc=0
  ( sleep "$PROBE_LIMIT_S"; kill -TERM "$pid" 2>/dev/null ) >/dev/null 2>&1 &
  local wd=$!
  wait "$pid" 2>/dev/null || rc=$?
  if kill -0 "$wd" 2>/dev/null; then kill -TERM "$wd" 2>/dev/null; else rc=124; fi
  wait "$wd" 2>/dev/null
  return "$rc"
}

# Agent Teams flag — not family-specific, so it stays here.
SETTINGS_FILE="$HOME/.claude/settings.json"
AGENT_TEAMS=false
if [ -f "$SETTINGS_FILE" ]; then
  if command -v jq &>/dev/null; then
    [ -n "$(jq -r '.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS // empty' "$SETTINGS_FILE" 2>/dev/null)" ] && AGENT_TEAMS=true
  elif grep -q 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS' "$SETTINGS_FILE" 2>/dev/null; then
    AGENT_TEAMS=true
  fi
fi
[ "$AGENT_TEAMS" = false ] && ISSUES+=("Agent Teams not enabled — most ae commands require it. Add to ~/.claude/settings.json: { \"env\": { \"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\" } }")

if [ -n "$PIPELINE" ] && [ -f "$READER" ] && command -v python3 &>/dev/null; then
  entries="$(python3 "$READER" "$PIPELINE" --enabled-only 2>/dev/null)"
  while IFS= read -r e; do
    [ -n "$e" ] || continue
    eval "$(printf '%s' "$e" | python3 -c '
import json,sys,shlex
d=json.load(sys.stdin)
for k in ("label","seat","family","endpoint","model"):
    print("entry_%s=%s" % (k, shlex.quote(str(d.get(k,"")))))
')"
    def="$AGENTS/${entry_seat}-proxy.md"
    if [ ! -f "$def" ]; then
      ISSUES+=("$entry_label: no seat definition at $(basename "$def") — entry names a seat nothing implements")
      continue
    fi
    probe="$(sed -n '/^probe:[[:space:]]*/{s/^probe:[[:space:]]*//p;q;}' "$def")"
    if [ -z "$probe" ]; then
      ISSUES+=("$entry_label: seat '$entry_seat' declares no probe: line — its availability is unknown, which reads identically to available")
      continue
    fi
    if ! command="$(decode_probe "$probe")" || [ -z "$command" ]; then
      ISSUES+=("$entry_label: seat '$entry_seat' has a probe: scalar this cannot read — an unterminated quote, or text after the closing quote. It is not guessed at, because the guess would be executed; availability is unknown")
      continue
    fi
    export AE_ENDPOINT="$entry_endpoint" AE_MODEL="$entry_model" AE_FAMILY="$entry_family"
    if run_probe "$command"; then :; else
      rc=$?
      if [ "$rc" -eq 124 ]; then
        ISSUES+=("$entry_label ($entry_family via $entry_seat): probe exceeded ${PROBE_LIMIT_S}s and was killed — a probe must bound its own wait; SessionStart cannot block on a backend")
      else
        ISSUES+=("$entry_label ($entry_family via $entry_seat): probe failed${entry_endpoint:+ — $entry_endpoint} — this family will report unavailable")
      fi
    fi
    unset AE_ENDPOINT AE_MODEL AE_FAMILY
  done <<EOF
$entries
EOF
else
  ISSUES+=("cross_family table not found — looked for .claude/pipeline.yml relative to the working directory; no family availability was checked")
fi

if [ ${#ISSUES[@]} -gt 0 ]; then
  for issue in "${ISSUES[@]}"; do echo "[ae] WARNING: $issue" >&2; done
fi

exit 0
