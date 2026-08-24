#!/bin/sh
# enumerate-ignored.sh — the tracked `bootstrap_ignored_v1` enumerator.
#
# `.ae/**` is gitignored, so Git is not recovery for it: a diff of the commit says nothing about
# the plans, decisions, requests, results and evidence the handoff actually runs on. This
# profile is what makes those bytes reviewable, and its whole value depends on being unable to
# look away from anything.
#
# So the profile has NO caller-selected roots, NO globs, and NO output path:
#
#   * The root is always the Git toplevel. It is discovered, never passed in.
#   * The universe is always every path `git ls-files --others --ignored --exclude-standard`
#     reports, plus every untracked descendant of project-root `.ae/**`, plus the ignored
#     directories containing them.
#   * The only subtraction is an exact path listed in the attempt's closed
#     `protocol_output_exclusions[]`. A prefix, a directory, or a pattern is not an exclusion —
#     those are how "everything the run produced" becomes invisible one commit at a time.
#   * The projection goes to stdout. A tool that chooses where to write is a tool that can be
#     pointed away from the file a reviewer would have compared.
#
# Paths are lstat'd, never followed: a symlink records its target and no digest, so the
# projection cannot be widened by pointing outside the repository. Every ignore-configuration
# input is bound by digest, and a missing or unreadable one invalidates the profile rather than
# being treated as empty.
#
# Usage:
#   sh enumerate-ignored.sh <exclusions.json>       print the projection for that attempt
#   sh enumerate-ignored.sh --verify <projection>   recompute and compare against a projection
#
# `--verify` recomputes from the repository using the projection's OWN declared exclusions, and
# compares the entry set and the bound inputs. It deliberately does not require the recorded
# enumerator to be this file: an independent recomputation that agrees is stronger evidence than
# a recorded producer identity, which only says who claimed to look.
#
# Exit 0 = printed, or recomputation agrees. 1 = recomputation disagrees, or a path on disk is
# neither tracked, untracked, git-ignored, nor an untracked `.ae/**` descendant. 2 = usage or an
# unreadable input.

set -eu

case "${1:-}" in
  --verify) [ "$#" -eq 2 ] || { echo "usage: sh enumerate-ignored.sh --verify <projection.json>" >&2; exit 2; }
            mode=verify; input=$2 ;;
  "" | -*)  echo "usage: sh enumerate-ignored.sh <exclusions.json> | --verify <projection.json>" >&2; exit 2 ;;
  *)        [ "$#" -eq 1 ] || { echo "usage: sh enumerate-ignored.sh <exclusions.json>" >&2; exit 2; }
            mode=emit; input=$1 ;;
esac

[ -f "$input" ] || { echo "enumerate-ignored: unreadable input: $input" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "enumerate-ignored: python3 is required" >&2; exit 2; }

SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

exec python3 - "$mode" "$input" "$SELF" <<'PY'
import hashlib, json, os, subprocess, sys

mode, input_path, self_path = sys.argv[1], sys.argv[2], sys.argv[3]


def die(message, code=1):
    sys.stderr.write(f"enumerate-ignored: {message}\n")
    raise SystemExit(code)


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    with open(path, "rb") as handle:
        return sha256_bytes(handle.read())


def git(args, ok=(0,), stdin=None):
    proc = subprocess.run(["git", *args], cwd=REPO, input=stdin,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode not in ok:
        die(f"git {' '.join(args)} exited {proc.returncode}: "
            f"{proc.stderr.decode('utf-8', 'replace').strip()}", 2)
    return proc.stdout


def canonical(rel):
    if (not rel or rel.startswith("/") or "\\" in rel or "\x00" in rel
            or any(part in ("", ".", "..") for part in rel.split("/"))):
        die(f"non-canonical repo-relative path: {rel!r}", 2)
    return rel


def decode_nul(raw, label):
    if raw and not raw.endswith(b"\0"):
        die(f"{label} is not NUL terminated", 2)
    return [canonical(part.decode("utf-8")) for part in raw.split(b"\0") if part]


def encode_nul(paths):
    return b"" if not paths else ("\0".join(paths) + "\0").encode("utf-8")


def order(paths):
    return sorted(set(paths), key=lambda item: item.encode("utf-8"))


toplevel = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE)
if toplevel.returncode != 0:
    die("not inside a Git worktree", 2)
REPO = os.path.realpath(toplevel.stdout.decode().strip())


def walk(rel=""):
    base = os.path.join(REPO, rel) if rel else REPO
    found = []
    with os.scandir(base) as it:
        for entry in it:
            if not rel and entry.name == ".git":
                continue
            child = f"{rel}/{entry.name}" if rel else entry.name
            canonical(child)
            found.append(child)
            if entry.is_dir(follow_symlinks=False):
                found.extend(walk(child))
    return found


