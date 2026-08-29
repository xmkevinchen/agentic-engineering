#!/bin/sh
# verify-effective-snapshot.sh — is the metadata AE declares the metadata actually in force?
#
# The corpus answer, before this existed, was that nobody knew. Six definitions had unparseable
# frontmatter; the host's response to that is to load them with EMPTY metadata and say nothing
# at the point of use, so `model`, `tools` and `effort` were declared and none were in force.
# Re-reading the YAML would have reported the declarations and called it a projection. That is
# why the accepted producer is frozen as `cc_registry_session_resolution_v1` and is not
# executor-selectable: the producer must be the HOST, because the host is the only party whose
# report is not a restatement of the file under test.
#
# Rejected by name, so the rejection is legible rather than a schema miss:
#   * a self-declared producer — a `kind` this snapshot chose for itself;
#   * plugin-authored output — a producer or correlation record living under the plugin tree,
#     which is the tree whose metadata is the question;
#   * a model self-report;
#   * a YAML re-read of the definitions;
#   * rows whose session or source root disagree with the resolution, or with each other —
#     those describe more than one world and cannot be compared;
#   * a missing effective field. `unknown` and `as declared` are the two answers this whole
#     contract exists to keep apart, so a null is a failure, not a gap.
#
# THREE outcomes, deliberately, because two would force a false one:
#   exit 0  — a complete, host-generated, single-world snapshot with one row per definition.
#   exit 42 — the snapshot honestly records that this host cannot emit the frozen producer, with
#             the exact facts. AC1 is BLOCKED, not failed: the executor may not invent a
#             substitute, and a reviewer needs to see 'blocked' distinctly from 'invalid'.
#   exit 1  — the snapshot is invalid, or claims availability it does not carry.
#
# `--accept-unavailable` keeps all three apart while reporting the result in the two dimensions it
# actually has. Whether the DECLARATIONS parse and project their fields, and whether the HOST can
# attest what is in force, are different questions with different answers; collapsing them is the
# failure this file exists to prevent. Under the flag an honest `unavailable` is an accepted
# capability observation rather than a block — and is printed as one, alongside the explicit
# statement that it claims nothing about declared metadata being in force. An invalid snapshot is
# still invalid; the flag never converts one into the other.
#
# Usage:
#   sh verify-effective-snapshot.sh [--accept-unavailable] <handoffs/WP-package-dir>
#   sh verify-effective-snapshot.sh [--accept-unavailable] --snapshot <file>
#
# The package form is what the frozen AC command uses: it takes a stable directory and resolves
# the attempt from the append-only artifacts, so the command cannot be pointed at a better-looking
# snapshot. `--snapshot` exists for the contract test's fixtures and resolves nothing.

set -eu

accept_unavailable=0
if [ "${1:-}" = "--accept-unavailable" ]; then accept_unavailable=1; shift; fi

case "${1:-}" in
  --snapshot) [ "$#" -eq 2 ] || { echo "usage: verify-effective-snapshot.sh [--accept-unavailable] --snapshot <file>" >&2; exit 2; }
              mode=snapshot; target=$2 ;;
  "" | -*)    echo "usage: verify-effective-snapshot.sh [--accept-unavailable] <package-dir> | --snapshot <file>" >&2; exit 2 ;;
  *)          [ "$#" -eq 1 ] || { echo "usage: verify-effective-snapshot.sh [--accept-unavailable] <package-dir>" >&2; exit 2; }
              mode=package; target=$1 ;;
esac

[ -e "$target" ] || { echo "verify-effective-snapshot: no such path: $target" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "verify-effective-snapshot: python3 is required" >&2; exit 2; }

HERE="$(cd "$(dirname "$0")" && pwd)"
exec python3 - "$mode" "$target" "$HERE" "$accept_unavailable" <<'PY'
import hashlib, json, os, re, sys

mode, target, here = sys.argv[1], os.path.abspath(sys.argv[2]), sys.argv[3]
accept_unavailable = sys.argv[4] == "1"
problems = []

DEFINITIONS = [
    "plugins/ae/agents/workflow/gemini-proxy.md",
    "plugins/ae/skills/discuss/SKILL.md",
    "plugins/ae/skills/plan/SKILL.md",
    "plugins/ae/skills/review/SKILL.md",
    "plugins/ae/skills/think/SKILL.md",
    "plugins/ae/skills/work/SKILL.md",
]


