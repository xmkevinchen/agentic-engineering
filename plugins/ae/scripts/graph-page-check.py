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

ID_RE = re.compile(r"^syn-[a-z0-9][a-z0-9-]*$")
REQUIRED = ("id", "title", "created", "written_by", "state")

if __name__ != "__main__":
    raise SystemExit("graph-page-check.py is subprocess-only; do not import")


def norm(line):
    return re.sub(r"\s+", " ", line.strip())


parser = argparse.ArgumentParser()
parser.add_argument("--repo-root", default=None)
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
    if not isinstance(source, str) or ":" not in source:
        defects.append(f"{where}: source '{source}' is not 'path:line'")
        continue
    path_part, _, line_part = source.rpartition(":")
    if not line_part.isdigit() or int(line_part) < 1:
        defects.append(f"{where}: source '{source}' has no valid line number")
        continue
    if os.path.isabs(path_part):
        defects.append(f"{where}: source '{source}' is absolute; must be repo-relative")
        continue
    resolved = os.path.realpath(os.path.join(repo_root, path_part))
    if not (resolved + os.sep).startswith(repo_root + os.sep):
        defects.append(f"{where}: source '{source}' escapes the repo root")
        continue
    if not os.path.isfile(resolved):
        defects.append(f"{where}: source '{source}' file does not exist")
        continue
    try:
        with open(resolved, encoding="utf-8", errors="replace") as f:
            lines = f.read().splitlines()
    except OSError as e:
        defects.append(f"{where}: source '{source}' unreadable: {e}")
        continue
    ln = int(line_part)
    if ln > len(lines):
        defects.append(f"{where}: source '{source}' line beyond EOF ({len(lines)} lines)")
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

for d in defects:
    print(f"[page-check] DEFECT: {page_id} {d}")
for s in stale:
    print(f"[page-check] STALE: {page_id} {s}")
verdict = "DEFECT" if defects else ("stale" if stale else "fresh")
print(f"[page-check] {page_id}: {verdict}")
sys.exit(1 if defects else 0)
