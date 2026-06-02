#!/usr/bin/env bash
# cross-family-counter.sh — F-033
# Emit a raw DESCRIPTIVE cross-family participation counter from AE trace data.
# NOT a quality metric: it reports how often >=2 model families ran at full state
# on /ae:review invocations, over reviews that actually carry family-tracking data.
# The principled quality (flip-rate) metric is deferred to BL-115.
#
# Trace dir resolution: $1 (positional) > $AE_TRACE_DIR > ~/.ae/traces
# Always exits 0 (a missing-data / missing-jq state is reported, never an error).
set -euo pipefail

TRACE_DIR="${1:-${AE_TRACE_DIR:-$HOME/.ae/traces}}"

if ! command -v jq >/dev/null 2>&1; then
  echo "cross-family: counter unavailable (jq not installed)"
  exit 0
fi

# Collect ndjson files (nullglob so an empty dir yields an empty array, not a literal glob).
shopt -s nullglob
files=("$TRACE_DIR"/*.ndjson)
shopt -u nullglob
if [ "${#files[@]}" -eq 0 ]; then
  echo "cross-family: no family-tracking data yet (0 reviews, 0 with data)"
  exit 0
fi

# Classify each ae:review record by families_invoked shape:
#   object-array [{family,state}]  -> state known; counts toward ran (>=1 non-claude) and full (>=2 state==full)
#   flat string-array ["claude",..] -> families known, state unknown; counts toward ran only; degraded++
#   null OR key absent              -> nodata (excluded from the `known` denominator)
counts="$(cat "${files[@]}" 2>/dev/null | jq -R -s -r '
  # Parse defensively: split into lines, drop blanks + any non-JSON line (fromjson?)
  # so one polluted trace line never crashes the counter (BL-112 robustness).
  ( split("\n") | map(select(length > 0) | fromjson?) ) as $all
  | [ $all[] | select(.skill == "ae:review") ] as $r
  | ($r | length) as $total
  | ( $r | map(
        .families_invoked as $fi
        | if   $fi == null then {kind:"nodata"}
          elif ($fi | type) == "array" and ($fi | length) > 0 and ($fi[0] | type) == "object"
            then { kind:"object",
                   noncl: ([ $fi[] | .family ] | map(select(. != "claude")) | length),
                   full:  ([ $fi[] | select(.state == "full") ] | length) }
          elif ($fi | type) == "array"
            then { kind:"string",
                   noncl: ([ $fi[] | select(. != "claude") ] | length) }
          else {kind:"nodata"} end
      ) ) as $c
  | ($c | map(select(.kind == "nodata")) | length)  as $nodata
  | ($c | map(select(.kind == "string")) | length)  as $degraded
  | ($c | map(select(.kind != "nodata" and .noncl > 0)) | length) as $ran
  | ($c | map(select(.kind == "object" and .full >= 2)) | length) as $full
  | "\($total) \($total - $nodata) \($ran) \($full) \($degraded)"
')"

read -r total known ran full degraded <<EOF
$counts
EOF

if [ "${known:-0}" -eq 0 ]; then
  echo "cross-family: no family-tracking data yet (${total:-0} reviews, 0 with data)"
  exit 0
fi

line="cross-family: ${full}/${known} reviews ran ≥2 families full (${ran} ran ≥1 cross-family; ${known}/${total} reviews have family-tracking data; flip-rate deferred → BL-115)"
if [ "${degraded:-0}" -gt 0 ]; then
  line="${line} [degraded: ${degraded} state-unknown]"
fi
echo "$line"