def bad(message):
    problems.append(message)


def repo_root(start):
    current = start if os.path.isdir(start) else os.path.dirname(start)
    while True:
        if os.path.isdir(os.path.join(current, ".git")):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            return None
        current = parent


REPO = repo_root(target) or repo_root(here)
if REPO is None:
    sys.stderr.write("verify-effective-snapshot: cannot locate the repository root\n")
    raise SystemExit(2)


def digest_of(path):
    with open(path, "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


# --- locate the snapshot ------------------------------------------------------------------------

if mode == "snapshot":
    snapshot_path = target
else:
    package = target
    work_package = os.path.basename(package.rstrip("/"))
    # A request rejected before assignment carries request-audit.json and never became an attempt,
    # so it can never be the one under test. Among the attempts that WERE assigned, the newest is
    # it: attempts are append-only, so an earlier one's subject is already reviewed and closed.
    # Anchoring on "has a subject" instead would pin this command to the first reviewed attempt
    # forever, which is the same thing as letting it be pointed at a finished one.
    attempts = sorted(d for d in os.listdir(package)
                      if re.fullmatch(r"A-\d{3}", d)
                      and os.path.isfile(os.path.join(package, d, "work-request.json"))
                      and not os.path.isfile(os.path.join(package, d, "request-audit.json")))
    if not attempts:
        sys.stderr.write(f"verify-effective-snapshot: no assigned attempt under {package}\n")
        raise SystemExit(2)
    attempt = attempts[-1]
    snapshot_path = os.path.join(
        REPO, ".ae/bootstrap/F-083/evidence", work_package, attempt,
        "raw/effective-metadata-snapshot.json")
    if not os.path.isfile(snapshot_path):
        sys.stderr.write(f"verify-effective-snapshot: {attempt} has no effective-metadata "
                         f"snapshot at {os.path.relpath(snapshot_path, REPO)}\n")
        raise SystemExit(1)

try:
    with open(snapshot_path, encoding="utf-8") as handle:
        snapshot = json.load(handle)
except (OSError, ValueError) as exc:
    sys.stderr.write(f"verify-effective-snapshot: unreadable snapshot: {exc}\n")
    raise SystemExit(1)

# --- schema ---------------------------------------------------------------------------------------

SUPPORTED = {"type", "properties", "required", "additionalProperties", "items", "minItems",
             "minLength", "enum", "const", "pattern", "description", "$schema", "$id", "title"}
TYPES = {"object": dict, "array": list, "string": str, "boolean": bool, "null": type(None)}


def check(value, schema, where):
    for keyword in schema:
        if keyword not in SUPPORTED:
            bad(f"{where}: schema uses unsupported keyword {keyword!r}")
            return
    if "const" in schema and value != schema["const"]:
        bad(f"{where}: is {value!r}, must be {schema['const']!r}")
        return
    if "enum" in schema and value not in schema["enum"]:
        bad(f"{where}: is {value!r}, not one of {schema['enum']}")
        return
    if "type" in schema:
        wanted = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        allowed = tuple(TYPES[t] for t in wanted if t in TYPES)
        if "integer" in wanted:
            allowed += (int,)
        if not isinstance(value, allowed) or (isinstance(value, bool) and "boolean" not in wanted):
            bad(f"{where}: is {type(value).__name__}, must be {'|'.join(wanted)}")
            return
    if isinstance(value, str):
        if "pattern" in schema and not re.fullmatch(schema["pattern"], value):
            bad(f"{where}: {value!r} does not match {schema['pattern']}")
        if "minLength" in schema and len(value) < schema["minLength"]:
            bad(f"{where}: is empty where a value is required — 'unknown' and 'as declared' are "
                f"the two answers this contract keeps apart")
    if isinstance(value, dict):
        properties = schema.get("properties", {})
        for name in schema.get("required", []):
            if name not in value:
                bad(f"{where}: missing required field {name!r}")
        if schema.get("additionalProperties") is False:
            for name in value:
                if name not in properties:
                    bad(f"{where}: unknown field {name!r}")
        for name, sub in properties.items():
            if name in value:
                check(value[name], sub, f"{where}.{name}")
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            bad(f"{where}: has {len(value)} item(s), needs at least {schema['minItems']}")
        if "items" in schema:
            for index, item in enumerate(value):
                check(item, schema["items"], f"{where}[{index}]")


with open(os.path.join(here, "producer-contract.schema.json"), encoding="utf-8") as handle:
    check(snapshot, json.load(handle), "snapshot")

# --- the rules a schema cannot state ---------------------------------------------------------------

producer = snapshot.get("producer") or {}
resolution = snapshot.get("resolution") or {}
availability = snapshot.get("availability") or {}
rows = snapshot.get("rows") or []

REJECTED_PRODUCERS = {
    "plugin": "a plugin-authored producer reports on the tree whose metadata is the question",
    "model": "a model self-report is not an observation of the host",
    "model_self_report": "a model self-report is not an observation of the host",
    "yaml": "re-reading the YAML restates the declaration this check exists to test",
    "yaml_reread": "re-reading the YAML restates the declaration this check exists to test",
    "frontmatter": "re-reading the frontmatter restates the declaration under test",
    "executor": "an executor-selected producer is the substitution this contract refuses",
}
generated_by = str(producer.get("generated_by", ""))
for marker, why in REJECTED_PRODUCERS.items():
    if marker in generated_by.lower():
        bad(f"producer.generated_by is {generated_by!r}: {why}")
        break

if producer.get("kind") != "cc_registry_session_resolution_v1":
    bad(f"producer.kind is {producer.get('kind')!r}; the accepted producer is frozen as "
        f"cc_registry_session_resolution_v1 and is not executor-selectable")

for index, record in enumerate(producer.get("raw_records", [])):
    path = record.get("path", "")
    if path.startswith("plugins/"):
        bad(f"producer.raw_records[{index}]: {path} lives under the plugin tree — a record the "
            f"plugin wrote about itself is not host attestation")
        continue
    abs_path = os.path.join(REPO, path)
    if not os.path.isfile(abs_path):
        bad(f"producer.raw_records[{index}]: {path} does not exist")
    elif digest_of(abs_path) != record.get("sha256"):
        bad(f"producer.raw_records[{index}]: {path} does not hash to the recorded digest")

status = availability.get("status")
facts = availability.get("unavailable_facts", [])

# M5 lands this parser as a contract scaffold, not as a trusted host adapter. The current input is
# still a caller-supplied JSON file: even a literal `generated_by: claude-code-host` plus correctly
# hashing records does not prove that the host emitted the separately supplied effective rows.
# Keep validating the shape so the scaffold remains useful, but make the positive authority path
# unreachable until P0.7/P0.8 supplies and qualifies a producer whose values are derived from the
# host records rather than asserted beside them.
if status == "available":
    bad("positive effective-metadata attestation is deferred to P0.7/P0.8; this bootstrap "
        "verifier accepts no caller-supplied 'available' result as host proof")


def declaration_result():
    """The other dimension: do the six definitions still parse to the fields they declare?

    This reads the YAML on purpose, and that is only legitimate because of what it is called: a
    declaration is exactly what a re-read reports. What a re-read cannot report is what the host
    put in force, which is why the same bytes may never be used as attestation. A definition that
    fails to parse loads with empty metadata, so a parse failure IS the declaration failing."""
    try:
        import yaml
    except ImportError:
        return "fail", ["PyYAML is not importable, so the declarations cannot be parsed and a "
                        "grep-shaped substitute would pass the exact corpus this checks"]
    notes = []
    for rel in DEFINITIONS:
        path = os.path.join(REPO, rel)
        if not os.path.isfile(path):
            notes.append(f"{rel}: absent")
            continue
        with open(path, encoding="utf-8", errors="replace") as handle:
            lines = handle.read().split("\n")
        close = next((i for i in range(1, len(lines)) if lines[i] == "---"), None) \
            if lines and lines[0] == "---" else None
        if close is None:
            notes.append(f"{rel}: no closed leading frontmatter, so the host reads no metadata")
            continue
        try:
            parsed = yaml.safe_load("\n".join(lines[1:close]))
        except yaml.YAMLError as exc:
            notes.append(f"{rel}: frontmatter does not parse, so every declared field is "
                         f"silently dropped — {str(exc).splitlines()[0][:120]}")
            continue
        if not isinstance(parsed, dict) or not parsed:
            notes.append(f"{rel}: frontmatter projects no mapping, so its declarations stand "
                         f"behind nothing")
            continue
        empty = [key for key in parsed if str(parsed.get(key, "")).strip() == ""]
        if empty:
            notes.append(f"{rel}: declares {sorted(empty)} with no value in the projection")
    return ("fail" if notes else "pass"), notes


def report_two_dimensions(attestation, detail):
    result, notes = declaration_result()
    print(f"verify-effective-snapshot: declaration_result: {result} "
          f"({len(DEFINITIONS)} definition(s) parsed for their declared fields)")
    for note in notes:
        print(f"  - {note}")
    print(f"verify-effective-snapshot: effective_metadata_attestation: {attestation} ({detail})")
    if attestation == "unavailable":
        print("  an unavailable attestation is an accepted capability observation; it makes no "
              "claim that any declared model, tools or effort is in force")
    return result == "pass"


if status == "unavailable":
    if rows:
        bad("availability is 'unavailable' but rows are present — a partial row set is the "
            "substitution this contract refuses")
    if not facts:
        bad("availability is 'unavailable' with no recorded facts; 'blocked' has to be "
            "reviewable, not asserted")
    if problems:
        for message in problems:
            sys.stderr.write(f"  defect: {message}\n")
        sys.stderr.write(f"verify-effective-snapshot: {len(problems)} defect(s)\n")
        raise SystemExit(1)
    for fact in facts:
        print(f"  - {fact.get('fact')} (observed in {fact.get('observed_in')})")
    if not accept_unavailable:
        print("verify-effective-snapshot: the frozen producer is UNAVAILABLE on this host; AC1 is "
              "blocked pending an approved material revision")
        raise SystemExit(42)
    if report_two_dimensions("unavailable", f"{len(facts)} recorded fact(s)"):
        raise SystemExit(0)
    sys.stderr.write("verify-effective-snapshot: the declarations do not project their own "
                     "fields; an honest attestation cannot stand in for that\n")
    raise SystemExit(1)

if facts:
    bad("availability is 'available' but unavailable_facts are recorded; the snapshot disagrees "
        "with itself")

seen = {}
for index, row in enumerate(rows):
    label = f"rows[{index}]"
    path = row.get("definition_path")
    if path in seen:
        bad(f"{label}: {path} already has a row at {seen[path]}; one definition, one row")
        continue
    seen[path] = index
    if path not in DEFINITIONS:
        bad(f"{label}: {path} is not one of the six definitions under test")
    abs_path = os.path.join(REPO, path) if path else None
    if abs_path and os.path.isfile(abs_path) and digest_of(abs_path) != row.get("definition_sha256"):
        bad(f"{label}: {path} does not hash to the digest this row was taken against")
    if row.get("session_id") != resolution.get("session_id"):
        bad(f"{label}: correlated to session {row.get('session_id')!r}, not the resolution's "
            f"{resolution.get('session_id')!r} — a cross-session row describes another world")
    if row.get("source_root") != resolution.get("source_root"):
        bad(f"{label}: resolved to root {row.get('source_root')!r}, not the resolution's "
            f"{resolution.get('source_root')!r}")
    correlation = row.get("correlation") or {}
    record_path = correlation.get("record_path", "")
    if record_path.startswith("plugins/"):
        bad(f"{label}: correlated to {record_path}, inside the plugin tree — the plugin cannot "
            f"attest its own effective metadata")
    else:
        abs_record = os.path.join(REPO, record_path)
        if not os.path.isfile(abs_record):
            bad(f"{label}: correlation record {record_path} does not exist")
        elif digest_of(abs_record) != correlation.get("record_sha256"):
            bad(f"{label}: correlation record {record_path} does not hash to its recorded digest")

missing = [path for path in DEFINITIONS if path not in seen]
if missing:
    bad(f"no row for {len(missing)} definition(s): {missing} — a snapshot that covers some of "
        f"them cannot say the metadata is in force")

for message in problems:
    sys.stderr.write(f"  defect: {message}\n")
if problems:
    sys.stderr.write(f"verify-effective-snapshot: {len(problems)} defect(s)\n")
    raise SystemExit(1)
detail = (f"{len(rows)} structurally valid but non-authoritative row(s), one session "
          f"({resolution.get('session_id')}), "
          f"one source root ({resolution.get('source_root')})")
if not accept_unavailable:
    print(f"verify-effective-snapshot: {detail}")
elif not report_two_dimensions("available", detail):
    sys.stderr.write("verify-effective-snapshot: the host attests rows the declarations do not "
                     "project\n")
    raise SystemExit(1)
PY
