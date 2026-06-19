#!/bin/sh
# ae-analyze-arbiter.sh — F-041: the analyze->discuss delivery arbiter (info-gain).
#
# The ONE genuinely-new arbiter in the spiral (the other 4 stage-arbiters already exist
# in AE: discuss convergence, plan-review verdict, work auto-pass, review verdict). It
# gates the analyze stage's delivery: "did we learn enough? are load-bearing assumptions
# verified or explicitly flagged for spike/discuss?" — a deterministic structural core
# plus a quantitative cross-family agent panel (same mechanism spiked in judge-panel.sh).
#
# This is where the self-evolving spike-trigger lives: an analysis that hides unverified
# load-bearing assumptions scores low on assumption_honesty -> fail -> go spike/learn more.
#
# Exit 0 = deliver to discuss/plan; non-zero = not ready (more analysis or a spike needed).
# DRY=1 = structural core only (no LLM judges).
# THRESH=N = min per-dimension score 0-10 required from EACH family (default 7).
set -u
A="${1:?usage: ae-analyze-arbiter.sh <analysis.md>}"
[ -f "$A" ] || { echo "ARBITER: fail (analysis not found: $A)"; exit 2; }
THRESH="${THRESH:-7}"

# --- deterministic structural core (always) ---
miss=""
grep -q '## TL;DR' "$A" || miss="$miss TL;DR"
grep -qi 'Key open questions' "$A" || miss="$miss Key-open-questions"
grep -qi 'Next step' "$A" || miss="$miss Next-step"
if [ -n "$miss" ]; then
  echo "ARBITER: fail (structural — missing:$miss); analysis must state its open questions + a next-step decision"
  exit 1
fi
if [ "${DRY:-0}" = 1 ]; then echo "ARBITER: structural-pass (DRY; agent panel skipped)"; exit 0; fi

# --- quantitative cross-family panel (worker != judge; diverse families; each-dim AND threshold) ---
RUBRIC="Score the ANALYSIS below on three integer dimensions 0-10:
grounding (claims cite code/file evidence, not speculation),
coverage (the key dimensions of the problem are addressed),
assumption_honesty (load-bearing assumptions that are UNVERIFIED are explicitly named, not hidden).
Output ONLY one JSON object, one line, no prose: {\"grounding\":N,\"coverage\":N,\"assumption_honesty\":N}

ANALYSIS:
$(cat "$A")"

j_codex="$(codex exec -s workspace-write --skip-git-repo-check "$RUBRIC" 2>/dev/null | grep -oE '\{[^{}]*\}' | tail -1)"
j_claude="$(printf '%s' "$RUBRIC" | claude -p 2>/dev/null | grep -oE '\{[^{}]*\}' | tail -1)"

THRESH="$THRESH" python3 - "$j_codex" "$j_claude" <<'PY'
import sys, os, json
dims = ["grounding", "coverage", "assumption_honesty"]
th = int(os.environ.get("THRESH", "7"))
def parse(s):
    try:
        d = json.loads(s)
        return d if all(k in d for k in dims) else None
    except Exception:
        return None
judges = []
for n, raw in zip(["codex", "claude"], sys.argv[1:]):
    d = parse(raw)
    print(f"judge {n}: {d}")
    if d:
        judges.append((n, d))
if len(judges) < 2:
    print("ARBITER: fail (<2 valid judge scores) -> not ready")
    sys.exit(1)
# conservative AND: every judge, every dim must clear the threshold (per the measured
# cross-judge variance — one lenient judge must not pass a weak analysis alone)
bad = [(n, k, j[k]) for n, j in judges for k in dims if j[k] < th]
if bad:
    print(f"ARBITER: fail (below threshold {th}: " + ", ".join(f"{n}.{k}={v}" for n, k, v in bad) + ") -> more analysis / a spike needed")
    sys.exit(1)
print(f"ARBITER: pass (all dims >= {th} from both families) -> deliver to discuss/plan")
sys.exit(0)
PY