def record(rel):
    abs_path = os.path.join(REPO, rel)
    try:
        st = os.lstat(abs_path)
    except FileNotFoundError:
        return {"path": rel, "type": "missing", "mode": None, "sha256": None, "link_target": None}
    mode = format(st.st_mode & 0o7777, "04o")
    if os.path.islink(abs_path):
        return {"path": rel, "type": "symlink", "mode": mode, "sha256": None,
                "link_target": os.readlink(abs_path)}
    if os.path.isdir(abs_path):
        return {"path": rel, "type": "directory", "mode": mode, "sha256": None, "link_target": None}
    if os.path.isfile(abs_path):
        return {"path": rel, "type": "file", "mode": mode, "sha256": sha256_file(abs_path),
                "link_target": None}
    return {"path": rel, "type": "other", "mode": mode, "sha256": None, "link_target": None}


def config_identity(path_value, configured=False):
    if path_value is None:
        return {"state": "not_configured", "path": None, "type": None,
                "sha256": None, "link_target": None}
    abs_path = path_value if os.path.isabs(path_value) else os.path.join(REPO, path_value)
    if not os.path.lexists(abs_path):
        return {"state": "configured_missing" if configured else "absent",
                "path": path_value, "type": None, "sha256": None, "link_target": None}
    if os.path.islink(abs_path):
        return {"state": "present", "path": path_value, "type": "symlink",
                "sha256": None, "link_target": os.readlink(abs_path)}
    if not os.path.isfile(abs_path):
        return {"state": "present", "path": path_value, "type": "other",
                "sha256": None, "link_target": None}
    return {"state": "present", "path": path_value, "type": "file",
            "sha256": sha256_file(abs_path), "link_target": None}


with open(input_path, encoding="utf-8") as handle:
    supplied = json.load(handle)

for field in ("feature_id", "work_package", "attempt_id", "capture_phase"):
    if not supplied.get(field):
        die(f"input is missing required field: {field}", 2)
if supplied["capture_phase"] not in ("before", "after"):
    die("capture_phase must be 'before' or 'after'", 2)

exclusions = supplied.get("protocol_output_exclusions", [])
if not isinstance(exclusions, list):
    die("protocol_output_exclusions must be an array", 2)
excluded = []
for item in exclusions:
    path_value = item.get("path") if isinstance(item, dict) else None
    if not isinstance(path_value, str):
        die("every exclusion must carry an exact 'path'", 2)
    canonical(path_value)
    if path_value.endswith("/") or "*" in path_value or "?" in path_value:
        die(f"exclusion is not an exact path: {path_value}", 2)
    excluded.append(path_value)
if len(set(excluded)) != len(excluded):
    die("protocol_output_exclusions contains a duplicate path", 2)
excluded_set = set(excluded)

tracked_raw = git(["ls-files", "-z", "--cached"])
untracked_raw = git(["ls-files", "--others", "--exclude-standard", "-z"])
ignored_raw = git(["ls-files", "--others", "--ignored", "--exclude-standard", "-z"])
tracked = set(decode_nul(tracked_raw, "tracked list"))
untracked = set(decode_nul(untracked_raw, "untracked list"))
git_ignored = set(decode_nul(ignored_raw, "ignored list"))

all_paths = order(walk())
all_dirs = [p for p in all_paths if os.path.isdir(os.path.join(REPO, p))
            and not os.path.islink(os.path.join(REPO, p))]
all_files = [p for p in all_paths if p not in set(all_dirs)]

ae_untracked = [p for p in all_files if p.startswith(".ae/") and p not in tracked]
ignored_files = set(order([*git_ignored, *ae_untracked]))

# A path on disk that is in none of the four classes means the profile does not describe this
# repository any more. Failing here is the point: a silently unclassified path is exactly the
# byte a projection would stop covering.
for rel in all_files:
    if rel not in tracked and rel not in untracked and rel not in ignored_files:
        die(f"path is neither tracked, untracked, git-ignored, nor untracked .ae: {rel}")

ignored_dirs = set()
if all_dirs:
    dir_result = git(["check-ignore", "-z", "--stdin"], ok=(0, 1), stdin=encode_nul(all_dirs))
    ignored_dirs = set(decode_nul(dir_result, "ignored directory list"))
for rel in all_dirs:
    if rel.startswith(".ae/") and not any(t == rel or t.startswith(rel + "/") for t in tracked):
        ignored_dirs.add(rel)

candidates = [p for p in order([*ignored_files, *ignored_dirs]) if p not in excluded_set]
entries = [record(rel) for rel in candidates]

