#!/usr/bin/env python3
"""Resolve the configured artifact root out of a pipeline.yml.

One reader, used by every consumer that needs to know where feature artifacts live —
`check-invocation-order.py`, `go-leash.sh`, and (as prose) `analyze/SKILL.md`. Follows
`read-family-table.py`'s own rule: one parser, so two callers hand-rolling their own reading is
not how this drifts apart.

Prints the resolved, project-relative root (no trailing slash) to stdout and exits 0. An absent
file and an absent `artifact_root:` key both mean the default, `.ae`, and are not errors — that
is what keeps an unconfigured project's behavior unchanged.

A *present* value is rejected, rather than silently defaulted, when it is:
  - empty (`artifact_root: ""` or nothing after the colon),
  - an absolute path (a leading `/`),
  - a path containing a `..` segment (escapes the project directory), or
  - not a plain scalar (a flow mapping or sequence).

usage: read-artifact-root.py [<pipeline.yml>]   (default: .claude/pipeline.yml)
exit 0: the resolved root, printed to stdout.
exit 2: a message on stderr naming `artifact_root` and the offending value.
"""
import re
import sys

DEFAULT_ROOT = ".ae"
KEY = re.compile(r"^artifact_root:[ \t]*(.*)$", re.M)


class Malformed(ValueError):
    pass


def _unquote_or_strip_comment(raw: str) -> str:
    """A quoted scalar keeps everything between its quotes, comment markers included.
    An unquoted scalar ends at the first `#`."""
    if raw[:1] in "\"'":
        quote = raw[0]
        end = raw.find(quote, 1)
        if end != -1:
            return raw[1:end]
        return raw  # unterminated quote; falls through to normal validation unquoted
    return raw.split("#", 1)[0].strip()


def resolve(path: str) -> str:
    try:
        text = open(path, encoding="utf-8").read()
    except OSError:
        return DEFAULT_ROOT

    match = KEY.search(text)
    if not match:
        return DEFAULT_ROOT

    raw = match.group(1).strip()
    if not raw:
        raise Malformed("artifact_root: is present but empty")

    value = _unquote_or_strip_comment(raw).strip()

    # Emptiness first: `value[:1]` on an empty string is `""`, and `"" in "{["` is True (an empty
    # string is a substring of everything), so checking the mapping/sequence shape before
    # emptiness misdiagnoses an empty value as "a mapping or sequence".
    if not value:
        raise Malformed("artifact_root: is present but empty")
    if value[0] in "{[":
        raise Malformed(f"artifact_root: {raw!r} is a mapping or sequence, not a scalar path")

    normalized = value.rstrip("/")
    if not normalized:
        raise Malformed(f"artifact_root: {value!r} resolves to an empty path")
    if normalized.startswith("/"):
        raise Malformed(
            f"artifact_root: {value!r} is an absolute path; it must be project-relative")
    if any(part == ".." for part in normalized.split("/")):
        raise Malformed(
            f"artifact_root: {value!r} contains a '..' segment, which escapes the project "
            "directory")

    return normalized


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else ".claude/pipeline.yml"
    try:
        root = resolve(path)
    except Malformed as e:
        print(f"read-artifact-root: {e}", file=sys.stderr)
        return 2
    print(root)
    return 0


if __name__ == "__main__":
    sys.exit(main())
