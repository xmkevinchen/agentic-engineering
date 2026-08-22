#!/bin/sh
# check-relay-attestation.sh — did the proxy actually call its backend?
#
# The relay pipeline has one failure the report itself cannot expose: a proxy that returns a
# complete cross-family verdict having made zero backend calls. `BL-212` is the recorded
# incident — the seat's MCP tools arrived deferred, unloaded and uncallable, and the agent
# answered from its own analysis instead of taking the `unavailable` path. The report read
# exactly like a real one. Only the archive told them apart, and nothing had ever read it.
#
# So this script reads it. For every spawn the host recorded, it asks whether the subagent
# called any tool the seat's own definition declares, and classifies. Whether a class exits 1
# is set in one place — see WHAT MAKES IT EXIT 1 below — and stated per class here only where
# it is not obvious:
#
#   ATTESTED        at least one call to the seat's declared MCP tools that CAME BACK. An
#                   emitted call is not a reached backend: 8 of the 71 backend results in the
#                   archive this shipped against are errors.
#   UNATTESTED      no MCP call of any kind. NOT a verdict of dishonesty — a correct
#                   `unavailable` report also makes no call. Which one it is needs the report
#                   read against its source, which is judge work. Non-gating by default.
#   MISROUTED       MCP calls made, none under the seat's declared family prefix. The seat
#                   answered through another family's bridge.
#   NO-TRANSCRIPT   the host recorded a spawn and there is no archive for it — the script
#                   cannot answer for that run.
#   NO-LABEL        a spawn the host recorded with no name. The label is the only join key it
#                   writes, so the archive cannot be matched to it. Raised only once the seat
#                   is known to front a backend: a retired seat or one that relays nothing
#                   cannot fail to relay, named or not.
#   NO-DECLARATION  the seat's declared prefix cannot be read — no `tools:` line, a `tools:`
#                   line this reader cannot parse, or two files claiming one seat name. The
#                   ONLY class that exits 1 unconditionally, and it is raised for every seat
#                   whose declaration is unreadable, not only for seats the archive happens to
#                   hold a spawn of.
#   CALL-FAILED     the seat called its declared backend and every call returned an error. It
#                   tried and did not reach it, which for the question "was an opinion relayed"
#                   lands where UNATTESTED does — but it is a different defect and is named
#                   separately so the fix is not confused with the fix for silence.
#   AMBIGUOUS-JOIN  the spawn records and the archives for one label do not line up, so no row
#                   about them can be trusted — attributing one real call to two spawn records
#                   would let a run that called nothing read as attested.
#   INCOMPLETE      a declared call with no result recorded at all. "Every call errored" is a
#                   claim about results that exist; this transcript does not say what happened,
#                   which is not the same defect as CALL-FAILED.
#   UNREADABLE      a corrupt line anywhere but the tail, or one call id used twice. Either way
#                   the calls the file holds cannot be counted.
#   IN-FLIGHT       the host has not written a result for the spawn, or a label was spawned
#                   more than once and some of those are still open — the run is unfinished.
#                   Reported, never gating even under --gate; reading the archive mid-run must
#                   not report a working agent as having called nothing, and re-running a label
#                   is ordinary practice.
#   UNRESOLVED-SEAT `subagent_type` names a seat with no definition on the current tree —
#                   renamed or retired. Reported and never gating: history cannot be made
#                   auditable by any change to the tree, and a permanently red check is one
#                   people learn to ignore.
#   NOT-RELAY       the seat declares no MCP tools at all, so it fronts no backend and the
#                   question does not apply to it. Counted, never listed: `architect`,
#                   `challenger` and the doodlestein seats are most of the archive, and
#                   scoring them as unattested buried the proxy runs that are the subject.
#
# The declared prefixes come from each seat's own `tools:` frontmatter. Nothing here knows the
# name of a family, a server, or a vendor — adding a seat costs this script no edit, which is
# the criterion the feature it belongs to is measured against.
#
# WHAT MAKES IT EXIT 1, and why the split:
#
#   The seat declarations live in the repository and a person fixes them by editing a file.
#   The archive does not: it is host-written, it mutates with no commit, and a proxy call
#   interrupted three weeks ago is history no change to this tree can repair. So the two are
#   not held to one standard.
#
#   Always: a declaration this script cannot read — no `tools:` line, an unparseable one, or
#   two files claiming one seat name — and an agents directory that yields no seats at all.
#   Those are defects in the tree, they are actionable, and a check that shrugged at them
#   would be auditing nothing while reporting success.
#
#   Under --gate only: everything the archive says. UNATTESTED, MISROUTED, CALL-FAILED, and
#   the classes where the archive cannot answer — NO-TRANSCRIPT, AMBIGUOUS-JOIN, INCOMPLETE,
#   UNREADABLE, NO-LABEL. They are reported by default and gate on request.
#
#   This is the same argument the UNRESOLVED-SEAT note below makes, applied consistently. An
#   earlier version made four archive conditions blocking by default while arguing in its own
#   header that permanent redness is how a check stops being read; a reviewer pointed the
#   contradiction out, and the header was the half that was right.
#
# HONEST SCOPE — what it cannot see:
#
#   * Whether the report matches what the backend said. It sees that a call happened, never
#     what came back or what was written about it. Severity inflation and hedge removal
#     (`BL-211`) are invisible here.
#   * Whether an UNATTESTED run was a correct `unavailable` report or a fabricated verdict.
#   * The seat a spawn used, other than through `subagent_type`. The subagent's own transcript
#     records the label the team lead chose, not the type, so the parent session's spawn record
#     is the only join and a spawn the host did not record is invisible to this script entirely.
#   * Anything outside the archive: a backend contacted by some path that leaves no tool_use
#     block is invisible. It reads as UNATTESTED only when the spawn record and a joinable
#     archive both survive — otherwise it lands in one of the classes above, or nowhere.
#   * Spawns recorded in a parent session only. A proxy spawned BY a subagent is not in the
#     files this reads, so a nested relay is unaudited.
#   * The `ae:workflow:` namespace and the `agents/workflow/` directory. The claim that adding
#     a seat costs this script no edit holds for seats that live there and are spawned under
#     that namespace; a relay seat placed elsewhere, or a project-defined agent declaring MCP
#     tools, is silently outside the audit.
#   * Only the one event shape the host writes today: a tool_use block inside
#     `message.content[]`. A future transcript format would read as an archive with no calls
#     in it.
#   * Whether a non-error result carries a real answer, or came from where the seat thinks. A
#     clean result proves the HOST recorded a non-error completion — a local bridge, a cache or
#     a stub returning success is indistinguishable here from a vendor answering.
#   * Anything the report says. This half asks whether a backend was reached. Whether what it
#     said survived into the proxy's report intact is a separate question, and the archive
#     shows the two fail independently.
#
# Usage:
#   check-relay-attestation.sh [--transcripts <dir>] [--agents <dir>] [--gate] [--quiet]
#
#   --gate   also exit 1 on anything the ARCHIVE says: UNATTESTED, MISROUTED, CALL-FAILED,
#            NO-TRANSCRIPT, NO-LABEL, AMBIGUOUS-JOIN, INCOMPLETE and UNREADABLE. Default
#            reports them all and exits 0, because each needs a human or a judge to become a
#            finding — a correct `unavailable` report also makes no successful call. IN-FLIGHT,
#            UNRESOLVED-SEAT and NOT-RELAY never gate, with or without the flag.
#
# UNRESOLVED-SEAT is deliberately NOT fail-closed, against the argument that an unknowable
# declaration belongs with NO-DECLARATION. The two differ in what a person can do about them: a
# seat with an unreadable `tools:` line is fixed by editing that line, while a seat renamed out
# of existence leaves history no change to the tree can make auditable. Gating on it would make
# this script permanently red on any machine whose archive predates a rename, which is how a
# check stops being read.
#
# Exit codes are the contract stated above and nowhere else, so the two cannot drift apart.

