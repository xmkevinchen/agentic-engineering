#!/bin/sh
# trace-rotate.sh — Plan 054 Step 4: archive 90d+ ndjson files; log 6m+ archives (default keep)
#
# Behavior:
#   1. Find ~/.ae/traces/*.ndjson with mtime > 90d, group by YYYY-MM
#   2. For each group: write-new staging tar.zst -> verify integrity -> atomic mv to archive/<YYYY-MM>.tar.zst
#   3. Delete source .ndjson files only after archive verified
#   4. Find ~/.ae/traces/archive/*.tar.zst with mtime > 180d -> log to stderr only (default keep per security #5)
#
# Triggered by:
#   - SessionEnd hook (cheap if no candidates match -mtime +90)
#   - OR cron / manual: `bash ${CLAUDE_PLUGIN_ROOT}/scripts/trace-rotate.sh`

set -u

# F-044: best-effort sweep of the BL-023 smoke-test leftover. The log write was
# removed in Plan 054 review fixup, but /tmp/ae-session-check.log may still exist
# (session id, world-readable, no rotation) on machines that ran the smoke build.
# Runs BEFORE the TRACE_DIR existence check so users without a traces dir still get
# swept; failure must never abort rotation.
rm -f /tmp/ae-session-check.log 2>/dev/null || true

TRACE_DIR="${HOME}/.ae/traces"
ARCHIVE_DIR="${TRACE_DIR}/archive"

[ -d "$TRACE_DIR" ] || { echo "[rotate] skip: $TRACE_DIR does not exist" >&2; exit 0; }
mkdir -p "$ARCHIVE_DIR" 2>/dev/null || { echo "[rotate] skip: cannot mkdir $ARCHIVE_DIR" >&2; exit 0; }
chmod 0700 "$ARCHIVE_DIR" 2>/dev/null || true

# Check required tools
for tool in tar zstd find; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "[rotate] skip: required tool not found: $tool" >&2
    exit 0
  fi
done

# ---- Group 90d+ .ndjson files by YYYY-MM ----
# Use find -mtime +90 to get candidates; portable across macOS/Linux.
CANDIDATES_FILE="$(mktemp -t ae-rotate-candidates.XXXXXX)"
trap "rm -f '$CANDIDATES_FILE'" EXIT INT TERM

find "$TRACE_DIR" -maxdepth 1 -name '*.ndjson' -type f -mtime +90 > "$CANDIDATES_FILE" 2>/dev/null

if [ ! -s "$CANDIDATES_FILE" ]; then
  # No candidates; still check 6m+ archives below
  :
