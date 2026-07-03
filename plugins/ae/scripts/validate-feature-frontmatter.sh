#!/bin/sh
# validate-feature-frontmatter.sh — Plan 055 Step 3: validate AE-internal feature + plan frontmatter
#
# v0.10.x schema grep script; v0.11.x candidate to upgrade to schema validator framework.
# Intentional coupling: validates feature index.md + plan frontmatter same schema mechanism,
# schema evolution must touch this script. SPLIT CONDITION: when the feature schema
# and the plan schema diverge by more than 1 field within a single quarter, the script
# may be split into 2 (legitimate escape hatch surfaced by an earlier regret review).
#
# Hardcoded AE-internal paths (does NOT read pipeline.yml; external projects with
# custom output.plans: path NOT covered — out of scope by design).
#
# AC4 grandfather scope (per Plan 055 MCE MF1): existing done/abandoned features with
# mtime > 30d are grandfathered (skip validation). Active features + recently-created
# (mtime <= 30d) features validate fully.
#
# KNOWN LIMIT (per Plan 055 /ae:review gemini + challenger findings):
# mtime-based grandfather is RELIABLE only for local dev-time workflow. In CI / fresh
# git clone / new worktree / cross-machine sync, file mtime resets to checkout time —
# all files appear "new", grandfather logic effectively disabled (all features validate
# full-strictly even legacy ones). Acceptable for v0.10.x local dev-time pre-commit use.
# If moving to CI pre-commit gate, migrate to git-log-based file age (deferred v0.11.x).
#
# Behavior:
# - Validate feature index.md frontmatter: required id/title/status/created, status enum, size enum (if present)
# - Validate plan .md frontmatter: status enum
# - Unknown fields → warn not fail (reader-tolerant per CLAUDE.md schema contract)
# - Missing required → fail
# - Exit 0 = all valid / Exit 1 = any required violation

set -u

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
# FEATURES_ROOT env override (F-069): lets tests point at a fixture feature tree
# instead of the real .ae/features. Defaults to the real tree for normal runs.
FEATURES_DIR="${FEATURES_ROOT:-$REPO_ROOT/.ae/features}"
PLANS_DIR="$REPO_ROOT/.ae/plans"

failures=0
warnings=0
validated_features=0
grandfathered_features=0
validated_plans=0

# ----- Helpers -----

# Extract frontmatter (between first `---` and second `---`) from a markdown file
extract_frontmatter() {
  awk '/^---$/{c++; if(c==1){p=1;next} if(c==2){p=0;exit}} p' "$1"
}

# Extract value of a frontmatter field (returns empty if absent)
# YAML PARSE LIMIT (per Plan 055 /ae:review gemini): basic grep+sed; fragile for:
# - Values with internal colons (e.g., `title: "Foo: Bar"`)
# - Multi-line YAML (| or > scalars)
# - Quoted strings with embedded quotes (e.g., `"foo \"bar\" baz"`)
# Current AE frontmatter is simple key-value; OK for v0.10.x. Migrate to yq if schema
# grows multi-line/complex YAML (BL-090 tracks this).
get_field() {
  # $1 = file, $2 = field name
  extract_frontmatter "$1" | grep -E "^${2}:" | head -1 | sed -E "s/^${2}:[[:space:]]*//; s/^\"//; s/\"$//; s/^'//; s/'$//"
}

# Check if file mtime is > 30 days ago (grandfather threshold)
is_grandfathered() {
  # $1 = file path
  # macOS: stat -f %m → epoch; Linux: stat -c %Y → epoch
  mtime_epoch=$(stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null)
  [ -z "$mtime_epoch" ] && return 1  # cannot stat → not grandfathered (validate)
  now_epoch=$(date +%s)
  age_seconds=$((now_epoch - mtime_epoch))
  threshold=$((30 * 24 * 60 * 60))  # 30 days
  [ "$age_seconds" -gt "$threshold" ]
}

# ----- Feature index.md validation -----