set -u

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
TRANSCRIPTS=""
AGENTS="$REPO/plugins/ae/agents/workflow"
GATE=0
QUIET=0

while [ $# -gt 0 ]; do
  case "$1" in
    --transcripts) TRANSCRIPTS="${2:?--transcripts needs a directory}"; shift 2 ;;
    --agents)      AGENTS="${2:?--agents needs a directory}"; shift 2 ;;
    --gate)        GATE=1; shift ;;
    --quiet)       QUIET=1; shift ;;
    -h|--help)     awk 'NR>1 && /^#/{print;next} NR>1{exit}' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

# Default archive location: the host writes one directory per project, keyed by the cwd with
# path separators flattened to dashes.
DERIVED=0
if [ -z "$TRANSCRIPTS" ]; then
  TRANSCRIPTS="$HOME/.claude/projects/$(printf '%s' "$REPO" | tr '/.' '--')"
  DERIVED=1
fi

command -v python3 >/dev/null 2>&1 || {
  echo "[relay-attestation] python3 not found — cannot read the archive" >&2; exit 1; }

# An agents directory that is not there is not "no seats to check" — it is this script pointed
# somewhere wrong, in which case every spawn falls to UNRESOLVED-SEAT and the run passes having
# audited nothing.
[ -d "$AGENTS" ] || {
  echo "[relay-attestation] no agents directory at $AGENTS — nothing to read declarations from" >&2
  exit 1; }