else
  # Group by YYYY-MM derived from file mtime
  # macOS stat: stat -f "%Sm" -t "%Y-%m"; Linux stat: stat -c "%y" + cut
  GROUPS_DIR="$(mktemp -d -t ae-rotate-groups.XXXXXX)"
  # Override trap to also clean groups dir
  trap "rm -rf '$CANDIDATES_FILE' '$GROUPS_DIR'" EXIT INT TERM

  while IFS= read -r f; do
    if [ -z "$f" ]; then continue; fi
    # Portable mtime YYYY-MM detection
    if mtime_ymd="$(stat -f "%Sm" -t "%Y-%m" "$f" 2>/dev/null)"; then
      ym="$mtime_ymd"  # macOS path
    elif mtime_full="$(stat -c "%y" "$f" 2>/dev/null)"; then
      ym="$(echo "$mtime_full" | cut -c1-7)"  # Linux path: "2026-02-01 ..." -> "2026-02"
    else
      echo "[rotate] warn: cannot stat $f, skip" >&2
      continue
    fi
    # Append to per-group list
    printf '%s\n' "$f" >> "$GROUPS_DIR/$ym.list"
  done < "$CANDIDATES_FILE"

  # Process each group
  for group_list in "$GROUPS_DIR"/*.list; do
    [ -f "$group_list" ] || continue
    ym="$(basename "$group_list" .list)"
    archive_path="$ARCHIVE_DIR/${ym}.tar.zst"
    # Staging in $ARCHIVE_DIR (not /tmp) per architecture-reviewer P2-logic:
    # mv same-filesystem POSIX atomic on Linux/macOS; /tmp tmpfs vs $HOME ext4 breaks atomic on Linux.
    staging_path="$(mktemp -p "$ARCHIVE_DIR" "ae-rotate-staging-${ym}.XXXXXX.tar.zst" 2>/dev/null || mktemp -t "ae-rotate-staging-${ym}.XXXXXX.tar.zst")"

    # If archive already exists, extract its members + merge with new
    if [ -f "$archive_path" ]; then
      extract_dir="$(mktemp -d -t ae-rotate-extract.XXXXXX)"
      # gemini-proxy MF#3 reclassified: trap cleanup extract_dir on SIGKILL/INT/TERM.
      # shellcheck disable=SC2016
      trap 'rm -rf "$extract_dir" 2>/dev/null' EXIT INT TERM
      # security-reviewer P3: --no-absolute-names defense in depth on extract (archive content trust).
      if ! tar --use-compress-program=zstd --no-absolute-names -xf "$archive_path" -C "$extract_dir" 2>/dev/null; then
        echo "[rotate] warn: cannot extract existing archive $archive_path, skip group $ym" >&2
        rm -rf "$extract_dir" "$staging_path"
        trap - EXIT INT TERM
        continue
      fi
      # Stage: extracted + new candidates
      (cd "$extract_dir" && tar --use-compress-program=zstd -cf "$staging_path" .) 2>/dev/null
      # Now append new files to staging
      # Easier: re-tar everything (extracted + new candidates) from scratch
      rm -f "$staging_path"
      # Copy new candidates into extract dir
      while IFS= read -r f; do
        cp "$f" "$extract_dir/" 2>/dev/null || true
      done < "$group_list"
      (cd "$extract_dir" && tar --use-compress-program=zstd -cf "$staging_path" -- *) 2>/dev/null
      rm -rf "$extract_dir"
      trap - EXIT INT TERM
    else
      # Fresh archive: tar new candidates directly (using basenames)
      tar_input_dir="$(mktemp -d -t ae-rotate-input.XXXXXX)"
      while IFS= read -r f; do
        cp "$f" "$tar_input_dir/" 2>/dev/null || true
      done < "$group_list"
      (cd "$tar_input_dir" && tar --use-compress-program=zstd -cf "$staging_path" -- *) 2>/dev/null
      rm -rf "$tar_input_dir"
    fi

    # Verify staging integrity (atomic write-new-then-mv per gemini SRE)
    if ! tar --use-compress-program=zstd -tf "$staging_path" >/dev/null 2>&1; then
      echo "[rotate] warn: staging archive $staging_path failed integrity check, skip group $ym" >&2
      rm -f "$staging_path"
      continue
    fi

    # Atomic rename (mv on same filesystem is POSIX atomic)
    if ! mv "$staging_path" "$archive_path"; then
      echo "[rotate] warn: cannot mv staging to $archive_path" >&2
      rm -f "$staging_path"
      continue
    fi
    chmod 0600 "$archive_path" 2>/dev/null || true

    # Delete source files (verified archived)
    while IFS= read -r f; do
      rm -f "$f"
    done < "$group_list"

    echo "[rotate] archived $ym ($(wc -l < "$group_list" | tr -d ' ') files) -> $archive_path"
  done

  rm -rf "$GROUPS_DIR"
fi

# ---- Log 6m+ archives (default keep per security #5; user manually decides) ----
find "$ARCHIVE_DIR" -maxdepth 1 -name '*.tar.zst' -type f -mtime +180 2>/dev/null | while IFS= read -r old_archive; do
  [ -z "$old_archive" ] && continue
  echo "[rotate] candidate for deletion: $old_archive (>180d old; default keep — user manually rm if desired)" >&2
done

rm -f "$CANDIDATES_FILE"
trap - EXIT INT TERM
exit 0
