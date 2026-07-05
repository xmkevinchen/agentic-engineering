#!/usr/bin/env python3
"""graph-lint.py — machine-verifiable lint over knowledge-graph edges (F-069 Step 2).

Checks the MACHINE half of edge trust (conclusion #4: machines measure, LLM judges):
  - frontmatter parses; `edges:` is a list of mappings
  - per edge: required fields (kind, id, written_by; source required for relates_to),
    kind/written_by in enum, target id well-formed AND resolves in the tree,
    source `path:line` resolves inside the node's own dir
  - whole-tree mode only: duplicate node ids, orphan nodes (a node id participating
    in zero edges — no outgoing edges and never referenced; legacy depends_on /
    origin_bl are NOT edges, they migrate in Plan 2)
NEVER judges semantic correctness — a resolving, in-enum, obviously-wrong
relationship passes (AC2 fourth fixture); that half belongs to the review judge.

Usage: graph-lint.py [--root DIR] [--synthesis-root DIR] [--repo-root DIR] [NODE_DIR ...]
  --root            features root (default: $FEATURES_ROOT or .ae/features)
  --synthesis-root  synthesis pages dir (default: <root>/../graph/synthesis;
                    missing dir = silently skipped). Whole-tree mode only:
                    each page runs graph-page-check.py — its STALE lines pass
                    through without affecting exit, its DEFECTs fail the tree.
  --repo-root       anchor resolution base forwarded to the page check
                    (default: the page check's own git-toplevel fallback)
  NODE_DIR   scoped mode: lint only these nodes' edges (the /ae:review archive
             gate's shape); skips whole-graph checks (orphan, duplicate id,
             synthesis pages)
Target resolution (within --root): F-NNN → */F-NNN-*/ dir; BL-NNN → BL-NNN*.md
under root or <root>/../backlog; disc-NNN → any */discussions/NNN-*/ dir.
Exit: 0 = clean | 1 = defects (each named on stdout) | 2 = usage error.
"""
import argparse
import os
import re
import subprocess
import sys

import yaml

import graph_common
from graph_common import KIND_ENUM, WRITER_ENUM, STATE_DIRS

if __name__ != "__main__":
    raise SystemExit("graph-lint.py is subprocess-only; do not import")


def frontmatter(path):
    """Return (data, error). data is the parsed YAML mapping or None on error."""
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except OSError as e:
        return None, f"unreadable: {e}"
    # \n? — a closing --- with no trailing newline must parse the same way
    # graph-index-gen accepts it (regex mismatch falsely blocked archives)
    m = re.match(r"^---\n(.*?)\n---\n?", text, re.S)
    if not m:
        return None, "no frontmatter block"
    try:
        data = yaml.safe_load(m.group(1))
    except yaml.YAMLError as e:
        return None, f"unparseable YAML frontmatter: {str(e).splitlines()[0]}"
    if not isinstance(data, dict):
        return None, "frontmatter is not a mapping"
    return data, None


def discover_nodes(root):
    """Yield (node_dir, index_path) for every feature node under root."""
    for state in STATE_DIRS:
        state_dir = os.path.join(root, state)
        if not os.path.isdir(state_dir):
            continue
        for name in sorted(os.listdir(state_dir)):
            node_dir = os.path.join(state_dir, name)
            index = os.path.join(node_dir, "index.md")
            if name.startswith("F-") and os.path.isfile(index):
                yield node_dir, index


def build_resolvers(root, synthesis_root):
    """One tree scan via graph_common.build_node_map — id→(class, path) plus
    id→[paths] for duplicate detection. The node abstraction (class+path)
    replaces the old per-class sets so file-shaped syn pages and dir-shaped
    feature nodes resolve through the same map."""
    return graph_common.build_node_map(root, synthesis_root)


def check_source(node_dir, source):
    """Validate `path:line` provenance stays inside node_dir and resolves."""
    if not isinstance(source, str) or ":" not in source:
        return f"source '{source}' is not 'path:line'"
    path_part, _, line_part = source.rpartition(":")
    if not line_part.isdigit() or int(line_part) < 1:
        return f"source '{source}' has no valid line number"
    if os.path.isabs(path_part):
        return f"source '{source}' is absolute; must be relative to the node dir"
    resolved = os.path.realpath(os.path.join(node_dir, path_part))
    if not (resolved + os.sep).startswith(os.path.realpath(node_dir) + os.sep):
        return f"source '{source}' escapes the node dir"
    if not os.path.isfile(resolved):
        return f"source '{source}' file does not exist"
    with open(resolved, encoding="utf-8") as f:
        n_lines = sum(1 for _ in f)
    if int(line_part) > n_lines:
        return f"source '{source}' line beyond EOF ({n_lines} lines)"
    return None


