#!/bin/sh
# validate-preregistration.sh — is this a commitment, or a description of what already happened?
#
# The E3 result being replaced claimed a capability-tier and prompt-density cause from arms that
# differed in several ways at once, and that claim then set model/tools/effort policy. The defect
# was not the analysis; it was that nothing fixed, in advance, what would count as an answer. So
# this validator refuses the shapes that let a design be reinterpreted after the fact:
#
#   * `results_observed` true, or any external call already spent — then the design followed the
#     data rather than preceding it;
#   * an arm output, result, or backend correlation already present under the E3 evidence tree —
#     the same failure with the file on disk instead of a flag;
#   * an axis that varies more than one field, which is exactly the confound being corrected;
#   * a `held_constant` field that is not, in fact, equal across that axis's arms — the claim
#     most likely to be sincerely believed and false;
#   * duplicate or missing arm IDs, so an arm cannot be added, dropped, or renamed once results
#     exist;
#   * an `isolated_invalid` arm that is not disposable, or whose profile, cache, repository or
#     plugin copy is a real path — reintroducing the parse defect anywhere reachable would damage
#     the thing the experiment measures;
#   * a binding digest that does not match the bytes on disk, so the protocol cannot silently
#     belong to a different plan, goal, or set of definitions;
#   * a missing prohibition on the tier/density claim, which is the specific conclusion this
#     design exists to make unreachable without controlled attested arms.
#
# Usage: sh validate-preregistration.sh <preregistration.json>
# Exit 0 = a valid preregistration, with no arm having run. 1 = at least one defect. 2 = usage.

set -eu

[ "$#" -eq 1 ] || { echo "usage: sh validate-preregistration.sh <preregistration.json>" >&2; exit 2; }
[ -f "$1" ] || { echo "validate-preregistration: no such file: $1" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "validate-preregistration: python3 is required" >&2; exit 2; }

HERE="$(cd "$(dirname "$0")" && pwd)"
exec python3 - "$1" "$HERE" <<'PY'
import hashlib, json, os, re, sys

target, here = os.path.abspath(sys.argv[1]), sys.argv[2]
problems = []


def bad(message):
    problems.append(message)


def repo_root(start):
    current = os.path.dirname(start)
    while True:
        if os.path.isdir(os.path.join(current, ".git")):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            return None
        current = parent


REPO = repo_root(target) or repo_root(os.path.join(here, "x"))
if REPO is None:
    sys.stderr.write("validate-preregistration: cannot locate the repository root\n")
    raise SystemExit(2)

try:
    with open(target, encoding="utf-8") as handle:
        prereg = json.load(handle)
except (OSError, ValueError) as exc:
    sys.stderr.write(f"validate-preregistration: unreadable: {exc}\n")
    raise SystemExit(1)

# --- schema -------------------------------------------------------------------------------------

SUPPORTED = {"type", "properties", "required", "additionalProperties", "items", "minItems",
             "minLength", "enum", "const", "pattern", "$ref", "description", "$schema", "$id",
             "title", "$defs"}
TYPES = {"object": dict, "array": list, "string": str, "boolean": bool, "null": type(None)}


def check(value, schema, root, where):
    for keyword in schema:
        if keyword not in SUPPORTED:
            bad(f"{where}: schema uses unsupported keyword {keyword!r}")
            return
    if "$ref" in schema:
        return check(value, root["$defs"][schema["$ref"].split("/")[-1]], root, where)
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
            bad(f"{where}: is empty where a value is required")
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
                check(value[name], sub, root, f"{where}.{name}")
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            bad(f"{where}: has {len(value)} item(s), needs at least {schema['minItems']}")
        if "items" in schema:
            for index, item in enumerate(value):
                check(item, schema["items"], root, f"{where}[{index}]")


with open(os.path.join(here, "preregistration.schema.json"), encoding="utf-8") as handle:
    schema = json.load(handle)
check(prereg, schema, schema, "preregistration")

# --- nothing may have run yet ----------------------------------------------------------------------

if prereg.get("results_observed") is not False:
    bad("results_observed is not false — a design written after the data is a description of it")
if prereg.get("external_calls_made") not in (0,):
    bad(f"external_calls_made is {prereg.get('external_calls_made')!r}; this attempt spends none")

work_package = prereg.get("work_package", "WP-P0.0")
for tree in ("arms", "raw-arm-output", "results"):
    for base in (os.path.join(REPO, ".ae/bootstrap/F-083/evidence", work_package, "e3", tree),
                 os.path.join(REPO, "plugins/ae/tests/live/cc-host/e3", tree)):
        if os.path.isdir(base) and any(os.scandir(base)):
            bad(f"{os.path.relpath(base, REPO)} already holds E3 {tree}; a preregistration "
                f"alongside existing arm output is not a commitment")

# --- bindings ----------------------------------------------------------------------------------------

bindings = prereg.get("bindings") or {}


def check_identity(entry, label):
    if not isinstance(entry, dict):
        bad(f"{label}: is not a {{path, sha256}} object")
        return
    path = entry.get("path", "")
    abs_path = os.path.join(REPO, path)
    if not os.path.isfile(abs_path):
        bad(f"{label}: {path} does not exist")
        return
    with open(abs_path, "rb") as handle:
        actual = hashlib.sha256(handle.read()).hexdigest()
    if actual != entry.get("sha256"):
        bad(f"{label}: {path} hashes to {actual}, the protocol was designed against "
            f"{entry.get('sha256')}")