TRANSCRIPTS="$TRANSCRIPTS" AGENTS="$AGENTS" GATE="$GATE" QUIET="$QUIET" \
  DERIVED="$DERIVED" python3 - <<'PY'
import json, os, re, sys, glob, collections

transcripts = os.environ["TRANSCRIPTS"]
agents_dir  = os.environ["AGENTS"]
gate        = os.environ["GATE"] == "1"
quiet       = os.environ["QUIET"] == "1"
derived     = os.environ.get("DERIVED") == "1"

def out(*a):
    if not quiet: print(*a)

# --- seat declarations: the tools: line is the only source of a seat's family prefix -------
seats = {}          # seat name -> declared mcp prefixes, or None when unreadable
why   = {}          # seat name -> why its declaration is unreadable, for the row text
hard  = set()       # seats whose declaration is a defect in the TREE, reported with no archive
where = {}          # seat name -> the file it was first declared in
for path in sorted(glob.glob(os.path.join(agents_dir, "*.md"))):
    head, name, tools = [], None, None
    with open(path, encoding="utf-8", errors="replace") as fh:
        first = fh.readline()
        if first.strip() != "---":
            continue
        for line in fh:
            if line.strip() == "---":
                break
            head.append(line)
    for line in head:
        if line.startswith("name:"):
            name = line.split(":", 1)[1].strip()
        elif line.startswith("tools:"):
            tools = {t.strip() for t in line.split(":", 1)[1].split(",") if t.strip()}
    if name is None:
        name = os.path.basename(path)[:-3]
    if name in seats:
        # Two files claiming one seat name: which declaration wins would be decided by
        # filename order, so no row about this seat can be trusted.
        seats[name] = None
        why[name] = (f"two files declare `name: {name}` "
                     f"({os.path.basename(where.get(name, '?'))} and "
                     f"{os.path.basename(path)}); filename order would decide which wins")
        hard.add(name)
        continue
    where[name] = path
    if tools is None:
        # `tools` is OPTIONAL in AE's agent contract — absent means every tool, and
        # `docs/agent-authoring.md` tells authors to add it later. So this is not a defect in
        # the tree and must not gate a machine that never spawned the seat. It still leaves
        # this script with no prefix to check against, so it is reported when a spawn shows up.
        seats[name] = None
        why[name] = (f"{os.path.basename(path)} has no tools: line, so it declares no family "
                     "prefix to check against (legal — `tools` is optional)")
    elif not tools:
        # A YAML block-list form reads as empty under this inline-comma reader. An unreadable
        # declaration is not a seat that declares nothing; treating it as one would drop the
        # seat from the audit silently.
        seats[name] = None
        why[name] = (f"{os.path.basename(path)} has a tools: line this reader cannot turn "
                     "into tool names (a YAML block list reads as empty here)")
        hard.add(name)
    else:
        # The seat's family prefix, not its exact tool names. A bridge gaining a tool must not
        # read as the seat answering through someone else's bridge, and the question this
        # script exists to answer is which family was reached.
        seats[name] = {t.rsplit("__", 1)[0] + "__"
                       for t in tools if t.startswith("mcp__") and "__" in t[6:]}

