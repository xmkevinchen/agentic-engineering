#!/usr/bin/env python3
"""graph-page-check.py — the single anchor-check implementation for synthesis pages.

A synthesis page persists high-level design understanding; every claim anchors
into the working tree (path:line + whitespace-normalized line snapshot) and
optionally into history (immutable commit id). This checker proves the MACHINE
half only — anchors resolve and the anchored lines still read as written; the
semantic truth of the page belongs to the review judge and the human.

Three states per page:
  fresh  — every anchor's path:line resolves and its normalized text matches
  stale  — all paths resolve, but at least one anchored line's text changed
           (semantic drift suspected; the page needs a human/LLM re-look)
  DEFECT — a path is gone, a line is beyond EOF, a commit does not resolve,
           or the page's own frontmatter violates the contract

Contract enforced on the page itself: basename (minus .md) == frontmatter id;
id shaped syn-<slug>; required fields id/title/created/written_by/state;
anchors is a non-empty list of {source: "path:line", anchor_hash, commit?}.

Usage: graph-page-check.py [--repo-root DIR] PAGE.md
  --repo-root  anchor resolution base (default: git toplevel of cwd, else cwd)
Output: one line per failing anchor (STALE:/DEFECT: prefixed) + a final
verdict line. Exit: 0 = fresh or stale-only | 1 = any DEFECT | 2 = usage.
"""
import argparse
import os
import re
import subprocess
import sys

import yaml

import graph_common
from graph_common import SYN_ID_RE as ID_RE

REQUIRED = ("id", "title", "created", "written_by", "state")

if __name__ != "__main__":
    raise SystemExit("graph-page-check.py is subprocess-only; do not import")


def norm(line):
    return re.sub(r"\s+", " ", line.strip())


def resolve_repo_source(source, repo_root):
    """Resolve a repo-root-relative 'path:line' reference.

    Returns (error, lines, line_no): error is the defect string (no location
    prefix) or None; on success `lines` is the file's line list and `line_no`
    the 1-based line. ONE implementation for both anchors and page edges —
    duplicated resolution logic is how line-number drift slips in."""
    if not isinstance(source, str) or ":" not in source:
        return f"source '{source}' is not 'path:line'", None, None
    path_part, _, line_part = source.rpartition(":")
    if not line_part.isdigit() or int(line_part) < 1:
        return f"source '{source}' has no valid line number", None, None
    if os.path.isabs(path_part):
        return f"source '{source}' is absolute; must be repo-relative", None, None
    resolved = os.path.realpath(os.path.join(repo_root, path_part))
    if not (resolved + os.sep).startswith(repo_root + os.sep):
        return f"source '{source}' escapes the repo root", None, None
    if not os.path.isfile(resolved):
        return f"source '{source}' file does not exist", None, None
    try:
        with open(resolved, encoding="utf-8", errors="replace") as f:
            lines = f.read().splitlines()
    except OSError as e:
        return f"source '{source}' unreadable: {e}", None, None
    ln = int(line_part)
    if ln > len(lines):
        return f"source '{source}' line beyond EOF ({len(lines)} lines)", None, None
    return None, lines, ln


parser = argparse.ArgumentParser()
parser.add_argument("--repo-root", default=None)
parser.add_argument("--features-root", default=None,
                    help="features tree for edge-target resolution (default: "
                         "<page-dir>/../../../features — the .ae/graph/synthesis "
                         "→ .ae/features layout)")
parser.add_argument("page")
try:
    args = parser.parse_args()
except SystemExit:
    sys.exit(2)

repo_root = args.repo_root
if repo_root is None:
    proc = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                          capture_output=True, text=True)
    repo_root = proc.stdout.strip() if proc.returncode == 0 else os.getcwd()
repo_root = os.path.realpath(repo_root)

page = os.path.realpath(args.page)
if not os.path.isfile(page):
    print(f"[page-check] usage error: no such page: {args.page}", file=sys.stderr)
    sys.exit(2)

name = os.path.basename(page)
page_id = name[:-3] if name.endswith(".md") else name
defects = []
stale = []

