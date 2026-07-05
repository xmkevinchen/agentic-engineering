#!/usr/bin/env python3
"""graph-render-docs.py — human-facing architecture view from the topology (F-076).

Renders the synthesis-page network (syn↔syn structural edges + the features
documented_by each page) into ONE git-tracked markdown page: a mermaid
component diagram plus a per-component section linking back to the page that
holds the anchored understanding. The reader needs zero AE context — the doc
explains itself.

Deterministic and byte-idempotent: sorted traversal, no timestamps — running
it twice produces identical bytes (regeneration is safe to automate). Stale
pages render WITH their state marked; the doc never hides rot.

Usage: graph-render-docs.py [--features-root DIR] [--synthesis-root DIR] [--out FILE]
Exit: 0 = written (or nothing to render — writes the empty-state doc) | 2 = usage.
"""
import argparse
import os
import re
import subprocess
import sys

import yaml

import graph_common

if __name__ != "__main__":
    raise SystemExit("graph-render-docs.py is subprocess-only; do not import")

parser = argparse.ArgumentParser()
parser.add_argument("--features-root",
                    default=os.environ.get("FEATURES_ROOT", ".ae/features"))
parser.add_argument("--synthesis-root", default=None)
parser.add_argument("--repo-root", default=None,
                    help="anchor resolution base for the live page check "
                         "(default: three up from the synthesis dir)")
parser.add_argument("--out", default="docs/architecture-graph.md")
try:
    args = parser.parse_args()
except SystemExit:
    sys.exit(2)

root = os.path.realpath(args.features_root)
if not os.path.isdir(root):
    print(f"[render-docs] usage error: no such features root: {args.features_root}",
          file=sys.stderr)
    sys.exit(2)
syn_root = os.path.realpath(args.synthesis_root) if args.synthesis_root \
    else graph_common.default_synthesis_root(root)

repo_root = os.path.realpath(args.repo_root) if args.repo_root \
    else os.path.normpath(os.path.join(syn_root, os.pardir, os.pardir, os.pardir))
checker = os.path.join(os.path.dirname(os.path.realpath(__file__)),
                       "graph-page-check.py")

node_map, _ = graph_common.build_node_map(root, syn_root)
pages = {}  # syn id → {title, state, edges}
for nid in sorted(node_map):
    cls, path = node_map[nid]
    if cls != "syn":
        continue
    try:
        text = open(path, encoding="utf-8").read()
        m = re.match(r"^---\n(.*?)\n---\n?", text, re.S)
        data = yaml.safe_load(m.group(1)) if m else None
    except (OSError, yaml.YAMLError):
        continue
    if not isinstance(data, dict):
        continue
    # the state is COMPUTED live (page-check), never the stored label — the
    # frontmatter label is a navigation hint no write path keeps current, so
    # rendering it verbatim would let a drifted page show "fresh" forever
    # ("the doc never hides rot" needs a mechanism, not discipline)
    proc = subprocess.run(
        [sys.executable, checker, "--repo-root", repo_root,
         "--features-root", root, path],
        capture_output=True, text=True)
    verdict = proc.stdout.strip().rsplit(": ", 1)[-1] if proc.stdout else "unknown"
    pages[nid] = {"title": str(data.get("title", nid)),
                  "state": verdict,
                  "edges": [e for e in (data.get("edges") or [])
                            if isinstance(e, dict) and e.get("id")]}

# features documenting each page (inbound documented_by)
documented_by = {}  # syn id → [feature ids]
for tgt, srcs in graph_common.build_inbound_index(node_map).items():
    if tgt in pages:
        for src, e in srcs:
            if e.get("kind") == "documented_by":
                documented_by.setdefault(tgt, []).append(src)


def mermaid_id(nid):
    return nid.replace("-", "_")


def mermaid_label(text):
    """Free-text titles are unconstrained YAML — a double-quote inside a
    quoted mermaid label silently breaks rendering (exit 0, blank diagram)."""
    return text.replace('"', "'")


out_lines = [
    "# Architecture graph",
    "",
    "A generated map of this project's high-level design: each component is a",
    "*synthesis page* — a short document whose every claim cites a specific line",
    "of code or docs, and a checker re-verifies those citations still hold (a",
    "page whose cited lines changed is marked stale). Arrows are typed",
    "relationships read from the pages themselves. Component names are the",
    "pages' own titles — open a component's page for the grounded detail behind",
    "every term it uses. Regenerate with `plugins/ae/bin/graph-render-docs.py`;",
    "do not edit by hand.",
    "",
]

if not pages:
    out_lines += ["*(No synthesis pages exist yet — the graph has nothing to render.)*", ""]
else:
    out_lines += ["```mermaid", "graph LR",
                  "    classDef stale fill:#f6d5a8,stroke:#c77d2e"]
    for pid in sorted(pages):
        p = pages[pid]
        label = mermaid_label(
            p["title"] if p["state"] == "fresh" else f"{p['title']} [{p['state']}]")
        suffix = f":::{'stale'}" if p["state"] != "fresh" else ""
        out_lines.append(f'    {mermaid_id(pid)}["{label}"]{suffix}')
    for pid in sorted(pages):
        for e in sorted(pages[pid]["edges"], key=lambda e: (str(e.get("id")), str(e.get("kind")))):
            tgt = str(e["id"])
            if tgt in pages:  # syn↔syn structure only — feature links live below
                out_lines.append(
                    f"    {mermaid_id(pid)} -->|{e.get('kind', '')}| {mermaid_id(tgt)}")
    out_lines += ["```", ""]

    out_lines += ["## Components", ""]
    for pid in sorted(pages):
        p = pages[pid]
        state_note = "" if p["state"] == "fresh" else f" — **{p['state']}** (anchors drifted; re-sync pending)"
        out_lines.append(f"### {p['title']}{state_note}")
        out_lines.append("")
        out_lines.append(f"Page: [`{pid}`](../.ae/graph/synthesis/{pid}.md)")
        feats = sorted(set(documented_by.get(pid, [])))
        if feats:
            out_lines.append(f"Documented for: {', '.join(feats)}")
        rels = [f"{e.get('kind')} → {e['id']}" for e in
                sorted(p["edges"], key=lambda e: (str(e.get("id")), str(e.get("kind"))))]
        if rels:
            out_lines.append(f"Relationships: {'; '.join(rels)}")
        out_lines.append("")

out_path = os.path.realpath(args.out)
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w", encoding="utf-8") as f:
    f.write("\n".join(out_lines).rstrip("\n") + "\n")
print(f"[render-docs] {len(pages)} component(s) → {out_path}")
sys.exit(0)
