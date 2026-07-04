#!/usr/bin/env python3
"""wiki-bootstrap.py — brownfield knowledge-graph bootstrap, deterministic half (F-071).

Three subcommands (the LLM half lives in the /ae:wiki-bootstrap skill):
  backfill [--dry-run]   legacy origin_bl → `origin` edges; depends_on →
                         `relates_to` edges (source = the depends_on: line).
                         Idempotent by (kind,id); unresolvable targets SKIPPED
                         and listed, never written.
  candidates             every node-body `F-NNN` mention lacking an edge →
                         `from\ttarget\tline\tsnippet` proposal rows. Never writes.
  add-edges <edges.json> the ONLY write path for judged semantic edges. Rows:
                         {from, kind, target, line, evidence, rationale}.
                         Per-node: newline-safe append + line-number compensation
                         + post-write source-line ANCHOR check + scoped wiki-lint;
                         any failure REVERTS that node and exits non-zero.

Landmines this script exists to encode (all hit in the 2026-07-04 live run):
frontmatter append must preserve the trailing newline (hand-rolled surgery
corrupted 3 files); `source:` line numbers must compensate for the lines the
edges themselves insert; dangling targets are lint-caught, not hand-trusted.

Exit: 0 = ok | 1 = one or more rows failed (reported; clean rows still landed
unless reverted) | 2 = usage error.
"""
import argparse
import json
import os
import re
import subprocess
import sys

import yaml

STATE_DIRS = ("active", "done", "abandoned", "paused")
HERE = os.path.dirname(os.path.realpath(__file__))
LINT = os.path.join(HERE, "wiki-lint.py")

if __name__ != "__main__":
    raise SystemExit("wiki-bootstrap.py is subprocess-only; do not import")


def nodes(root):
    for state in STATE_DIRS:
        sd = os.path.join(root, state)
        if not os.path.isdir(sd):
            continue
        for name in sorted(os.listdir(sd)):
            idx = os.path.join(sd, name, "index.md")
            if name.startswith("F-") and os.path.isfile(idx):
                yield os.path.join(sd, name), idx


