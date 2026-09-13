#!/usr/bin/env python3
"""check-invocation-order.py — refuse a stage invocation whose predecessor never conformed.

Registered as a plugin-global `PreToolUse` hook matched on the `Skill` tool (see
`plugin.json`). Reads the hook's JSON input from stdin, which for a `Skill` tool call carries
`tool_input: {"skill": "<plugin>:<name>", "args": "<the argument string>"}` — confirmed against
live CC v2.1.268 for F-108's analysis, not assumed.

Fires only when `tool_input.skill` names one of this plugin's four stages with a predecessor
(`analyze` has none). Every other skill — any other plugin's, or `ae:analyze` itself — is exit 0
immediately, no `args` parsing, no subprocess. Never a second judgment about what "conforming"
means: this always delegates to `check-stage-delivery.py`, the same script `go/SKILL.md`'s own
prose and `go-leash.sh` already run.

Usage: reads the PreToolUse JSON payload from stdin. No CLI arguments.
Exit 0 = allow the tool call. Exit 2 = refuse it (PreToolUse's own refusal exit code).
"""

import importlib.util
import json
import pathlib
import re
import sys

STAGE_ORDER = ["analyze", "discuss", "plan", "work", "review"]
STAGES_WITH_PREDECESSOR = {"discuss", "plan", "work", "review"}
STATE_DIRS = ("active", "paused", "done", "abandoned")

_reader_spec = importlib.util.spec_from_file_location(
    "read_artifact_root", pathlib.Path(__file__).parent / "read-artifact-root.py")
_reader = importlib.util.module_from_spec(_reader_spec)
_reader_spec.loader.exec_module(_reader)


class RootRefused(Exception):
    """The configured `artifact_root:` is malformed; carries the reader's own message."""


def resolve_root(project_dir):
    try:
        return _reader.resolve(str(project_dir / ".claude" / "pipeline.yml"))
    except _reader.Malformed as e:
        raise RootRefused(f"read-artifact-root: {e}") from e


BARE_FEATURE_ID = re.compile(r"\bF-(\d+)\b")

FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\s*?\n", re.S)
DISCUSS_KEY = re.compile(r"^discuss:[ \t]*(.*)$", re.M)
EMPTY_VALUES = ("", "{}", "[]", "null", "~")


def find_project_dir():
    # PreToolUse's JSON payload carries `cwd`; fall back to the process cwd if it is absent.
    return pathlib.Path.cwd()


def resolve_feature_dir(project_dir, args, root):
    """Find the feature directory named in a stage invocation's argument string, or None.

    `root` is the project-relative artifact root already resolved by `read-artifact-root.py`
    (`.ae` when unconfigured) — the only string either form of match is built against, so a
    literal `.ae/...` in `args` no longer matches once a project configures something else.
    """
    feature_path = re.compile(
        rf"{re.escape(root)}/features/(?:active|paused|done|abandoned)/(F-\d+)-[^/\s]+")
    match = feature_path.search(args)
    if match:
        candidate = project_dir / match.group(0)
        return candidate if candidate.is_dir() else None

    for m in BARE_FEATURE_ID.finditer(args):
        fid = f"F-{m.group(1)}"
        for state in STATE_DIRS:
            hits = sorted((project_dir / root / "features" / state).glob(f"{fid}-*"))
            if len(hits) == 1 and hits[0].is_dir():
                return hits[0]
    return None


def discuss_applies(feature_dir):
    """Whether `discuss` is a real predecessor for this feature: its `discuss:` is non-empty."""
    analysis = feature_dir / "analysis.md"
    if not analysis.is_file():
        return False
    text = analysis.read_text()
    front = FRONTMATTER.match(text)
    if not front:
        return False
    found = DISCUSS_KEY.search(front.group(1))
    if not found:
        return False
    value = found.group(1).strip()
    if value not in EMPTY_VALUES:
        # A non-empty scalar on the same line as `discuss:` — this project's own convention
        # never writes one, but a value is a value.
        return True
    if value == "{}":
        return False
    # Nothing after the colon: content, if any, is an indented block on the lines that follow.
    # `discuss: {}` (caught above) is the only empty shape this project's analyze/SKILL.md
    # documents; a bare `discuss:` with nothing after it and no indented line following is
    # equally empty, and check-stage-delivery.py's own frontmatter reader treats that the same
    # way — this function has to be consistent with it, not invent a third answer.
    lines = front.group(1).splitlines()
    at = lines.index(next(l for l in lines if l.startswith("discuss:")))
    for line in lines[at + 1:]:
        if not line.strip():
            continue
        return line[:1] in (" ", "\t")
    return False


def predecessor_of(target_stage, feature_dir):
    idx = STAGE_ORDER.index(target_stage)
    for candidate in reversed(STAGE_ORDER[:idx]):
        if candidate == "discuss" and not discuss_applies(feature_dir):
            continue
        return candidate
    return None


def main():
    try:
        payload = json.load(sys.stdin)
    except (ValueError, json.JSONDecodeError):
        return 0  # unreadable input is not this hook's to refuse over

    tool_input = payload.get("tool_input") or {}
    skill = tool_input.get("skill", "")
    args = tool_input.get("args", "") or ""

    stage = skill.split(":")[-1] if ":" in skill else skill
    if stage not in STAGES_WITH_PREDECESSOR:
        return 0

    project_dir = pathlib.Path(payload.get("cwd") or find_project_dir())
    try:
        root = resolve_root(project_dir)
    except RootRefused as e:
        sys.stderr.write(str(e) + "\n")
        return 2

    feature_dir = resolve_feature_dir(project_dir, args, root)
    if feature_dir is None:
        # No identifiable target: refusing here would be a guess, and AC7 covers a known
        # predecessor gap, not "the invocation was unparseable" — fail open.
        return 0

    predecessor = predecessor_of(stage, feature_dir)
    if predecessor is None:
        return 0

    checker = pathlib.Path(__file__).parent / "check-stage-delivery.py"
    import subprocess
    result = subprocess.run(
        [sys.executable, str(checker), str(feature_dir), predecessor],
        capture_output=True, text=True)
    if result.returncode == 0:
        return 0

    sys.stderr.write(result.stdout)
    return 2


if __name__ == "__main__":
    sys.exit(main())