def lint_node(node_dir, index, node_map, defects, src_class="F"):
    """Lint one node's edges. Returns (node_id, referenced_ids, has_edges)."""
    rel = os.path.basename(node_dir)
    data, err = frontmatter(index)
    if err:
        defects.append(f"{rel}: {err}")
        return None, set(), False
    node_id = data.get("id")
    edges = data.get("edges")
    if edges is None:
        if "edges" in data:  # `edges:` present but null must not bypass validation
            defects.append(f"{rel}: 'edges' key present but null — remove the key or provide a list")
        return node_id, set(), False
    if not isinstance(edges, list):
        defects.append(f"{rel}: 'edges' must be a list of mappings, got {type(edges).__name__}")
        return node_id, set(), False
    referenced = set()
    for i, edge in enumerate(edges, 1):
        where = f"{rel} edge {i}"
        if not isinstance(edge, dict):
            defects.append(f"{where}: not a mapping ({edge!r})")
            continue
        kind = edge.get("kind")
        target = edge.get("id")
        writer = edge.get("written_by")
        # non-scalar values (e.g. `kind: [relates_to]`) must be named
        # defects, not a TypeError on set membership
        if kind is None:
            defects.append(f"{where}: missing required field 'kind'")
        elif not isinstance(kind, str) or kind not in KIND_ENUM:
            defects.append(f"{where}: kind '{kind}' not in enum {sorted(KIND_ENUM)}")
        if writer is None:
            defects.append(f"{where}: missing required field 'written_by'")
        elif not isinstance(writer, str) or writer not in WRITER_ENUM:
            defects.append(f"{where}: written_by '{writer}' not in enum {sorted(WRITER_ENUM)}")
        if target is None:
            defects.append(f"{where}: missing required field 'id'")
        else:
            target = str(target)
            tgt_class = graph_common.classify_id(target)
            if tgt_class is None:
                defects.append(f"{where}: unclassifiable target id '{target}' "
                               f"(expected {graph_common.ID_HINT})")
            else:
                referenced.add(target)
                if target not in node_map or node_map[target][0] != tgt_class:
                    defects.append(f"{where}: dangling target '{target}' (no such {tgt_class} node)")
                if isinstance(kind, str) and kind in KIND_ENUM:
                    legality = graph_common.kind_legality_defect(kind, src_class, tgt_class)
                    if legality:
                        defects.append(f"{where}: {legality}")
        source = edge.get("source")
        if source is None:
            if kind == "relates_to":
                defects.append(f"{where}: relates_to missing required 'source' provenance")
        else:
            src_err = check_source(node_dir, source)
            if src_err:
                defects.append(f"{where}: {src_err}")
    return node_id, referenced, len(edges) > 0


parser = argparse.ArgumentParser(add_help=True)
parser.add_argument("--root", default=os.environ.get("FEATURES_ROOT", ".ae/features"))
parser.add_argument("--synthesis-root", default=None)
parser.add_argument("--repo-root", default=None)
parser.add_argument("--log-validations", action="store_true",
                    help="append one 'check' record per synthesis page to the graph "
                         "log — gives unread pages durable freshness telemetry "
                         "(off by default: lint stays read-only unless asked)")
parser.add_argument("nodes", nargs="*", help="scoped mode: node dirs to lint")
try:
    args = parser.parse_args()
except SystemExit:
    sys.exit(2)

root = os.path.realpath(args.root)
if not os.path.isdir(root):
    print(f"[graph-lint] usage error: no such root: {args.root}", file=sys.stderr)
    sys.exit(2)

# synthesis root resolves up front: BOTH modes need it for syn target
# resolution (scoped mode previously never saw it — page targets couldn't
# resolve from the archive gate's shape)
syn_root = args.synthesis_root or os.path.join(root, os.pardir, "graph", "synthesis")
syn_root = os.path.realpath(syn_root)

node_map, all_paths = build_resolvers(root, syn_root)
defects = []

