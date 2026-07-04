#!/usr/bin/env python3
"""graph-index-gen.py — deterministic layered index over feature frontmatter (F-069 Step 3).

Aggregates PRE-EXISTING fields only (theme / id / title / status + the first
body paragraph as TL;DR) into the persistent layered index the cold-start read
path consumes (conclusion #5/#6). Never LLM-narrated — LLM narration would
drift (Aider repo-map lesson). Layered, never flat:
  Tier A  <out>/index.md          theme directory (theme → member count + link)
  Tier B  <out>/themes/<slug>.md  per-theme member entries:
            ### <id> — <title> (<status>)
            <first body paragraph, byte-verbatim — no join, no escape>
Missing `theme` → the exact "(unthemed)" bucket (reader contract). Sentence-
shaped theme values are surfaced as-is, one bucket (AC3 boundary / F-040
hazard). Themes sort alphabetically; "(unthemed)" always last; members sort
by id. Byte-idempotent: no timestamps, stable ordering.

Node discovery matches graph-lint/discover_nodes: <root>/{active,done,abandoned,
paused}/F-*/index.md — top level only (nested index.md files are not nodes).
Records missing required id/title/status are skipped with a stderr log
(reader contract: log error, skip record, continue scanning).

Usage: graph-index-gen.py [--root DIR] [--out DIR]
  --root  features root (default: $FEATURES_ROOT or .ae/features)
  --out   index output dir (default: .ae/graph)
Exit: 0 = written | 2 = usage error.
"""
import argparse
import os
import re
import sys

import yaml

STATE_DIRS = ("active", "done", "abandoned", "paused")
UNTHEMED = "(unthemed)"

if __name__ != "__main__":
    raise SystemExit("graph-index-gen.py is subprocess-only; do not import")


def parse_index(path):
    """Return (frontmatter dict, first body paragraph) or (None, error)."""
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except OSError as e:
        return None, f"unreadable: {e}"
    m = re.match(r"^---\n(.*?)\n---\n?", text, re.S)
    if not m:
        return None, "no frontmatter block"
    try:
        data = yaml.safe_load(m.group(1))
    except yaml.YAMLError as e:
        return None, f"unparseable YAML: {str(e).splitlines()[0]}"
    if not isinstance(data, dict):
        return None, "frontmatter is not a mapping"
    # TL;DR: first non-empty, non-heading paragraph of the body, byte-verbatim
    body = text[m.end():]
    tldr_lines = []
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped:
            if tldr_lines:
                break
            continue
        # markdown heading = #{1,6} + whitespace; "#1 priority" is prose (codex)
        if re.match(r"^#{1,6}\s", stripped):
            if tldr_lines:
                break
            continue
        tldr_lines.append(line)
    return data, "\n".join(tldr_lines)


def slugify(theme):
    slug = re.sub(r"[^A-Za-z0-9]+", "-", theme).strip("-").lower()
    return slug or "theme"


parser = argparse.ArgumentParser()
parser.add_argument("--root", default=os.environ.get("FEATURES_ROOT", ".ae/features"))
parser.add_argument("--out", default=".ae/graph")
try:
    args = parser.parse_args()
except SystemExit:
    sys.exit(2)

root = os.path.realpath(args.root)
if not os.path.isdir(root):
    print(f"[graph-index-gen] usage error: no such root: {args.root}", file=sys.stderr)
    sys.exit(2)

themes = {}  # theme value → list of (id, title, status, tldr)
for state in STATE_DIRS:
    state_dir = os.path.join(root, state)
    if not os.path.isdir(state_dir):
        continue
    for name in sorted(os.listdir(state_dir)):
        index = os.path.join(state_dir, name, "index.md")
        if not (name.startswith("F-") and os.path.isfile(index)):
            continue
        data, tldr = parse_index(index)
        if data is None:
            print(f"[graph-index-gen] skip {state}/{name}: {tldr}", file=sys.stderr)
            continue
        fid, title, status = data.get("id"), data.get("title"), data.get("status")
        if not fid or not title or not status:
            print(f"[graph-index-gen] skip {state}/{name}: missing required id/title/status",
                  file=sys.stderr)
            continue
        # only absent/blank theme is unthemed — falsy-but-real values like
        # `theme: 0` keep their bucket (gemini reader-contract)
        theme = data.get("theme")
        theme = UNTHEMED if theme is None or not str(theme).strip() else str(theme)
        themes.setdefault(theme, []).append((str(fid), str(title), str(status), tldr))

# stable order: themes alphabetical, (unthemed) last; members by id
ordered = sorted((t for t in themes if t != UNTHEMED), key=str.lower)
if UNTHEMED in themes:
    ordered.append(UNTHEMED)

out_dir = os.path.realpath(args.out)
themes_dir = os.path.join(out_dir, "themes")
os.makedirs(themes_dir, exist_ok=True)

# stale tier-B files from removed themes would break idempotence and dangle
slugs = {}
for theme in ordered:
    slug = slugify(theme)
    n = 2
    while slug in slugs.values():
        slug = f"{slugify(theme)}-{n}"
        n += 1
    slugs[theme] = slug
for existing in os.listdir(themes_dir):
    if existing.endswith(".md") and existing[:-3] not in slugs.values():
        # only reap GENERATED files (marker check) — never a hand-dropped note,
        # and never anything on a run that parsed zero records (doodlestein)
        path = os.path.join(themes_dir, existing)
        try:
            with open(path, encoding="utf-8") as f:
                first = f.readline()
        except OSError:
            continue
        if themes and first.startswith("# Theme:"):
            os.remove(path)

tier_a = ["# Project knowledge index — themes", "",
          "Generated by graph-index-gen.py — deterministic aggregation of feature",
          "frontmatter (theme/id/title/status + first body paragraph). Do not edit.", ""]
def member_key(row):
    # numeric id sort — lexicographic puts F-1000 before F-932 (gemini)
    m = re.search(r"(\d+)", row[0])
    return (int(m.group(1)) if m else 0, row[0])


for theme in ordered:
    members = sorted(themes[theme], key=member_key)
    slug = slugs[theme]
    tier_a.append(f"- [{theme}](themes/{slug}.md) — {len(members)} feature(s)")
    tier_b = [f"# Theme: {theme}", "",
              "Generated by graph-index-gen.py — do not edit.", ""]
    for fid, title, status, tldr in members:
        tier_b.append(f"### {fid} — {title} ({status})")
        tier_b.append("")
        if tldr:
            tier_b.append(tldr)
            tier_b.append("")
    with open(os.path.join(themes_dir, f"{slug}.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(tier_b).rstrip("\n") + "\n")
tier_a.append("")

with open(os.path.join(out_dir, "index.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(tier_a).rstrip("\n") + "\n")

total = sum(len(v) for v in themes.values())
print(f"[graph-index-gen] {len(ordered)} theme(s), {total} feature(s) → {out_dir}")
sys.exit(0)