rows, tally = [], collections.Counter()
def row(verdict, seat, label, note):
    rows.append((verdict, seat, label, note)); tally[verdict] += 1

# --- the tree half, judged before the archive is opened -----------------------------------
# These are the check's unconditional teeth. Reaching them through the per-spawn loop made them
# conditional on the archive happening to hold a spawn of that seat, so a broken declaration
# passed on a fresh clone, on CI, and on any machine whose recent sessions used other seats.
if not seats:
    print(f"[relay-attestation] no seat declarations under {agents_dir} — nothing to check "
          "against. A directory with no readable frontmatter is this script pointed somewhere "
          "wrong, not a tree with no seats.", file=sys.stderr)
    sys.exit(1)

for seat_name in sorted(hard):
    row("NO-DECLARATION", seat_name, "(declaration)", why[seat_name])


def tool_calls(path):
    """Every tool call in a transcript paired with whether its result came back clean.

    Returns (names, mcp) where names is every tool_use name in order and mcp is a list of
    (name, reached) for the MCP calls — reached meaning a tool_result exists and is not an
    error. A line that will not parse is skipped: the host appends line-at-a-time and a run
    interrupted mid-write leaves a partial tail."""
    try:
        raw = open(path, encoding="utf-8", errors="replace").read().splitlines()
    except OSError:
        return None, None
    names, pending, mcp = [], {}, []
    for n, line in enumerate(raw):
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except ValueError:
            # The host appends line-at-a-time, so an unparseable FINAL line is a run caught
            # mid-write. Anywhere else it is corruption, and the calls it may have held are
            # invisible — which is the one thing this script must not report as a clean run.
            if n == len(raw) - 1:
                continue
            return "UNREADABLE", None
        if not isinstance(rec, dict):
            continue
        content = (rec.get("message") or {}).get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_use":
                names.append(block.get("name"))
                if str(block.get("name") or "").startswith("mcp__"):
                    tid = block.get("id")
                    if tid in pending:
                        return "UNREADABLE", None      # a reused id pairs a result to two calls
                    pending[tid] = block.get("name")
            elif block.get("type") == "tool_result":
                tid = block.get("tool_use_id")
                # Pair only backwards. A result that arrives before its call cannot be that
                # call's result, and joining on the id alone would let it attest one.
                if tid in pending:
                    # Anything that is not an explicit absence or False counts as an error.
                    # The two wrong answers are not symmetric: reading an error as a reached
                    # backend is the defect this script already carried once.
                    err = block.get("is_error") not in (None, False)
                    mcp.append((pending.pop(tid), not err))
    # Calls still pending got no result at all. "Every call errored" is a claim about results
    # that exist; this is a transcript that does not say what happened.
    return names, mcp + [(name, None) for name in pending.values()]

archive_note = ""
have_archive = os.path.isdir(transcripts)
if not have_archive:
    archive_note = f"no archive at {transcripts} — not applicable"
    if derived:
        archive_note += (". That path was derived from the repo path; if it looks wrong the "
                         "derivation may not match how the host flattens it — pass "
                         "--transcripts explicitly")

