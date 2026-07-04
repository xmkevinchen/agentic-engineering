#!/bin/sh
# AC1 (F-069 Step 1): edge schema recognized + enum-validated by validate-feature-frontmatter.sh
# sh-tap output (parser: sh-tap.v1). Exercises a valid + two out-of-enum boundary values.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
VALIDATE="$REPO/plugins/ae/scripts/validate-feature-frontmatter.sh"
FIX="$HERE/../fixtures/graph"

pass=0; fail=0
ok(){ echo "ok: $1"; pass=$((pass+1)); }
notok(){ echo "not ok: $1"; fail=$((fail+1)); }

# 1. valid edges fixture → validate exits 0 (edges recognized, not rejected)
if FEATURES_ROOT="$FIX/valid-edges" sh "$VALIDATE" >/dev/null 2>&1; then
  ok "valid edges accepted (edge fields recognized, not rejected)"
else
  notok "valid edges rejected (should be accepted)"
fi

# 2. out-of-enum kind → validate exits non-zero (boundary: invalid value)
if FEATURES_ROOT="$FIX/invalid-kind" sh "$VALIDATE" >/dev/null 2>&1; then
  notok "out-of-enum kind accepted (should fail)"
else
  ok "out-of-enum kind rejected"
fi

# 3. out-of-enum written_by → validate exits non-zero (boundary: invalid value)
if FEATURES_ROOT="$FIX/invalid-writer" sh "$VALIDATE" >/dev/null 2>&1; then
  notok "out-of-enum written_by accepted (should fail)"
else
  ok "out-of-enum written_by rejected"
fi

# 4. every enum kind appears in the valid fixture (AC1: "one valid instance of each edge type")
fixture="$FIX/valid-edges/done/F-901-sample/index.md"
missing=""
for kind in origin supersedes superseded_by relates_to conflicts_with; do
  grep -q "kind: $kind" "$fixture" || missing="$missing $kind"
done
if [ -z "$missing" ]; then
  ok "valid fixture carries one instance of every edge kind"
else
  notok "valid fixture carries one instance of every edge kind (missing:$missing)"
fi

# 5. schema documented in CLAUDE.local.md (AC1 documentation claim; the file is
# contributor-local/gitignored — absent checkout degrades to an explicit skip-pass)
LOCALDOC="$REPO/CLAUDE.local.md"
if [ -f "$LOCALDOC" ]; then
  docmiss=""
  for token in "kind:" "written_by:" "source:" "evidence:" "judge:" origin supersedes superseded_by relates_to conflicts_with; do
    grep -q -- "$token" "$LOCALDOC" || docmiss="$docmiss $token"
  done
  if [ -z "$docmiss" ]; then
    ok "edge schema + provenance documented in CLAUDE.local.md"
  else
    notok "edge schema + provenance documented in CLAUDE.local.md (missing:$docmiss)"
  fi
else
  ok "edge schema doc check skipped (CLAUDE.local.md absent — contributor-local file)"
fi

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
