#!/bin/sh
# validate-dispositions.sh — every mechanism this bootstrap strengthened, displaced, or stood up
# temporarily must end with exactly one recorded fate.
#
# The failure it prevents is quiet accumulation: a prototype that stays reachable, a strengthened
# check nobody decided to keep, a displaced tree left half-moved, a disposable profile that was
# never disposed of. Each of those is individually small and collectively the reason a bootstrap
# becomes permanent. So the rule is not "dispositions are documented" — it is that every listed
# artifact has ONE classification, an owner, a raw evidence digest, a statement of what authority
# it can still reach, and the effect of the follow-up.
#
# The classification is derived from the recorded disposition rather than duplicated beside it: a
# value starting `delete`, `retain`, or `pending-audit` classifies, anything else does not. A
# disposition that cannot be classified is the defect — it reads as decided while naming no fate.
#
# Two consequences are checked, not just recorded:
#   * a `retain`ed prototype must be unreachable from production — if a skill, agent, or script
#     outside the test tree references it, "retained and unregistered" is not true;
#   * `pending-audit` residue keeps its rollout blocker open — a continuation in the same package
#     that closes the F-082 partition contradicts it.
#
# Usage: sh validate-dispositions.sh <package-dir>
# Exit 0 = every disposition is complete and consistent. 1 = at least one is not. 2 = usage.

set -eu

[ "$#" -eq 1 ] || { echo "usage: sh validate-dispositions.sh <package-dir>" >&2; exit 2; }
[ -d "$1" ] || { echo "validate-dispositions: not a directory: $1" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "validate-dispositions: python3 is required" >&2; exit 2; }

exec python3 - "$1" <<'PY'
import hashlib, json, os, re, sys

package = os.path.abspath(sys.argv[1])
problems = []


def bad(message):
    problems.append(message)


def repo_root(start):
    current = start
    while True:
        if os.path.isdir(os.path.join(current, ".git")):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            return None
        current = parent


REPO = repo_root(package)
if REPO is None:
    sys.stderr.write("validate-dispositions: cannot locate the repository root\n")
    raise SystemExit(2)

CLASSES = ("delete", "retain", "pending-audit")
REQUIRED = ("artifact", "disposition", "owner", "evidence_sha256",
            "authority_reachability", "follow_up")


def classify(value):
    if not isinstance(value, str):
        return None
    matched = [name for name in CLASSES if value == name or value.startswith(name + "_")
               or value.startswith(name + "-")]
    return matched[0] if len(matched) == 1 else None


def load(path):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError) as exc:
        bad(f"{os.path.relpath(path, REPO)}: unreadable ({exc})")
        return None


# Dispositions are collected from every result in the package, so an attempt cannot leave one out
# by writing it somewhere the closeout does not look.
collected = []
for attempt in sorted(os.listdir(package)):
    result_path = os.path.join(package, attempt, "work-result.json")
    if not os.path.isfile(result_path):
        continue
    result = load(result_path)
    if not isinstance(result, dict):
        continue
    for index, entry in enumerate(result.get("replacement_dispositions", [])):
        collected.append((f"{attempt}.replacement_dispositions[{index}]", entry))

if not collected:
    bad(f"{os.path.relpath(package, REPO)}: no dispositions recorded in any attempt result — a "
        f"closeout that enumerates nothing cannot show that nothing was left behind")

seen = {}
for label, entry in collected:
    if not isinstance(entry, dict):
        bad(f"{label}: is not a disposition object")
        continue
    for field in REQUIRED:
        value = entry.get(field)
        if not isinstance(value, str) or not value.strip():
            bad(f"{label}: {field} is missing or empty")
    artifact = entry.get("artifact")
    if not isinstance(artifact, str):
        continue

    kind = classify(entry.get("disposition"))
    if kind is None:
        bad(f"{label}: disposition {entry.get('disposition')!r} does not classify as exactly one "
            f"of {'|'.join(CLASSES)} — it reads as decided while naming no fate")

    if artifact in seen:
        if seen[artifact] != kind:
            bad(f"{label}: {artifact} already has disposition class {seen[artifact]!r}; two "
                f"classifications is none")
    else:
        seen[artifact] = kind

    digest = entry.get("evidence_sha256")
    if isinstance(digest, str) and not re.fullmatch(r"[0-9a-f]{64}", digest):
        bad(f"{label}: evidence_sha256 {digest!r} is not a full lowercase SHA-256")
    else:
        abs_artifact = os.path.join(REPO, artifact)
        if os.path.isfile(abs_artifact) and not os.path.islink(abs_artifact):
            with open(abs_artifact, "rb") as handle:
                actual = hashlib.sha256(handle.read()).hexdigest()
            if actual != digest:
                bad(f"{label}: {artifact} hashes to {actual}, disposition records {digest}")
        elif kind != "delete" and not os.path.lexists(abs_artifact):
            bad(f"{label}: {artifact} does not exist but is dispositioned {kind!r} rather than "
                f"deleted")

    if kind == "retain":
        reachable = []
        for root in ("plugins/ae/skills", "plugins/ae/agents", "plugins/ae/scripts"):
            base = os.path.join(REPO, root)
            for directory, _subdirs, files in os.walk(base) if os.path.isdir(base) else ():
                for name in files:
                    candidate = os.path.join(directory, name)
                    try:
                        text = open(candidate, encoding="utf-8", errors="ignore").read()
                    except OSError:
                        continue
                    if artifact in text:
                        reachable.append(os.path.relpath(candidate, REPO))
        if reachable:
            bad(f"{label}: {artifact} is retained as unregistered, but production references it "
                f"from {reachable[:3]} — retained and unreachable is not what this records")

pending = [artifact for artifact, kind in seen.items() if kind == "pending-audit"]
continuation_path = os.path.join(package, "implementation-continuation.json")
if pending and os.path.isfile(continuation_path):
    continuation = load(continuation_path)
    if isinstance(continuation, dict):
        partition = (continuation.get("rollout_blockers") or {}).get("f082_partition")
        if partition == "closed":
            bad(f"continuation closes the F-082 partition while {len(pending)} disposition(s) "
                f"remain pending-audit: {pending[:3]}")

for message in problems:
    sys.stderr.write(f"  defect: {message}\n")
if problems:
    sys.stderr.write(f"validate-dispositions: {len(problems)} defect(s)\n")
    raise SystemExit(1)
print(f"validate-dispositions: {len(collected)} disposition(s) complete and classified "
      f"({len(seen)} artifact(s))")
PY
