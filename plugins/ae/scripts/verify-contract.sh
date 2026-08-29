#!/bin/sh
# verify-contract.sh — deterministic contract runner (jq-based).
#
# One half of a two-part check: something writes a declarative spec — a set of jq boolean
# assertions over a feature's data output — and this runner executes it deterministically,
# so the verdict does not depend on whoever wrote the spec. Its current caller is
# tests/scripts/test-findings-format-compliance.sh; it is also usable directly as a
# `test.command` target.
#
# Usage: verify-contract.sh <spec.jq> <sample.json>
#   spec.jq    — one jq boolean assertion per line (# comments + blank lines ignored)
#   sample.json — the data document to validate
# Exit: 0 = all assertions pass | 1 = a violation | 2 = usage / IO / missing-jq error.
#
# NOT a test-seam: this is a standalone script invoked at the test.command/fixture
# level — never embedded in a SKILL.md prompt path (Mengdie f5ad527d).

if [ $# -ne 2 ]; then echo "usage: verify-contract.sh <spec.jq> <sample.json>" >&2; exit 2; fi
spec=$1
sample=$2
if [ ! -f "$spec" ]; then echo "spec not found: $spec" >&2; exit 2; fi
if [ ! -f "$sample" ]; then echo "sample not found: $sample" >&2; exit 2; fi
if ! command -v jq >/dev/null 2>&1; then echo "jq not available" >&2; exit 2; fi

fail=0
n=0
while IFS= read -r raw || [ -n "$raw" ]; do
  # Strip leading/trailing whitespace FIRST, then skip blanks + comments (an
  # indented `  # comment` or a whitespace-only line was being sent to jq and failing).
  line=$(printf '%s' "$raw" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  case "$line" in ''|\#*) continue ;; esac   # NB: \# is load-bearing — bare # after | starts a comment in some sh
  n=$((n + 1))
  # jq -e: exit 0 if the result is neither false nor null; non-0 on false/null = violation.
  # KNOWN LIMIT: a malformed jq program (compile error)
  # is currently conflated with a data violation (both → fail). jq 1.8.1 exit codes don't
  # cleanly separate compile-error from falsy without false-positives on valid assertions
  # that error on edge inputs; the clean distinction is deferred (diagnostic quality, not
  # a safety issue — a bad spec surfaces as a loud failing AC either way).
  if ! jq -e "$line" "$sample" >/dev/null 2>&1; then
    echo "FAIL: $line" >&2
    fail=1
  fi
done < "$spec"

if [ "$n" -eq 0 ]; then echo "no assertions in spec" >&2; exit 2; fi
if [ "$fail" -eq 0 ]; then echo "contract OK ($n assertions)"; exit 0; fi
exit 1