if [ -d "$FEATURES_DIR" ]; then
  for state_dir in active done abandoned paused; do
    [ -d "$FEATURES_DIR/$state_dir" ] || continue
    for feature_dir in "$FEATURES_DIR/$state_dir"/F-*/; do
      [ -d "$feature_dir" ] || continue
      index_file="$feature_dir/index.md"
      [ -f "$index_file" ] || continue

      relpath="${index_file#$REPO_ROOT/}"

      # Grandfather check: only done/abandoned can be grandfathered (active + paused always
      # validate strictly — paused is non-terminal and will resume, so its frontmatter must
      # stay valid; F-032 D6).
      if [ "$state_dir" != "active" ] && [ "$state_dir" != "paused" ] && is_grandfathered "$index_file"; then
        grandfathered_features=$((grandfathered_features + 1))
        continue
      fi

      validated_features=$((validated_features + 1))

      # Required fields
      id=$(get_field "$index_file" "id")
      title=$(get_field "$index_file" "title")
      status=$(get_field "$index_file" "status")
      created=$(get_field "$index_file" "created")

      for req_pair in "id:$id" "title:$title" "status:$status" "created:$created"; do
        name="${req_pair%%:*}"
        value="${req_pair#*:}"
        if [ -z "$value" ]; then
          echo "[validate-frontmatter] FAIL: missing required field '$name' in $relpath" >&2
          failures=$((failures + 1))
        fi
      done

      # status enum
      case "$status" in
        active|done|abandoned|paused|"") ;;  # empty already reported above
        *)
          echo "[validate-frontmatter] FAIL: invalid status '$status' in $relpath (expected: active|done|abandoned|paused)" >&2
          failures=$((failures + 1))
          ;;
      esac

      # size enum (optional)
      size=$(get_field "$index_file" "size")
      case "$size" in
        XS|S|M|L|XL|"") ;;
        *)
          echo "[validate-frontmatter] FAIL: invalid size '$size' in $relpath (expected: XS|S|M|L|XL)" >&2
          failures=$((failures + 1))
          ;;
      esac

      # edges enum validation (F-069): edges is a YAML list of provenance objects
      # {kind, id, source, evidence, written_by, judge}. Line-based (not full YAML
      # parse) — sufficient to enforce the two enums; wiki-lint.sh does deeper checks.
      fm=$(extract_frontmatter "$index_file")
      bad_kinds=$(printf '%s\n' "$fm" | grep -E '(^|[[:space:]])kind:' | sed -E 's/.*kind:[[:space:]]*//; s/[[:space:]]*$//' | grep -vE '^(origin|supersedes|superseded_by|relates_to|conflicts_with)$' || true)
      if [ -n "$bad_kinds" ]; then
        echo "[validate-frontmatter] FAIL: invalid edge kind in $relpath: $bad_kinds (expected: origin|supersedes|superseded_by|relates_to|conflicts_with)" >&2
        failures=$((failures + 1))
      fi
      bad_writers=$(printf '%s\n' "$fm" | grep -E '(^|[[:space:]])written_by:' | sed -E 's/.*written_by:[[:space:]]*//; s/[[:space:]]*$//' | grep -vE '^(review-archive|batch|human)$' || true)
      if [ -n "$bad_writers" ]; then
        echo "[validate-frontmatter] FAIL: invalid written_by in $relpath: $bad_writers (expected: review-archive|batch|human)" >&2
        failures=$((failures + 1))
      fi
    done
  done
fi

# ----- Plan .md validation -----

if [ -d "$PLANS_DIR" ]; then
  for plan_file in "$PLANS_DIR"/*.md; do
    [ -f "$plan_file" ] || continue
    relpath="${plan_file#$REPO_ROOT/}"

    # Skip test fixtures (999-*)
    case "$(basename "$plan_file")" in
      999-*) continue ;;
    esac

    validated_plans=$((validated_plans + 1))

    # Plan status enum (only required field validated here; full plan schema is loose by design)
    status=$(get_field "$plan_file" "status")
    case "$status" in
      draft|reviewed|done|cancelled) ;;
      "")
        # Tolerate missing status on legacy plans (not all old plans had frontmatter status)
        warnings=$((warnings + 1))
        echo "[validate-frontmatter] WARN: plan missing 'status' field in $relpath (legacy plan tolerated)" >&2
        ;;
      *)
        echo "[validate-frontmatter] FAIL: invalid plan status '$status' in $relpath (expected: draft|reviewed|done|cancelled)" >&2
        failures=$((failures + 1))
        ;;
    esac
  done
fi

echo "[validate-frontmatter] features: validated=$validated_features grandfathered=$grandfathered_features | plans: validated=$validated_plans | warnings=$warnings failures=$failures"

if [ "$failures" -gt 0 ]; then
  exit 1
fi
exit 0
