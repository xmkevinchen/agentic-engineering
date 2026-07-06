#!/usr/bin/env python3
"""graph-writeback-health.py — write-point-health over the graph ledger (F-076).

Reads .ae/graph/log.md's record kinds (stable actor prefixes: query: / check: /
add-page: / add-edges: / backfill: / dedup: / rejected:) and COMPUTES — not promises —
the disposition health of the write-back forcing function:

  - query records + write-back candidate yes-rate (the T1 monitoring
    constraint: a mandatory disposition line whose aggregate is never
    computed is a grep-green mechanism)
  - accepted-edge counts per proposal source ([lint] vs [writeback] vs
    untagged — the two structurally-parallel write-trigger paths)
  - batch pages written since the last `dedup:` record, against the numeric
    dedup tripwire (N=10): at or past the threshold the output carries a
    FORCED line — the dedup-lint revisit must run before the refresh closes.

Output is informational (exit 0 unless the log is unreadable, exit 2) —
/ae:knowledge-refresh runs this in its report step and acts on the lines;
the adversarial re-sampling of `no` dispositions stays LLM judgment there.

Usage: graph-writeback-health.py [--graph-dir DIR] [--tripwire N]
"""
import argparse
import os
import re
import sys

TRIPWIRE_DEFAULT = 10

if __name__ != "__main__":
    raise SystemExit("graph-writeback-health.py is subprocess-only; do not import")

parser = argparse.ArgumentParser()
parser.add_argument("--graph-dir", default=".ae/graph")
parser.add_argument("--tripwire", type=int, default=TRIPWIRE_DEFAULT)
parser.add_argument("--traces-dir", default=os.path.expanduser("~/.ae/traces"),
                    help="skill-invocation NDJSON traces — the INDEPENDENT "
                         "denominator: a locate-step that silently dropped its "
                         "query-record append shows up as invocations > queries "
                         "(queries: 0 alone cannot distinguish 'skills never ran' "
                         "from 'the append layer died')")
try:
    args = parser.parse_args()
except SystemExit:
    sys.exit(2)

log = os.path.join(os.path.realpath(args.graph_dir), "log.md")
if not os.path.isfile(log):
    print(f"[writeback-health] no ledger at {log} — nothing to report")
    sys.exit(0)
try:
    lines = open(log, encoding="utf-8").read().splitlines()
except OSError as e:
    print(f"[writeback-health] unreadable ledger: {e}", file=sys.stderr)
    sys.exit(2)

queries = yes = no = 0
by_skill = {}  # skill → [queries, yes, no] — a per-surface dead hook must not
               # hide behind a healthy aggregate rate
edge_src = {"lint": 0, "writeback": 0, "untagged": 0}
rejected_src = {}  # the resample pool's lint half: durable rejection records
pages_since_dedup = 0
seen_pages = set()  # distinct page ids since the last dedup pass (F-078)
for ln in lines:
    m = re.match(r"^- \S+ query: (\S+)", ln)
    if m:
        queries += 1
        row = by_skill.setdefault(m.group(1), [0, 0, 0])
        row[0] += 1
        if re.search(r"write-back candidate: yes", ln):
            yes += 1
            row[1] += 1
        elif re.search(r"write-back candidate: no", ln):
            no += 1
            row[2] += 1
        continue
    if re.match(r"^- \S+ add-edges: ", ln):
        # count EDGES, not add-edges log events: the record carries `N edge(s)`.
        # A multi-source batch attributes N to each listed source (rare; a refresh
        # batch is normally single-source) — a health heuristic, not an audit.
        nm = re.search(r"(\d+) edge\(s\)", ln)
        n = int(nm.group(1)) if nm else 1
        tags = re.search(r"\[([^\]]+)\]\s*$", ln)
        if tags:
            for t in tags.group(1).split(","):
                t = t.strip()
                edge_src[t] = edge_src.get(t, 0) + n
        else:
            edge_src["untagged"] += n
        continue
    if re.match(r"^- \S+ add-page: ", ln):
        # count DISTINCT page ids: a rewritten (delete + re-add) page must not
        # inflate the dedup tripwire with duplicate add-page events.
        pm = re.match(r"^- \S+ add-page: (\S+)", ln)
        pid = pm.group(1) if pm else None
        if pid and pid not in seen_pages:
            seen_pages.add(pid)
            pages_since_dedup += 1
        continue
    m = re.match(r"^- \S+ rejected: .*\[([^\]]+)\]", ln)
    if m:
        rejected_src[m.group(1)] = rejected_src.get(m.group(1), 0) + 1
        continue
    if re.match(r"^- \S+ dedup: ", ln):
        pages_since_dedup = 0
        seen_pages = set()

undisposed = queries - yes - no
rate = f"{(100 * yes // (yes + no))}%" if (yes + no) else "n/a"
skills = ", ".join(f"{k}: {v[0]} (y{v[1]}/n{v[2]})"
                   for k, v in sorted(by_skill.items())) or "none"
print(f"[writeback-health] queries: {queries} (yes: {yes}, no: {no}, "
      f"undisposed: {undisposed}, yes-rate: {rate}) by skill: {skills}")
print("[writeback-health] accepted edges by source: "
      + ", ".join(f"{k}: {v}" for k, v in sorted(edge_src.items())))
rej = ", ".join(f"{k}: {v}" for k, v in sorted(rejected_src.items())) or "none"
print(f"[writeback-health] rejected proposals by source (resample-pool input): {rej}")
state = "OK" if pages_since_dedup < args.tripwire else \
    "FORCED — run the dedup-lint revisit before this refresh closes"
print(f"[writeback-health] batch pages since last dedup pass: {pages_since_dedup} "
      f"(tripwire N={args.tripwire}: {state})")
if undisposed:
    print(f"[writeback-health] WARNING: {undisposed} query record(s) missing the "
          f"mandatory disposition line — the forcing function is being bypassed")

# independent denominator: skill-invocation traces vs query records. Windows
# differ (traces are session-scoped and rotated; the ledger persists), so this
# is a SMOKE ALARM for append-layer death, not an exact audit.
LOCATE_SKILLS = {"ae:analyze", "ae:plan", "ae:discuss", "ae:review", "ae:think"}
traces_dir = os.path.realpath(args.traces_dir)
if os.path.isdir(traces_dir):
    import json
    invocations = 0
    for fn in sorted(os.listdir(traces_dir)):
        if not fn.endswith(".ndjson"):
            continue
        try:
            for ln in open(os.path.join(traces_dir, fn), encoding="utf-8"):
                try:
                    rec = json.loads(ln)
                except ValueError:
                    continue
                if rec.get("skill") in LOCATE_SKILLS:
                    invocations += 1
        except OSError:
            continue
    gap = invocations - queries
    note = " — POSITIVE GAP: locate-step runs that appended no query record" if gap > 0 else ""
    print(f"[writeback-health] locate-step invocations in traces: {invocations} "
          f"vs query records: {queries} (gap: {gap}{note}; windows differ — "
          f"smoke alarm, not audit)")
sys.exit(0)