def parse(idx):
    text = open(idx, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n?", text, re.S)
    if not m:
        return None, None, text
    try:
        data = yaml.safe_load(m.group(1))
    except yaml.YAMLError:
        return None, None, text
    return (data if isinstance(data, dict) else None), m, text


def yq(s):
    """Escape a string for a YAML double-quoted scalar."""
    return str(s).replace("\\", "\\\\").replace('"', '\\"')


def edge_lines(e):
    """Render one edge dict to frontmatter lines (list of newline-terminated strings)."""
    out = [f"  - kind: {e['kind']}\n", f"    id: {e['id']}\n"]
    if "source" in e:
        out.append(f'    source: "{yq(e["source"])}"\n')
    if "evidence" in e:
        out.append(f'    evidence: "{yq(e["evidence"])}"\n')
    out.append(f"    written_by: {e.get('written_by', 'batch')}\n")
    if "judge" in e:
        out.append(f'    judge: {{value: pass, rationale: "{yq(e["judge"])}"}}\n')
    return out


def append_edges(idx, edges):
    """Newline-safe append into the node's edges: list (create key only if absent)."""
    data, m, text = parse(idx)
    fm = m.group(1)
    block = "".join(l for e in edges for l in edge_lines(e))
    if re.search(r"^edges:\s*\[\s*\]\s*$", fm, re.M):
        fm = re.sub(r"^edges:\s*\[\s*\]\s*$", "edges:\n" + block.rstrip("\n"), fm, count=1, flags=re.M)
        body = text[m.end():]
        open(idx, "w", encoding="utf-8").write("---\n" + fm.rstrip("\n") + "\n---\n" + body)
        return
    if re.search(r"^edges:\s*\[", fm, re.M):
        raise ValueError("non-empty inline edges list — convert to block form first")
    if re.search(r"^edges:", fm, re.M):
        fm_lines = fm.splitlines(keepends=True)
        # keepends can leave the LAST line without \n — the live-run corruption class
        if fm_lines and not fm_lines[-1].endswith("\n"):
            fm_lines[-1] += "\n"
        out, in_edges, inserted = [], False, False
        for ln in fm_lines:
            if ln.startswith("edges:"):
                in_edges = True
                out.append(ln)
                continue
            if in_edges and not inserted and ln[:1] not in (" ", "\t"):
                out.append(block)
                inserted = True
                in_edges = False
            out.append(ln)
        if not inserted:
            out.append(block)
        new_fm = "".join(out)
    else:
        new_fm = fm.rstrip("\n") + "\nedges:\n" + block
    body = text[m.end():]
    open(idx, "w", encoding="utf-8").write("---\n" + new_fm.rstrip("\n") + "\n---\n" + body)


def resolvers(root):
    # F-target resolution mirrors wiki-lint exactly: TOP-LEVEL state-dir entries
    # WITH index.md (a bare/nested dir must not mask a dangling target)
    fids = set()
    for state in STATE_DIRS:
        sd = os.path.join(root, state)
        if not os.path.isdir(sd):
            continue
        for name in sorted(os.listdir(sd)):
            mm = re.match(r"^(F-\d+)-", name)
            if mm and os.path.isfile(os.path.join(sd, name, "index.md")):
                fids.add(mm.group(1))
    bls = set()
    for base, dirs, files in os.walk(root):
        for f in files:
            mm = re.match(r"^(BL-\d+)", f)
            if mm and f.endswith(".md"):
                bls.add(mm.group(1))
    backlog = os.path.normpath(os.path.join(root, os.pardir, "backlog"))
    if os.path.isdir(backlog):
        for base, _d, files in os.walk(backlog):
            for f in files:
                mm = re.match(r"^(BL-\d+)", f)
                if mm and f.endswith(".md"):
                    bls.add(mm.group(1))
    return fids, bls


def fm_line_count(idx):
    _, m, _ = parse(idx)
    return m.group(0).count("\n")


def scoped_lint(root, node_dir):
    r = subprocess.run([sys.executable, LINT, "--root", root, node_dir],
                       capture_output=True, text=True)
    return r.returncode == 0, (r.stdout + r.stderr).strip()


def cmd_backfill(args):
    fids, bls = resolvers(args.root)
    skipped, failures, wrote = [], 0, 0
    for node_dir, idx in nodes(args.root):
        data, m, text = parse(idx)
        if data is None:
            continue
        fid = str(data.get("id", ""))
        have = {(e.get("kind"), str(e.get("id"))) for e in (data.get("edges") or [])
                if isinstance(e, dict)}
        new = []
        ob = data.get("origin_bl")
        for bl in (ob if isinstance(ob, list) else [ob] if ob else []):
            bl = str(bl).strip()
            if not bl:
                continue
            if not re.match(r"^BL-\d+$", bl) or bl not in bls:
                skipped.append(f"{fid}: origin_bl {bl} unresolvable — SKIPPED")
                continue
            if ("origin", bl) not in have:
                new.append({"kind": "origin", "id": bl})
        dep = data.get("depends_on")
        deps = dep if isinstance(dep, list) else [dep] if dep else []
        dep_line = next((i + 1 for i, l in enumerate(text.splitlines())
                         if l.startswith("depends_on:")), None)
        added = sum(len(edge_lines(e)) for e in new)  # origin edges land above too
        dep_edges = []
        for d in deps:
            d = str(d).strip()
            if not d:
                continue
            if not re.match(r"^F-\d+$", d) or d not in fids:
                skipped.append(f"{fid}: depends_on {d} unresolvable — SKIPPED")
                continue
            if ("relates_to", d) in have:
                continue
            dep_edges.append({"kind": "relates_to", "id": d,
                              "evidence": "declared depends_on frontmatter (mechanical backfill)",
                              "judge": "deterministic transform of an existing declaration"})
        for e in dep_edges:
            e["source"] = "index.md:PENDING"  # post-write re-location (fm-internal anchor)
        new += dep_edges
        if not new:
            continue
        if args.dry_run:
            for e in new:
                print(f"[dry-run] {fid}: would write {e['kind']} -> {e['id']}")
            continue
        before = open(idx, encoding="utf-8").read()
        append_edges(idx, new)
        # post-write source fix-up: re-locate the depends_on line in the REAL file
        cur = open(idx, encoding="utf-8").read()
        real_dep = next((i + 1 for i, l in enumerate(cur.splitlines())
                         if l.startswith("depends_on:")), None)
        if "index.md:PENDING" in cur and real_dep:
            cur = cur.replace('source: "index.md:PENDING"', f'source: "index.md:{real_dep}"')
            open(idx, "w", encoding="utf-8").write(cur)
        okk, out = scoped_lint(args.root, node_dir)
        anchor_ok = True
        for e in new:
            if "source" in e:
                lines = open(idx, encoding="utf-8").read().splitlines()
                ln = real_dep or 0
                if not ln or ln > len(lines) or "depends_on" not in lines[ln - 1]:
                    anchor_ok = False
        if not (okk and anchor_ok):
            open(idx, "w", encoding="utf-8").write(before)
            failures += 1
            print(f"[wiki-bootstrap] REVERTED {fid}: "
                  f"{'lint failure: ' + out if not okk else 'source anchor missed'}")
            continue
        wrote += len(new)
    for s in skipped:
        print(f"[wiki-bootstrap] {s}")
    print(f"[wiki-bootstrap] backfill: {wrote} edge(s) written, "
          f"{len(skipped)} skipped, {failures} reverted")
    return 1 if failures else 0


def cmd_candidates(args):
    for node_dir, idx in nodes(args.root):
        data, m, text = parse(idx)
        if data is None:
            continue
        fid = str(data.get("id", ""))
        have = {str(e.get("id")) for e in (data.get("edges") or []) if isinstance(e, dict)}
        fm_lines = m.group(0).count("\n")
        seen = set()
        for i, ln in enumerate(text[m.end():].splitlines()):
            for t in set(re.findall(r"\bF-\d{3,}\b", ln)):
                if t != fid and t not in have and t not in seen:
                    seen.add(t)
                    print(f"{fid}\t{t}\t{fm_lines + i + 1}\t{ln.strip()[:100]}")
    return 0


def cmd_add_edges(args):
    try:
        rows = json.load(open(args.edges_json, encoding="utf-8"))
        assert isinstance(rows, list)
    except Exception as e:
        print(f"[wiki-bootstrap] usage error: cannot read {args.edges_json}: {e}", file=sys.stderr)
        return 2
    by_from = {}
    for r in rows:
        by_from.setdefault(str(r["from"]), []).append(r)
    dirs = {str(parse(idx)[0].get("id", "")): (nd, idx)
            for nd, idx in nodes(args.root) if parse(idx)[0]}
    failures = 0
    for fid, items in by_from.items():
        if fid not in dirs:
            print(f"[wiki-bootstrap] REVERTED {fid}: no such node", file=sys.stderr)
            failures += 1
            continue
        node_dir, idx = dirs[fid]
        old_fm = fm_line_count(idx)
        have = {(e.get("kind"), str(e.get("id"))) for e in (parse(idx)[0].get("edges") or [])
                if isinstance(e, dict)}
        edges = []
        for r in items:
            if (r["kind"], str(r["target"])) in have:
                print(f"[wiki-bootstrap] {fid}: {r['kind']} -> {r['target']} already present — skipped (idempotent)")
                continue
            e = {"kind": r["kind"], "id": str(r["target"]),
                 "evidence": r.get("evidence", ""),
                 "judge": r.get("rationale", "bootstrap judgment — user-review pending")}
            if r.get("line"):
                e["source"] = f"index.md:PENDING{int(r['line'])}"  # body line, pre-write
            edges.append(e)
        if not edges:
            continue
        before = open(idx, encoding="utf-8").read()
        append_edges(idx, edges)
        # post-write fix-up: body lines shift by the REAL frontmatter growth
        delta = fm_line_count(idx) - old_fm
        cur = open(idx, encoding="utf-8").read()
        for e in edges:
            if "source" in e and "PENDING" in e["source"]:
                orig = int(e["source"].rsplit("PENDING", 1)[1])
                e["source"] = f"index.md:{orig + delta}"
                cur = cur.replace(f'source: "index.md:PENDING{orig}"',
                                  f'source: "{e["source"]}"')
        open(idx, "w", encoding="utf-8").write(cur)
        okk, out = scoped_lint(args.root, node_dir)
        anchor_ok = True
        for e in edges:
            if "source" in e:
                ln = int(e["source"].rsplit(":", 1)[1])
                lines = open(idx, encoding="utf-8").read().splitlines()
                if ln > len(lines) or e["id"] not in lines[ln - 1]:
                    anchor_ok = False
        if not (okk and anchor_ok):
            open(idx, "w", encoding="utf-8").write(before)
            failures += 1
            targets = ", ".join(e["id"] for e in edges)
            print(f"[wiki-bootstrap] REVERTED {fid} ({targets}): "
                  f"{'lint: ' + out if not okk else 'source anchor missed'}")
            continue
        print(f"[wiki-bootstrap] {fid}: wrote {len(edges)} judged edge(s)")
    return 1 if failures else 0


parser = argparse.ArgumentParser()
sub = parser.add_subparsers(dest="cmd", required=True)
p1 = sub.add_parser("backfill")
p1.add_argument("--dry-run", action="store_true")
p2 = sub.add_parser("candidates")
p3 = sub.add_parser("add-edges")
p3.add_argument("edges_json")
for p in (p1, p2, p3):
    p.add_argument("--root", default=os.environ.get("FEATURES_ROOT", ".ae/features"))
try:
    args = parser.parse_args()
except SystemExit:
    sys.exit(2)
if not os.path.isdir(args.root):
    print(f"[wiki-bootstrap] usage error: no such root: {args.root}", file=sys.stderr)
    sys.exit(2)
sys.exit({"backfill": cmd_backfill, "candidates": cmd_candidates,
          "add-edges": cmd_add_edges}[args.cmd](args))
