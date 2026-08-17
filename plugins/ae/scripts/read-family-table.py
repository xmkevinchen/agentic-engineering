#!/usr/bin/env python3
"""Parse `cross_family` out of a pipeline.yml into one JSON object per line.

One parser, used by every consumer. Two shell scripts each hand-rolling their own YAML
reading is how the declarations drift apart — the defect class this table exists to reduce.

Accepted entry forms:

    label: { seat: codex, family: openai }                  # flow mapping (canonical)
    label: { seat: openai-compat, family: qwen, host: local,
             endpoint: "http://…", model: "…" }             # may wrap across lines
    label: true | false                                     # legacy boolean, still read

Legacy booleans are translated to `{seat: <label>, family: <label>, legacy: true}` so a
project that has not migrated still reports rather than vanishing. `enabled: false` marks an
entry disabled; presence otherwise means enabled.

usage: read-family-table.py [<pipeline.yml>]        (default: .claude/pipeline.yml)
       --enabled-only        skip entries with enabled: false
exit 0 with zero lines when the key is absent; exit 2 if the file cannot be read.
"""
import json
import re
import sys

FLOW = re.compile(r"^\s{2}([A-Za-z0-9_.-]+):\s*\{(.*)$")
BOOL = re.compile(r"^\s{2}([A-Za-z0-9_.-]+):\s*(true|false)\s*(?:#.*)?$")
PAIR = re.compile(r"([A-Za-z0-9_.-]+)\s*:\s*(\"[^\"]*\"|'[^']*'|[^,{}]+)")


def unquote(v: str) -> str:
    v = v.strip().rstrip(",").strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    return v


def parse(path: str):
    try:
        lines = open(path, encoding="utf-8").read().splitlines()
    except OSError as e:
        print(f"read-family-table: cannot read {path}: {e}", file=sys.stderr)
        raise SystemExit(2)

    out, inside, buf, label = [], False, None, None
    for raw in lines:
        line = raw.split("#", 1)[0].rstrip() if not buf else raw.rstrip()
        if re.match(r"^cross_family:\s*$", line):
            inside = True
            continue
        if inside and line and not line.startswith(" "):
            break                                   # dedent ends the block
        if not inside:
            continue

        if buf is not None:                         # continuing a wrapped flow mapping
            buf += " " + line.strip()
            if "}" in line:
                out.append((label, buf))
                buf, label = None, None
            continue

        m = FLOW.match(line)
        if m:
            label, rest = m.group(1), m.group(2)
            if "}" in rest:
                out.append((label, rest))
            else:
                buf = rest
            continue

        m = BOOL.match(line)
        if m and m.group(2) == "true":
            out.append((m.group(1), "__legacy__"))
        elif m:
            out.append((m.group(1), "__legacy_disabled__"))

    entries = []
    for label, body in out:
        if body.startswith("__legacy"):
            entries.append({
                "label": label, "seat": label, "family": label,
                "legacy": True, "enabled": body == "__legacy__",
            })
            continue
        body = body.split("}", 1)[0]
        e = {"label": label, "enabled": True, "legacy": False}
        for k, v in PAIR.findall(body):
            e[k] = unquote(v)
        e["enabled"] = str(e.get("enabled", "true")).lower() != "false"
        entries.append(e)
    return entries


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    enabled_only = "--enabled-only" in sys.argv
    path = args[0] if args else ".claude/pipeline.yml"
    for e in parse(path):
        if enabled_only and not e["enabled"]:
            continue
        print(json.dumps(e, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
