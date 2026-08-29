#!/bin/sh
# Join only feasibility. This never emits a qualification or rollout authority.
set -eu
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
[ "$(uname -s)" = Darwin ] && [ "$(uname -m)" = arm64 ] || {
  echo 'p0g-lite join: unknown (support arm requires Darwin arm64)' >&2; exit 42;
}
[ "$(sw_vers -productVersion)" = 26.6.2 ] || {
  echo 'p0g-lite join: unknown (support arm requires macOS 26.6.2)' >&2; exit 42;
}
case "$(claude --version 2>/dev/null)" in
  '2.1.231 (Claude Code)') ;;
  *) echo 'p0g-lite join: unknown (support arm requires Claude Code 2.1.231)' >&2; exit 42 ;;
esac
TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ae-p0g-join.XXXXXX")"
trap 'rm -rf "$TEMP_ROOT"' EXIT HUP INT TERM

sh "$ROOT/tests/spikes/p0g/active-release/verify-smoke.sh" > "$TEMP_ROOT/active.json"
sh "$ROOT/tests/spikes/p0g/isolation/verify-smoke.sh" > "$TEMP_ROOT/isolation.json"
sh "$ROOT/tests/spikes/p0g/filesystem/verify-smoke.sh" > "$TEMP_ROOT/filesystem.json"

python3 - "$TEMP_ROOT" <<'PY'
import json, os, sys
root = sys.argv[1]
rows = [json.load(open(os.path.join(root, name), encoding="utf-8"))
        for name in ("active.json", "isolation.json", "filesystem.json")]
expected = {"active_release", "child_isolation", "filesystem"}
lanes = {row.get("lane") for row in rows}
if lanes != expected:
    raise SystemExit(f"p0g-lite join: lane set mismatch: {sorted(lanes)}")
arms = {row.get("support_arm") for row in rows}
if len(arms) != 1 or None in arms:
    raise SystemExit(f"p0g-lite join: lanes do not share one support arm: {sorted(arms)}")
if any(row.get("qualification") is not False for row in rows):
    raise SystemExit("p0g-lite join: a smoke result claims qualification")
statuses = {row["lane"]: row.get("result") for row in rows}
allowed = {"plausible", "not_feasible", "unknown"}
if any(status not in allowed for status in statuses.values()):
    raise SystemExit(f"p0g-lite join: unknown status: {statuses}")
next_step = "P0.1" if all(value == "plausible" for value in statuses.values()) else None
print(json.dumps({"artifact_kind": "p0g_lite_join_v1", "authority": "none",
                  "qualification": False, "support_arm": next(iter(arms)),
                  "lanes": statuses, "implementation_next_allowed": next_step,
                  "formal_qualification_target": "P0.8",
                  "result": "plausible" if next_step else "stop"}, sort_keys=True))
PY