# --- spawn records: the parent session is the only place subagent_type is written ----------
SEAT_RE = re.compile(r"^ae:workflow:(.+)$")
records = []                          # (session, label, seat, spawn_id, returned)
for session_path in (sorted(glob.glob(os.path.join(transcripts, "*.jsonl")))
                     if have_archive else []):
    session = os.path.basename(session_path)[:-6]
    spawns, closed = [], set()
    for line in open(session_path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except ValueError:
            continue
        if not isinstance(rec, dict):
            continue
        content = (rec.get("message") or {}).get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_result":
                closed.add(block.get("tool_use_id"))
                continue
            if not (block.get("type") == "tool_use" and block.get("name") == "Agent"):
                continue
            spec = block.get("input") or {}
            m = SEAT_RE.match(str(spec.get("subagent_type") or ""))
            if not m:
                continue
            # A spawn with no name cannot be joined to an archive — the label is the only key
            # the host writes. Dropping it silently would let the BL-212 shape pass as a clean
            # run, so it is carried through and classified.
            spawns.append((session, str(spec.get("name") or ""), m.group(1), block.get("id")))
    for session_, label, seat, sid in spawns:
        records.append((session_, label, seat, sid, sid in closed))

if have_archive and not records:
    archive_note = f"no proxy spawns recorded under {transcripts} — not applicable"

# --- join each spawn to its archive -------------------------------------------------------
# The subagent file is agent-<agentId>.jsonl and the agentId is the label with a single-letter
# host prefix and a hash suffix. Matched on the agentId INSIDE the file rather than on the
# filename, so a label that is a prefix of another label cannot claim the wrong archive.
AGENT_ID_RE = lambda label: re.compile(r"^." + re.escape(label) + r"-[0-9a-fA-F]{6,}$")

def archives_for(session, label):
    found, pat = [], AGENT_ID_RE(label)
    for path in sorted(glob.glob(os.path.join(transcripts, session, "subagents", "agent-*.jsonl"))):
        agent_id = None
        for line in open(path, encoding="utf-8", errors="replace"):
            line = line.strip()
            if not line:
                continue
            try:
                agent_id = json.loads(line).get("agentId")
            except ValueError:
                continue
            if agent_id:
                break
        if agent_id and pat.match(agent_id):
            found.append(path)
    return found

# One group per (session, label, seat): a retry or a resume writes a second spawn record under
# the same label, and the archives have to be matched to them as a set rather than one at a time.
groups = collections.OrderedDict()
for session, label, seat, sid, returned in records:
    groups.setdefault((session, label, seat), []).append(returned)

for (session, label, seat), returns in groups.items():
    disp = label or "(unnamed)"
    if seat not in seats:
        row("UNRESOLVED-SEAT", seat, disp,
            "no definition on the current tree — renamed or retired")
        continue
    declared = seats[seat]
    if declared is None:
        if seat not in hard:      # the tree defects are already reported, once, above
            row("NO-DECLARATION", seat, disp,
                why.get(seat, f"{seat}'s declaration cannot be read"))
        continue
    if not declared:
        row("NOT-RELAY", seat, disp, "declares no MCP tools — fronts no backend")
        continue
    if not label:
        # Only now: a join is needed once the seat is known to front a backend. A
        # retired seat or one that relays nothing cannot fail to relay, named or not.
        row("NO-LABEL", seat, "(unnamed)",
            f"{len(returns)} spawn(s) in {session} with no name — the archive cannot be joined")
        continue

    paths = archives_for(session, label)

    # A spawn the host has not closed out is still running. Its archive is being written and
    # says nothing yet about what the agent will call.
    if not any(returns):
        row("IN-FLIGHT", seat, label,
            f"{len(returns)} spawn(s) still running in {session}")
        continue
    if not all(returns):
        # Some finished, some still running. The join cannot be trusted yet, but the reason is
        # that the group is unfinished — and re-running a label is ordinary practice, so
        # treating this as unclassifiable reddens routinely for nothing.
        row("IN-FLIGHT", seat, label,
            f"{sum(1 for r in returns if not r)} of {len(returns)} spawn(s) still running "
            f"in {session}")
        continue

    if not paths:
        row("NO-TRANSCRIPT", seat, label, f"spawn recorded in {session}, no archive written")
        continue
    if len(paths) != len(returns):
        row("AMBIGUOUS-JOIN", seat, label,
            f"{len(returns)} spawn record(s), {len(paths)} archive(s) — the label does not "
            "identify which run is which")
        continue

    for path in paths:
        names, mcp = tool_calls(path)
        if names is None:
            row("NO-TRANSCRIPT", seat, label, f"{os.path.basename(path)} could not be opened")
            continue
        if names == "UNREADABLE":
            row("UNREADABLE", seat, label,
                f"{os.path.basename(path)} has a corrupt line or a reused call id — the calls "
                "it holds cannot be counted")
            continue
        mine     = [(n, ok) for n, ok in mcp if any(n.startswith(p) for p in declared)]
        reached  = [n for n, ok in mine if ok is True]
        unanswered = [n for n, ok in mine if ok is None]
        if reached:
            row("ATTESTED", seat, label,
                ", ".join(f"{n}×{reached.count(n)}" for n in sorted(set(reached))))
        elif unanswered:
            row("INCOMPLETE", seat, label,
                f"{len(unanswered)} call(s) to " + ", ".join(sorted(set(unanswered)))
                + " with no result recorded — the transcript does not say what happened")
        elif mine:
            row("CALL-FAILED", seat, label,
                f"{len(mine)} call(s) to " + ", ".join(sorted({n for n, _ in mine}))
                + " — every one returned an error")
        elif mcp:
            row("MISROUTED", seat, label,
                "called " + ", ".join(sorted({n for n, _ in mcp}))
                + " — none under this seat's declared prefix")
        else:
            row("UNATTESTED", seat, label,
                f"{len(names)} tool call(s), no MCP call of any kind")

listed = ["NO-DECLARATION", "NO-LABEL", "NO-TRANSCRIPT", "AMBIGUOUS-JOIN", "UNREADABLE",
          "INCOMPLETE", "MISROUTED", "CALL-FAILED", "UNATTESTED", "IN-FLIGHT",
          "UNRESOLVED-SEAT", "ATTESTED"]
order = listed + ["NOT-RELAY"]
if archive_note:
    out(f"[relay-attestation] {archive_note}")
else:
    out(f"[relay-attestation] {len(records)} recorded spawn(s) under {transcripts}")
if rows:
    out()
    for verdict in listed:
        for v, seat, label, note in rows:
            if v == verdict:
                out(f"  {v:<15} {seat:<22} {label:<34} {note}")
    out()
    out("  " + "  ".join(f"{v}={tally[v]}" for v in order if tally[v]))

# Conditions in the tree, which a person fixes by editing a file.
blocking   = tally["NO-DECLARATION"]
# Conditions in the archive, which no change to the tree can repair.
gateworthy = (tally["MISROUTED"] + tally["UNATTESTED"] + tally["CALL-FAILED"]
              + tally["NO-TRANSCRIPT"] + tally["AMBIGUOUS-JOIN"] + tally["UNREADABLE"]
              + tally["INCOMPLETE"] + tally["NO-LABEL"])

if blocking:
    out()
    out("[relay-attestation] FAIL — a seat declaration in the tree cannot be read")
    sys.exit(1)
if gate and gateworthy:
    out()
    out("[relay-attestation] FAIL — --gate: the archive holds spawns that did not reach a "
        "backend, or that it cannot answer for")
    sys.exit(1)
sys.exit(0)
PY
