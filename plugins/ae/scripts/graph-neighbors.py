#!/usr/bin/env python3
"""graph-neighbors.py — edge-traversal helper for the knowledge graph (F-069 Step 5).

The ONE real traversal implementation shared by the analyze cold-start
locate-step (SKILL.md prose invokes it) and the AC5a/AC6 tests — removing the
sim-vs-real gap (plan Design note 4). Deterministic: reads `edges:` frontmatter
lists only; which neighbor is USEFUL stays LLM judgment at the call site.

Usage: graph-neighbors.py [--root DIR] [--hops N] <start-id> [<start-id> ...]
Output: one line per reached edge: `<target-id>\t<kind>\t<from-id>\t<evidence>`
Exit: 0 = ok (zero lines is a valid result) | 2 = usage (bad root / unknown start id).
"""
import argparse
import os
import re
import sys

import yaml

STATE_DIRS = ("active", "done", "abandoned", "paused")

if __name__ != "__main__":
    raise SystemExit("graph-neighbors.py is subprocess-only; do not import")

parser = argparse.ArgumentParser()
parser.add_argument("--root", default=os.environ.get("FEATURES_ROOT", ".ae/features"))
parser.add_argument("--hops", type=int, default=1)
parser.add_argument("starts", nargs="+")
try:
    args = parser.parse_args()
except SystemExit:
    sys.exit(2)

root = os.path.realpath(args.root)
if not os.path.isdir(root):
    print(f"[graph-neighbors] usage error: no such root: {args.root}", file=sys.stderr)
    sys.exit(2)

edges_by_id = {}  # node id → list of edge dicts
for state in STATE_DIRS:
    state_dir = os.path.join(root, state)
    if not os.path.isdir(state_dir):
        continue
    for name in sorted(os.listdir(state_dir)):
        index = os.path.join(state_dir, name, "index.md")
        if not (name.startswith("F-") and os.path.isfile(index)):
            continue
        try:
            with open(index, encoding="utf-8") as f:
                # \n? matches graph-lint/graph-index-gen (regex parity)
                m = re.match(r"^---\n(.*?)\n---\n?", f.read(), re.S)
            data = yaml.safe_load(m.group(1)) if m else None
        except (OSError, yaml.YAMLError):
            continue  # unparseable nodes are graph-lint's job, not traversal's
        if isinstance(data, dict) and data.get("id"):
            edges = data.get("edges")
            edges_by_id[str(data["id"])] = edges if isinstance(edges, list) else []

unknown = [s for s in args.starts if s not in edges_by_id]
if unknown:
    print(f"[graph-neighbors] usage error: unknown (or unparseable — run graph-lint.py) start id(s): {', '.join(unknown)}", file=sys.stderr)
    sys.exit(2)

frontier, seen = list(args.starts), set(args.starts)
for _ in range(max(args.hops, 0)):
    next_frontier = []
    for node_id in frontier:
        for edge in edges_by_id.get(node_id, []):
            if not isinstance(edge, dict):
                continue
            target = str(edge.get("id", ""))
            if not target or target in seen:
                continue
            seen.add(target)
            print(f"{target}\t{edge.get('kind', '')}\t{node_id}\t{edge.get('evidence', '')}")
            if target in edges_by_id:  # only feature nodes can be traversed further
                next_frontier.append(target)
    frontier = next_frontier
sys.exit(0)
