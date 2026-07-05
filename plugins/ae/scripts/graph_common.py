#!/usr/bin/env python3
"""graph_common.py — the single home for knowledge-graph kind knowledge (F-076).

Owns every TABLE a graph script needs: the kind enum, the source/target
legality matrix, the reverse-display (inversion) table, id classification,
and the id→(class, path) node map. Validation FLOW stays in each script;
the tables live here so a new kind is added in exactly one file — a second
hardcoded copy of kind knowledge is the divergence bug this module exists
to end.

This is an importable module — the deliberate exception to the graph
scripts' subprocess-only rule (they import it; nothing executes it).
Node classes: F (feature dir), BL (backlog file), disc (discussion dir),
syn (synthesis page file). The class+path pair is the node abstraction
that ends the dir-node vs file-page split.
"""
import os
import re

# ---- kind knowledge (ONE canonical home) -----------------------------------

KIND_ENUM = {
    # feature-family lineage (F-069)
    "origin", "supersedes", "superseded_by", "relates_to", "conflicts_with",
    # topology kinds (F-076): cross-domain + syn↔syn structure
    "documented_by", "part_of", "talks_to",
}

WRITER_ENUM = {"review-archive", "batch", "human"}

# legality matrix: kind → set of (source_class, target_class) pairs.
# None = catch-all (any→any): relates_to / conflicts_with stay unrestricted —
# the relates_to bucket split is deferred by decision (BL-192).
LEGALITY = {
    "origin": {("F", "BL")},
    "supersedes": {("F", "F"), ("BL", "BL"), ("disc", "disc")},
    "superseded_by": {("F", "F"), ("BL", "BL"), ("disc", "disc")},
    "relates_to": None,
    "conflicts_with": None,
    "documented_by": {("F", "syn")},
    "part_of": {("syn", "syn")},
    "talks_to": {("syn", "syn")},
}

# reverse-display labels: what an edge READS AS when traversed backward.
# Directional kinds invert; symmetric kinds read the same both ways.
INVERSE = {
    "origin": "origin-of",
    "supersedes": "superseded_by",
    "superseded_by": "supersedes",
    "relates_to": "relates_to",
    "conflicts_with": "conflicts_with",
    "documented_by": "documents",
    "part_of": "has-part",
    "talks_to": "talks_to",
}

# ---- id classification (dict dispatch — no elif chain) ----------------------

SYN_ID_RE = re.compile(r"^syn-[a-z0-9][a-z0-9-]*$")

_CLASS_PATTERNS = (
    ("F", re.compile(r"^F-\d+$")),
    ("BL", re.compile(r"^BL-\d+$")),
    ("disc", re.compile(r"^disc-\d+$")),
    ("syn", SYN_ID_RE),
)


def classify_id(s):
    """Return the node class for an id, or None for an unknown shape.

    None is a NAMED defect at every consumer — an unknown prefix must never
    silently classify (the latent falls-to-disc elif bug this replaces)."""
    s = str(s)
    for cls, pat in _CLASS_PATTERNS:
        if pat.match(s):
            return cls
    return None


ID_HINT = "F-NNN / BL-NNN / disc-NNN / syn-<slug>"


def kind_legality_defect(kind, src_class, tgt_class):
    """Return a defect string when (kind, src→tgt) violates the matrix, else None.

    Fail-closed: an unknown kind is a defect here too — "no restriction"
    (catch-all) and "not a recognized kind" must never collapse into the same
    return value, even for a caller that skipped the enum gate.
    Wording is shared verbatim by every validating script — identical fixture,
    identical named defect."""
    if kind not in LEGALITY:
        return f"kind '{kind}' not in enum {sorted(KIND_ENUM)}"
    pairs = LEGALITY[kind]
    if pairs is None:  # catch-all kind
        return None
    if (src_class, tgt_class) in pairs:
        return None
    legal = ", ".join(f"{s}→{t}" for s, t in sorted(pairs))
    return (f"kind '{kind}' not legal from {src_class} to {tgt_class} "
            f"(legal: {legal})")


# ---- node map: id → (class, path) -------------------------------------------

STATE_DIRS = ("active", "done", "abandoned", "paused")


def build_node_map(features_root, synthesis_root=None):
    """Scan the tree once; return (node_map, all_paths).

    node_map:  id → (class, path). F nodes point at their index.md (edge-bearing
               file); syn pages at the page file (edge-bearing after F-076
               Step 3); BL at the backlog/feature-resident file; disc at the
               discussion dir.
    all_paths: id → [paths] — every location an id was seen (duplicate-id
               detection input; node_map keeps the first).

    F ids resolve ONLY at state-dir top level with an index.md — the same
    depth the lint enumerates, so "resolves" and "is a real node" stay the
    same guarantee (a coincidentally-named nested dir must not mask a
    dangling target)."""
    node_map = {}
    all_paths = {}

    def put(nid, cls, path):
        all_paths.setdefault(nid, []).append(path)
        node_map.setdefault(nid, (cls, path))

    for state in STATE_DIRS:
        state_dir = os.path.join(features_root, state)
        if not os.path.isdir(state_dir):
            continue
        for name in sorted(os.listdir(state_dir)):
            m = re.match(r"^(F-\d+)-", name)
            idx = os.path.join(state_dir, name, "index.md")
            if m and os.path.isfile(idx):
                put(m.group(1), "F", idx)
    for base, dirs, files in os.walk(features_root):
        if os.path.basename(base) == "discussions":
            for d in sorted(dirs):
                m = re.match(r"^(\d+)-", d)
                if m:
                    put(f"disc-{m.group(1)}", "disc", os.path.join(base, d))
        for f in sorted(files):
            m = re.match(r"^(BL-\d+)", f)
            if m and f.endswith(".md"):
                put(m.group(1), "BL", os.path.join(base, f))
    backlog = os.path.normpath(os.path.join(features_root, os.pardir, "backlog"))
    if os.path.isdir(backlog):
        for base, _dirs, files in os.walk(backlog):
            for f in sorted(files):
                m = re.match(r"^(BL-\d+)", f)
                if m and f.endswith(".md"):
                    put(m.group(1), "BL", os.path.join(base, f))
    if synthesis_root and os.path.isdir(synthesis_root):
        for f in sorted(os.listdir(synthesis_root)):
            if f.endswith(".md") and SYN_ID_RE.match(f[:-3]):
                put(f[:-3], "syn", os.path.join(synthesis_root, f))
    return node_map, all_paths


def default_synthesis_root(features_root):
    """The conventional synthesis dir for a features root (<root>/../graph/synthesis)."""
    return os.path.normpath(
        os.path.join(os.path.realpath(features_root), os.pardir, "graph", "synthesis"))