if args.nodes:  # scoped mode — the archive gate's shape; no whole-graph checks
    for node_dir in args.nodes:
        index = os.path.join(node_dir, "index.md")
        if not os.path.isfile(index):
            print(f"[graph-lint] usage error: no index.md in {node_dir}", file=sys.stderr)
            sys.exit(2)
        lint_node(node_dir, index, node_map, defects)
    scope = f"scoped ({len(args.nodes)} node(s))"
else:  # whole-tree mode
    id_dirs = {}       # node id → [dirs] (duplicate detection)
    outgoing = set()   # node ids with ≥1 edge
    referenced = set() # ids that appear as any edge's target
    nodes = list(discover_nodes(root))
    for node_dir, index in nodes:
        node_id, refs, has_edges = lint_node(node_dir, index, node_map, defects)
        referenced |= refs
        if node_id:
            id_dirs.setdefault(node_id, []).append(os.path.basename(node_dir))
            if has_edges:
                outgoing.add(node_id)
    for node_id, dirs in sorted(id_dirs.items()):
        if len(dirs) > 1:
            defects.append(f"duplicate node id {node_id}: {', '.join(sorted(dirs))} (resolution nondeterministic)")
    # path-level duplicates for the unambiguous-by-design classes. F ids come
    # from dir names (frontmatter dups caught above), syn ids from page files.
    # disc is EXCLUDED by design — discussion numbering is per-feature, so
    # disc-NNN is inherently ambiguous (known id-scheme limit); BL collisions
    # are backlog-numbering hygiene, guarded at capture time, not here.
    for nid, paths in sorted(all_paths.items()):
        if len(paths) > 1 and graph_common.classify_id(nid) in ("F", "syn") \
                and nid not in id_dirs:
            defects.append(f"duplicate node id {nid}: {len(paths)} paths (resolution nondeterministic)")
    orphans = [n for n in sorted(id_dirs)
               if n not in outgoing and n not in referenced]
    scope = f"whole-tree ({len(nodes)} node(s))"
    # synthesis pages: leaf nodes with anchors, checked by the single page-check
    # implementation; a missing dir is the normal no-synthesis-layer case
    if os.path.isdir(syn_root):
        checker = os.path.join(os.path.dirname(os.path.realpath(__file__)),
                               "graph-page-check.py")
        # anchors are repo-relative; derive the repo root from the synthesis dir's
        # position (.ae/graph/synthesis → three levels up) so the check is correct
        # no matter what cwd graph-lint runs from
        repo_root = args.repo_root or os.path.normpath(
            os.path.join(syn_root, os.pardir, os.pardir, os.pardir))
        pages = sorted(f for f in os.listdir(syn_root) if f.endswith(".md"))
        for f in pages:
            cmd = [sys.executable, checker, "--repo-root", repo_root,
                   os.path.join(syn_root, f)]
            proc = subprocess.run(cmd, capture_output=True, text=True)
            found_defect = False
            for line in proc.stdout.splitlines():
                if line.startswith("[page-check] DEFECT:"):
                    found_defect = True
                    defects.append(line.split("DEFECT:", 1)[1].strip())
                elif line.startswith("[page-check] STALE:"):
                    print(f"[graph-lint] STALE: {line.split('STALE:', 1)[1].strip()}")
            # a checker that failed without reporting (crash, usage error) must
            # not let the tree pass silently
            if proc.returncode != 0 and not found_defect:
                defects.append(f"synthesis page {f}: check failed "
                               f"(exit {proc.returncode}) with no reported defect")
            if args.log_validations:
                verdict = proc.stdout.splitlines()[-1].split(": ")[-1] if proc.stdout else "unknown"
                import datetime
                stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                with open(os.path.join(os.path.dirname(syn_root), "log.md"),
                          "a", encoding="utf-8") as lf:
                    lf.write(f"- {stamp} check: {f[:-3]} {verdict}\n")
        scope += f" + {len(pages)} synthesis page(s)"

orphans = orphans if "orphans" in dir() else []
for d in defects:
    print(f"[graph-lint] DEFECT: {d}")
for n in orphans:
    # observation class, not a defect — but it still fails the whole-tree gate
    # so an unreviewed orphan cannot pass silently
    print(f"[graph-lint] ORPHAN: {n}: participates in zero edges")
print(f"[graph-lint] {scope}: {len(defects)} defect(s), {len(orphans)} orphan(s)")
sys.exit(1 if (defects or orphans) else 0)