global_config = subprocess.run(["git", "config", "--path", "--get", "core.excludesFile"],
                               cwd=REPO, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
if global_config.returncode not in (0, 1):
    die(f"git config core.excludesFile exited {global_config.returncode}", 2)
global_path = global_config.stdout.decode().strip() if global_config.returncode == 0 else None

inputs = {
    "git_ignored": {
        "argv": ["git", "ls-files", "--others", "--ignored", "--exclude-standard", "-z"],
        "raw_sha256": sha256_bytes(ignored_raw),
    },
    "ae_untracked": {
        "root": ".ae",
        "canonical_raw_sha256": sha256_bytes(encode_nul(order(ae_untracked))),
    },
    "canonical_ignored_raw": {
        "path": supplied.get("canonical_ignored_raw_path", ""),
        "sha256": sha256_bytes(encode_nul(order([*ignored_files]))),
    },
    "ignore_config": {
        "gitignore": config_identity(".gitignore"),
        "info_exclude": config_identity(".git/info/exclude"),
        "global_excludes": config_identity(global_path, configured=True),
    },
}

if mode == "emit":
    projection = {
        "artifact_kind": "bootstrap_ignored_projection",
        "artifact_version": 1,
        "authority": "bootstrap_non_authoritative",
        "feature_id": supplied["feature_id"],
        "work_package": supplied["work_package"],
        "attempt_id": supplied["attempt_id"],
        "capture_phase": supplied["capture_phase"],
        "captured_at": supplied.get("captured_at", ""),
        "repository_root": ".",
        "commit": git(["rev-parse", "HEAD"]).decode().strip(),
        "profile": "bootstrap_ignored_v1",
        "enumerator": {"path": os.path.relpath(self_path, REPO), "sha256": sha256_file(self_path)},
        "request_scope": supplied.get("request_scope", {"path": "", "sha256": ""}),
        "inputs": inputs,
        "protocol_output_exclusions": exclusions,
        "entries": entries,
    }
    sys.stdout.write(json.dumps(projection, indent=2) + "\n")
    raise SystemExit(0)

# --- verify ---------------------------------------------------------------------------------
recorded = supplied
problems = []

if recorded.get("profile") != "bootstrap_ignored_v1":
    problems.append(f"profile is {recorded.get('profile')!r}, not bootstrap_ignored_v1")
if recorded.get("repository_root") != ".":
    problems.append("repository_root is not the Git toplevel")

recorded_entries = {item["path"]: item for item in recorded.get("entries", [])}
if len(recorded_entries) != len(recorded.get("entries", [])):
    problems.append("the recorded projection lists a path more than once")
computed_entries = {item["path"]: item for item in entries}

for path_value in sorted(set(computed_entries) - set(recorded_entries)):
    problems.append(f"ignored path present on disk and absent from the projection: {path_value}")
for path_value in sorted(set(recorded_entries) - set(computed_entries)):
    problems.append(f"projection lists a path that is no longer an unexcluded ignored path: {path_value}")
for path_value in sorted(set(recorded_entries) & set(computed_entries)):
    was, now = recorded_entries[path_value], computed_entries[path_value]
    for field in ("type", "mode", "sha256", "link_target"):
        if was.get(field) != now.get(field):
            problems.append(f"{path_value}: {field} changed from {was.get(field)!r} to {now.get(field)!r}")

recorded_inputs = recorded.get("inputs", {})

# The ignore configuration gates: change `.gitignore` and "ignored" means something else, so a
# projection derived under different rules is not comparable to this one.
if recorded_inputs.get("ignore_config") != inputs["ignore_config"]:
    problems.append("inputs.ignore_config does not match the repository now — the projection was "
                    "derived under different ignore rules")

# The two raw-list digests are provenance, not the claim, and they are reported rather than
# gated for a reason worth stating. A `before` projection is captured before the attempt's own
# outputs exist; those outputs are then created and legitimately appear in git's raw list while
# staying out of `entries` as exact declared exclusions. Gating here would turn correct protocol
# order into a permanent failure. The claim — which paths are ignored and what their bytes are —
# is `entries`, and that is recomputed above.
for key in ("git_ignored", "ae_untracked"):
    if recorded_inputs.get(key) != inputs[key]:
        sys.stderr.write(f"enumerate-ignored: note: inputs.{key} differs from the raw list now; "
                         f"expected when declared protocol outputs were created after this "
                         f"capture. The entry set above is what gates.\n")

if problems:
    for problem in problems:
        sys.stderr.write(f"enumerate-ignored: {problem}\n")
    raise SystemExit(1)

print(f"enumerate-ignored: recomputation agrees ({len(entries)} entries, "
      f"{len(excluded)} exact exclusion(s))")
PY