def attempt_baseline_digests():
    """path -> digest as the preregistering attempt's own baseline captured them. The plan and
    goal live under `.ae/**`, which is ignored, so the projection is consulted alongside the
    repo-state manifest."""
    base = os.path.join(REPO, ".ae/bootstrap/F-083/evidence",
                        prereg.get("work_package", ""), prereg.get("attempt_id", ""),
                        "baseline-before")
    digests = {}
    for name in ("repo-state.json", "ignored-projection.json"):
        path = os.path.join(base, name)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, encoding="utf-8") as handle:
                loaded = json.load(handle)
        except (OSError, ValueError):
            continue
        for entry in loaded.get("entries", []):
            if isinstance(entry, dict) and entry.get("type") != "directory":
                digests[entry.get("path")] = entry.get("sha256")
    return digests


def check_assigned_identity(entry, label, captured):
    """A preregistration is written against one material revision and is then immutable. Its plan
    and goal identities are what that revision's bytes WERE, so they are held against the capture
    the attempt took — hashing them against the live tree turns every later approved revision into
    a defect in a record that, by design, can never be edited to follow it."""
    if not isinstance(entry, dict):
        bad(f"{label}: is not a {{path, sha256}} object")
        return
    recorded = captured.get(entry.get("path"))
    if recorded is None:
        bad(f"{label}: {entry.get('path')} is not enumerated by the attempt's own before "
            f"baseline, so the digest it binds is carried by nothing")
    elif recorded != entry.get("sha256"):
        bad(f"{label}: binds {entry.get('sha256')} but the attempt's before baseline captured "
            f"{entry.get('path')} as {recorded}")


captured = attempt_baseline_digests()
for name in ("plan", "frozen_goal"):
    if name in bindings:
        check_assigned_identity(bindings[name], f"bindings.{name}", captured)
if "corrected_e3_record" in bindings:
    check_identity(bindings["corrected_e3_record"], "bindings.corrected_e3_record")
for index, entry in enumerate(bindings.get("definitions", [])):
    check_identity(entry, f"bindings.definitions[{index}]")

# --- axes and arms ------------------------------------------------------------------------------------

HELD_FIELDS = {"definition_state", "model_profile", "prompt_sha256", "source_sha256",
               "repo_state_sha256", "invocation_mode", "session_construction"}
all_arm_ids = {}
axis_ids = set()

for axis in prereg.get("axes", []):
    axis_id = axis.get("axis_id")
    label = f"axes[{axis_id}]"
    if axis_id in axis_ids:
        bad(f"{label}: duplicate axis_id")
    axis_ids.add(axis_id)

    varies = axis.get("varies")
    held = set(axis.get("held_constant", []))
    arms = axis.get("arms", [])

    if varies in held:
        bad(f"{label}: {varies!r} is both varied and held constant")

    # Every field except the one this axis varies must be held. An unlisted field is a difference
    # nobody committed to controlling, which is how the original result got two explanations.
    unlisted = HELD_FIELDS - held - {varies}
    if unlisted:
        bad(f"{label}: {sorted(unlisted)} are neither varied nor held constant — an uncontrolled "
            f"field is the confound this design corrects")

    for arm in arms:
        arm_id = arm.get("arm_id")
        if arm_id in all_arm_ids:
            bad(f"{label}: arm_id {arm_id!r} is already used by {all_arm_ids[arm_id]}")
        else:
            all_arm_ids[arm_id] = axis_id

    # The claim most likely to be sincerely believed and false: check it rather than read it.
    for field in held:
        values = {json.dumps(arm.get(field)) for arm in arms}
        if len(values) > 1:
            bad(f"{label}: {field!r} is declared held constant but differs across arms "
                f"{[arm.get('arm_id') for arm in arms]}")

    varied_values = {json.dumps(arm.get(varies)) for arm in arms}
    if len(varied_values) < 2:
        bad(f"{label}: every arm has the same {varies!r}; there is no contrast")

    for arm in arms:
        arm_label = f"{label}.{arm.get('arm_id')}"
        isolation = arm.get("isolation") or {}
        if arm.get("definition_state") == "isolated_invalid":
            if isolation.get("disposable") is not True:
                bad(f"{arm_label}: carries the historical parse defect without a disposable "
                    f"environment; the production definitions must stay valid")
            for key in ("profile_root", "cache_root", "repo_root", "plugin_copy_root"):
                value = str(isolation.get(key, ""))
                if value.startswith(REPO) or value in (REPO, "."):
                    bad(f"{arm_label}: isolation.{key} is the real repository; the invalid arm "
                        f"must not exist anywhere reachable")
                if value.startswith(os.path.expanduser("~/.claude")):
                    bad(f"{arm_label}: isolation.{key} is the real CC profile or cache")
            if not isolation.get("cleanup_manifest"):
                bad(f"{arm_label}: no cleanup manifest; a disposable environment nobody records "
                    f"is one nobody disposes of")

prohibited = " ".join(json.dumps(item) for item in prereg.get("prohibited_conclusions", []))
for phrase in ("tier", "density"):
    if phrase not in prohibited.lower():
        bad(f"prohibited_conclusions does not name the {phrase} claim; the conclusion this design "
            f"exists to make unreachable must be written down before the arms run")

gate = prereg.get("human_gate") or {}
if gate.get("status") != "pending":
    bad(f"human_gate.status is {gate.get('status')!r}; this attempt may not record the gate as "
        f"crossed")

for message in problems:
    sys.stderr.write(f"  defect: {message}\n")
if problems:
    sys.stderr.write(f"validate-preregistration: {len(problems)} defect(s)\n")
    raise SystemExit(1)
print(f"validate-preregistration: {len(prereg.get('axes', []))} axes, {len(all_arm_ids)} arm(s) "
      f"assigned, no arm run, gate {gate.get('status')}")
PY
