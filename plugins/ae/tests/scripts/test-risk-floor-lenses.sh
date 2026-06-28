#!/bin/sh
# test-risk-floor-lenses.sh — F-067 AC3: the deterministic risk-floor is pure-shell + LLM-independent.
# risk-floor-lenses.sh <paths-file> <patterns-file> → emits the forced lens set (one per line).
# A changed path matching any work.security_patterns glob → "security"; no match → empty.
# Boundary inputs (glob-edge match + clear near-miss), not midpoints (AC3).
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
SUT="$HERE/../../scripts/risk-floor-lenses.sh"
fail=0
tmp=$(mktemp -d)

# canonical work.security_patterns globs (subset, mirrors pipeline.template.yml:90)
cat > "$tmp/patterns" <<'EOF'
auth/*
security/*
*.env
*secret*
*.pem
*.key
migrations/*
EOF

run_case() { # label  paths-content  expected-output
  label=$1; paths=$2; expected=$3
  printf '%s\n' "$paths" > "$tmp/paths"
  got=$(sh "$SUT" "$tmp/paths" "$tmp/patterns" 2>/dev/null)
  if [ "$got" = "$expected" ]; then
    echo "ok: $label"
  else
    echo "FAIL: $label — expected [$expected] got [$got]"; fail=1
  fi
}

# glob-edge match: a file UNDER auth/ matches auth/* → security forced
run_case "auth/ match forces security" "auth/middleware.go" "security"
# clear near-miss: authz_notes.md does NOT match auth/* (no slash) → empty
run_case "authz_notes near-miss → empty" "authz_notes.md" ""
# clean non-match: gameplay file → empty (the G1 case: no floor forced)
run_case "game-core path → empty" "src/game/render.go" ""
# migrations glob
run_case "migrations/ forces security" "migrations/0007_add_col.sql" "security"
# secret substring glob
run_case "secret substring forces security" "config/app_secret.json" "security"
# multiple paths, one matches → security emitted ONCE (dedup)
printf 'src/game/render.go\nauth/login.go\nsrc/game/input.go\n' > "$tmp/paths"
got=$(sh "$SUT" "$tmp/paths" "$tmp/patterns" 2>/dev/null)
[ "$got" = "security" ] && echo "ok: mixed paths → security once (dedup)" || { echo "FAIL: dedup — got [$got]"; fail=1; }

rm -rf "$tmp"
[ "$fail" -eq 0 ] && echo "ALL PASS" || { echo "SOME FAILED"; exit 1; }
