#!/bin/sh
# AC1 (F-069 Step 1): edge schema recognized + enum-validated by validate-feature-frontmatter.sh
# sh-tap output (parser: sh-tap.v1). Exercises a valid + two out-of-enum boundary values.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
VALIDATE="$REPO/plugins/ae/scripts/validate-feature-frontmatter.sh"
FIX="$HERE/../fixtures/wiki"

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

echo "1..$((pass + fail))"
[ "$fail" -eq 0 ]
