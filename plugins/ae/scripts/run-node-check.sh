#!/bin/sh
# run-node-check.sh — F-051 hardened per-node check runner (floor-3 parameterized template).
#
# An LLM instantiates a per-node check in a plan as DATA: `node_check: <template-id> k=v ...`
# (the LLM supplies structured params ONLY — never shell). This runner validates the
# template + params against check-templates.catalog and executes a HUMAN-AUTHORED predicate.
# The catalog grows (new entry); the authority surface does NOT (no new code path = the
# floor-(3)/(4) boundary). Mirrors verify-contract.sh: the LLM fills a shape, not the engine.
#
# Usage:
#   run-node-check.sh run      <template-id> [key=value ...]   # real check against the target
#   run-node-check.sh redcheck <template-id> [key=value ...]   # red-before-green: prove the
#       predicate BITES by running the matcher against a harness-synthesized NON-satisfying
#       input (the must-fail input is harness-generated — the LLM never authors it).
# Exit: 0 = pass / bites | 1 = fail / theater (passed on bad input) | 2 = usage/validation/IO.
#
# v1 constraint: param VALUES are whitespace-free tokens (paths, jq paths, fixed strings).
set -u

HERE=$(dirname "$0")
CATALOG="$HERE/check-templates.catalog"

usage() { echo "usage: run-node-check.sh <run|redcheck> <template-id> [key=value ...]" >&2; exit 2; }

[ $# -ge 2 ] || usage
MODE=$1; TEMPLATE=$2; shift 2
case "$MODE" in run|redcheck) ;; *) usage ;; esac
[ -f "$CATALOG" ] || { echo "catalog not found: $CATALOG" >&2; exit 2; }

# Template must exist in the catalog (data lines only — skip # comment / # allow: lines).
cat_line=$(grep -vE '^[[:space:]]*#' "$CATALOG" | grep -E "^[[:space:]]*$TEMPLATE[[:space:]]*\|" | head -1)
[ -n "$cat_line" ] || { echo "unknown template: $TEMPLATE" >&2; exit 2; }
required=$(printf '%s' "$cat_line" | awk -F'|' '{print $2}' | tr -d '[:space:]')

# Collect params as newline-delimited key=value; getp fetches by key.
PARAMS=""
for kv in "$@"; do
  case "$kv" in *=*) ;; *) echo "bad param (need key=value): $kv" >&2; exit 2 ;; esac
  PARAMS="$PARAMS$kv
"
done
getp() { printf '%s' "$PARAMS" | sed -n "s/^$1=//p" | head -1; }

# All required params must be present + non-empty.
oldIFS=$IFS; IFS=,
for r in $required; do
  IFS=$oldIFS
  [ -n "$r" ] || { IFS=,; continue; }
  [ -n "$(getp "$r")" ] || { echo "missing required param: $r" >&2; exit 2; }
  IFS=,
done
IFS=$oldIFS

# Allowlist resolver — command-output cmd= must name an allowlisted entry (no arbitrary shell).
# LITERAL name equality (codex P2): the LLM-supplied name must NOT be treated as a regex, else
# `cmd=git.*` would glob-match a different allowlisted entry than the one named.
resolve_cmd() {
  _want=$1
  while IFS= read -r _line; do
    _rest=$(printf '%s' "$_line" | sed -n 's/^[[:space:]]*#[[:space:]]*allow:[[:space:]]*//p')
    [ -n "$_rest" ] || continue
    _name=${_rest%%=*}; _cmd=${_rest#*=}
    [ "$_name" = "$_want" ] && { printf '%s\n' "$_cmd"; return 0; }
  done < "$CATALOG"
  return 1
}

case "$TEMPLATE" in
  file-contains)
    target=$(getp target); pattern=$(getp pattern)
    if [ "$MODE" = run ]; then
      [ -f "$target" ] || { echo "fail: target missing: $target" >&2; exit 1; }
      grep -Fq -- "$pattern" "$target" && exit 0 || exit 1
    else
      # redcheck: the pattern must NOT match an empty file (catches a vacuous/empty pattern).
      tmp=$(mktemp); : > "$tmp"
      if grep -Fq -- "$pattern" "$tmp"; then rm -f "$tmp"; echo "theater: pattern matches empty file" >&2; exit 1; fi
      rm -f "$tmp"; exit 0
    fi
    ;;
  json-field)
    target=$(getp target); path=$(getp path)
    command -v jq >/dev/null 2>&1 || { echo "jq not available" >&2; exit 2; }
    if [ "$MODE" = run ]; then
      [ -f "$target" ] || { echo "fail: target missing: $target" >&2; exit 1; }
      jq -e "$path" "$target" >/dev/null 2>&1 && exit 0 || exit 1
    else
      # redcheck: the path must be falsy against {} (catches a tautological path like `true`).
      if printf '{}' | jq -e "$path" >/dev/null 2>&1; then echo "theater: path truthy on {}" >&2; exit 1; fi
      exit 0
    fi
    ;;
  command-output)
    name=$(getp cmd); expect=$(getp expect)
    real=$(resolve_cmd "$name"); [ -n "$real" ] || { echo "command not in allowlist: $name" >&2; exit 2; }
    if [ "$MODE" = run ]; then
      out=$($real 2>/dev/null) || true
      printf '%s\n' "$out" | grep -Fq -- "$expect" && exit 0 || exit 1
    else
      # redcheck: tests the MATCHER stage with empty input (do NOT run the real command —
      # most commands ignore stdin). Catches a vacuous/empty `expect`.
      if printf '' | grep -Fq -- "$expect"; then echo "theater: expect matches empty input" >&2; exit 1; fi
      exit 0
    fi
    ;;
  *) echo "unhandled template: $TEMPLATE" >&2; exit 2 ;;
esac