try:
    with open(page, encoding="utf-8") as f:
        text = f.read()
except OSError as e:
    defects.append(f"unreadable: {e}")
    text = ""

m = re.match(r"^---\n(.*?)\n---\n?", text, re.S)
data = None
if text and not m:
    defects.append("no frontmatter block")
elif text:
    try:
        data = yaml.safe_load(m.group(1))
    except yaml.YAMLError as e:
        defects.append(f"unparseable YAML frontmatter: {str(e).splitlines()[0]}")
    if data is not None and not isinstance(data, dict):
        defects.append("frontmatter is not a mapping")
        data = None

anchors = []
if data is not None:
    for field in REQUIRED:
        if not data.get(field):
            defects.append(f"missing required frontmatter field '{field}'")
    fid = data.get("id")
    if fid and not ID_RE.match(str(fid)):
        defects.append(f"id '{fid}' not shaped syn-<slug>")
    if fid and str(fid) != page_id:
        defects.append(f"frontmatter id '{fid}' does not match basename '{page_id}'")
    anchors = data.get("anchors")
    if not isinstance(anchors, list) or not anchors:
        defects.append("anchors must be a non-empty list")
        anchors = []

for i, a in enumerate(anchors, 1):
    where = f"anchor {i}"
    if not isinstance(a, dict):
        defects.append(f"{where}: not a mapping ({a!r})")
        continue
    source = a.get("source")
    ahash = a.get("anchor_hash")
    commit = a.get("commit")
    err, lines, ln = resolve_repo_source(source, repo_root)
    if err:
        defects.append(f"{where}: {err}")
        continue
    if not isinstance(ahash, str) or not ahash.strip():
        defects.append(f"{where}: missing anchor_hash")
    elif norm(lines[ln - 1]) != norm(ahash):
        stale.append(f"{where}: source '{source}' anchored line changed")
    if commit is not None:
        proc = subprocess.run(["git", "-C", repo_root, "cat-file", "-e", str(commit)],
                              capture_output=True)
        if proc.returncode != 0:
            defects.append(f"{where}: commit '{commit}' does not resolve")

# ---- page edges (F-076: pages are edge-bearing, leaf-only ended) -------------
# Validated through the same shared core as feature-node edges, so the same
# bad edge produces the identical named defect from lint and page-check.
edges = data.get("edges") if isinstance(data, dict) else None
if edges is not None or (isinstance(data, dict) and "edges" in data):
    syn_dir = os.path.dirname(page)
    features_root = args.features_root or os.path.normpath(
        os.path.join(syn_dir, os.pardir, os.pardir, "features"))
    node_map, _ = graph_common.build_node_map(features_root, syn_dir)
    if edges is None:  # `edges:` present but null must not bypass validation
        defects.append("'edges' key present but null — remove the key or provide a list")
        edges = []
    elif not isinstance(edges, list):
        defects.append(f"'edges' must be a list of mappings, got {type(edges).__name__}")
        edges = []

    for i, edge in enumerate(edges, 1):
        # page-edge provenance is repo-root-relative — the SAME resolver as
        # anchors, so both drift the same way and are fixed in one place
        defs, _ref = graph_common.validate_edge(
            edge, "syn", node_map,
            source_check=lambda s: resolve_repo_source(s, repo_root)[0])
        for d in defs:
            defects.append(f"edge {i}: {d}")

for d in defects:
    print(f"[page-check] DEFECT: {page_id} {d}")
for s in stale:
    print(f"[page-check] STALE: {page_id} {s}")
verdict = "DEFECT" if defects else ("stale" if stale else "fresh")
stored = data.get("state") if isinstance(data, dict) else None
if stored and verdict != "DEFECT" and stored != verdict:
    # the frontmatter label is a navigation hint; when it disagrees with the
    # computed verdict, say so instead of silently ignoring a human's edit
    print(f"[page-check] NOTE: {page_id} frontmatter state '{stored}' != computed '{verdict}'")
print(f"[page-check] {page_id}: {verdict}")
sys.exit(1 if defects else 0)
