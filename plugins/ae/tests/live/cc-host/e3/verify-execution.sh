#!/bin/sh
# verify-execution.sh — did these arms answer the question, or merely produce output?
#
# The result being replaced is the reason this exists. Four arms ran, two of them differed in more
# than one way, none of them carried a host record of what it was actually running under, and the
# write-up still reached a capability-tier cause that then set policy. Nothing in that chain was
# dishonest; the gap was that no verifier stood between "both arms produced text" and "the
# difference between them has a cause".
#
# So this one refuses, by name:
#
#   * an arm the protocol assigned that the result does not report, or reports twice;
#   * raw output that is missing, empty, delivered through a symlink, or does not hash;
#   * an `available` attestation with no host record, no values, or no correlation to THIS arm —
#     a session-wide field is a fact about the session, not about the arm that ran inside it;
#   * an attestation produced by the model itself, by the plugin under test, by a re-read of the
#     declarations, or by the static registry snapshot. Static `unavailable` is an honest
#     observation about the host and is not arm attestation; it is also not evidence that a
#     runtime arm lacks host facts, so it may not be cited either way;
#   * a `supports` or `refutes` verdict on a contrast whose arms did not both complete with
#     available runtime attestation, or whose preregistered held-constant fields are not in fact
#     equal — that contrast is INCONCLUSIVE, which satisfies the evidence obligation and supports
#     no policy change;
#   * a claim that restates a conclusion the preregistration prohibited;
#   * external calls recorded against a launcher that cannot make one.
#
# Usage: sh verify-execution.sh <execution-result.json>
# Exit 0 = the result is valid and every verdict is held to its evidence. 1 = at least one defect.
# Exit 2 = usage.

set -eu

[ "$#" -eq 1 ] || { echo "usage: sh verify-execution.sh <execution-result.json>" >&2; exit 2; }
[ -f "$1" ] || { echo "verify-execution: no such file: $1" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "verify-execution: python3 is required" >&2; exit 2; }

HERE="$(cd "$(dirname "$0")" && pwd)"
exec python3 - "$1" "$HERE" <<'PY'
import hashlib, json, os, re, sys

target, here = os.path.abspath(sys.argv[1]), sys.argv[2]
problems = []


def bad(message):
    problems.append(message)


def finish():
    for message in problems:
        sys.stderr.write(f"  defect: {message}\n")
    if problems:
        sys.stderr.write(f"verify-execution: {len(problems)} defect(s)\n")
        raise SystemExit(1)
    raise SystemExit(0)


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
    sys.stderr.write("verify-execution: cannot locate the repository root\n")
    raise SystemExit(2)


def load(path, label):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError) as exc:
        sys.stderr.write(f"verify-execution: {label} is unreadable: {exc}\n")
        raise SystemExit(1)


def digest_of(path):
    with open(path, "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def resolve(rel):
    """A recorded path is repo-relative unless the run was isolated under an absolute temp root."""
    return rel if os.path.isabs(rel or "") else os.path.join(REPO, rel or "")


# --- schema ------------------------------------------------------------------------------------

SUPPORTED = {"type", "properties", "required", "additionalProperties", "items", "minItems",
             "minLength", "enum", "const", "pattern", "description", "$schema", "$id", "title",
             "$ref", "$defs"}
TYPES = {"object": dict, "array": list, "string": str, "boolean": bool, "null": type(None),
         "number": float}


def check(value, schema, root, where):
    if "$ref" in schema:
        ref = schema["$ref"]
        if not ref.startswith("#/$defs/"):
            bad(f"{where}: schema $ref {ref!r} is not a local definition")
            return
        check(value, root["$defs"][ref.split("/")[-1]], root, where)
        return
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
        allowed = tuple(TYPES[name] for name in wanted if name in TYPES)
        if "integer" in wanted or "number" in wanted:
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


result = load(target, "execution result")
result_schema = load(os.path.join(here, "execution-result.schema.json"), "result schema")
check(result, result_schema, result_schema, "result")
if problems:
    finish()

# --- the chain the result belongs to -----------------------------------------------------------

protocol_rel = result["protocol"]["path"]
protocol_abs = resolve(protocol_rel)
if not os.path.isfile(protocol_abs):
    bad(f"result.protocol: {protocol_rel} does not exist")
    finish()
if digest_of(protocol_abs) != result["protocol"]["sha256"]:
    bad(f"result.protocol: {protocol_rel} hashes to {digest_of(protocol_abs)}, not the recorded "
        f"{result['protocol']['sha256']}")
    finish()

protocol = load(protocol_abs, "execution protocol")
protocol_schema = load(os.path.join(here, "execution-protocol.schema.json"), "protocol schema")
check(protocol, protocol_schema, protocol_schema, "protocol")
if problems:
    finish()

prereg_rel = protocol["preregistration"]["path"]
prereg_abs = resolve(prereg_rel)
if not os.path.isfile(prereg_abs):
    bad(f"protocol.preregistration: {prereg_rel} does not exist")
    finish()
if digest_of(prereg_abs) != protocol["preregistration"]["sha256"]:
    bad(f"protocol.preregistration: {prereg_rel} does not hash to the digest the protocol was "
        f"built against")
    finish()
prereg = load(prereg_abs, "preregistration")

for field in ("feature_id", "work_package", "attempt_id"):
    if result.get(field) != protocol.get(field):
        bad(f"result.{field} {result.get(field)!r} is not the protocol's {protocol.get(field)!r}")

# --- arms ---------------------------------------------------------------------------------------

assigned = {arm["arm_id"]: arm for arm in protocol["arms"]}
reported = {}
for index, arm in enumerate(result["arms"]):
    label = f"result.arms[{index}]"
    arm_id = arm["arm_id"]
    if arm_id in reported:
        bad(f"{label}: {arm_id} is reported twice; an arm reported once cannot be added or renamed")
        continue
    reported[arm_id] = arm
    if arm_id not in assigned:
        bad(f"{label}: {arm_id} is not an arm the protocol assigned")
        continue
    if arm.get("axis_id") != assigned[arm_id]["axis_id"]:
        bad(f"{label}: {arm_id} is reported under axis {arm.get('axis_id')!r}, not the assigned "
            f"{assigned[arm_id]['axis_id']!r}")

for arm_id in assigned:
    if arm_id not in reported:
        bad(f"result.arms: the protocol assigned {arm_id} and the result does not report it; an "
            f"arm that quietly disappears is the one that disagreed")

REJECTED_PRODUCERS = {
    "model": "a model reporting on what it is running as is not an observation of the host",
    "self_report": "a self-report is not an observation of the host",
    "plugin": "the plugin under test cannot attest its own effective metadata",
    "yaml": "re-reading the declarations restates the thing under test",
    "frontmatter": "re-reading the declarations restates the thing under test",
    "declared": "a declaration is not a record of what was in force",
    "cc_registry_session_resolution_v1": "the static registry snapshot is a fact about the host, "
                                         "not attestation of an arm",
}


def check_attestation(arm_id, kind, attestation):
    """`available` has to survive the four substitutions that would otherwise fill it in."""
    label = f"{arm_id}.{kind}"
    producer = str(attestation.get("producer") or "")
    for marker, why in REJECTED_PRODUCERS.items():
        if marker in producer.lower():
            bad(f"{label}: producer {producer!r}: {why}")
            return
    record = attestation.get("record")
    if attestation.get("status") == "available":
        if not record:
            bad(f"{label}: is 'available' with no host record behind it")
            return
        record_path = record.get("path", "")
        if record_path.startswith("plugins/"):
            bad(f"{label}: the record {record_path} lives under the plugin tree, which is the tree "
                f"whose behaviour is the question")
            return
        record_abs = resolve(record_path)
        if not os.path.isfile(record_abs) or os.path.islink(record_abs):
            bad(f"{label}: the record {record_path} is not a regular file")
            return
        if digest_of(record_abs) != record.get("sha256"):
            bad(f"{label}: the record {record_path} does not hash to its recorded digest")
        if attestation.get("correlated_arm_id") != arm_id:
            bad(f"{label}: correlates to {attestation.get('correlated_arm_id')!r}, not {arm_id}; a "
                f"session-wide field is a fact about the session, not about this arm")
        values = attestation.get("values") or {}
        for field in ("model", "profile"):
            if not str(values.get(field, "")).strip():
                bad(f"{label}: is 'available' with no {field} in force; 'unknown' and 'as declared' "
                    f"are the two answers this contract keeps apart")
        return
    if not attestation.get("facts"):
        bad(f"{label}: is 'unavailable' with no recorded facts; a limit has to be reviewable")
    if attestation.get("values"):
        bad(f"{label}: is 'unavailable' but carries values, so it disagrees with itself")


for arm_id, arm in sorted(reported.items()):
    if arm_id not in assigned:
        continue
    raw = arm["raw_output"]
    raw_abs = resolve(raw["path"])
    if os.path.islink(raw_abs):
        bad(f"{arm_id}: raw output is delivered through a symlink; evidence is bytes, not a pointer")
    elif not os.path.isfile(raw_abs):
        bad(f"{arm_id}: raw output {raw['path']} does not exist")
    elif os.path.getsize(raw_abs) == 0:
        bad(f"{arm_id}: raw output is empty — a no-op capture is not evidence that an arm ran")
    elif digest_of(raw_abs) != raw["sha256"]:
        bad(f"{arm_id}: raw output hashes to {digest_of(raw_abs)}, not the recorded {raw['sha256']}")
    check_attestation(arm_id, "runtime_attestation", arm["runtime_attestation"])
    check_attestation(arm_id, "backend_correlation", arm["backend_correlation"])

# --- contrasts ------------------------------------------------------------------------------------

HELD_FIELDS = ("definition_state", "model_profile", "prompt_sha256", "source_sha256",
               "repo_state_sha256", "invocation_mode", "session_construction")
axes = {axis["axis_id"]: axis for axis in prereg.get("axes", [])}

prohibited = [entry.get("claim", "").strip().lower()
              for entry in result.get("prohibited_conclusions", [])]
sealed = [entry.get("claim", "").strip().lower()
          for entry in prereg.get("prohibited_conclusions", [])]
if sorted(prohibited) != sorted(sealed):
    bad("result.prohibited_conclusions does not carry the sealed set forward; a conclusion the "
        "design ruled out cannot be dropped by a result that no longer mentions it")

for index, contrast in enumerate(result["contrasts"]):
    label = f"result.contrasts[{index}]"
    # M5 retains this verifier as deterministic scaffold only. Its attestation document is still
    # supplied by the fixture launcher, so even a well-formed `available` record cannot carry a
    # causal verdict. P0.7/P0.8 must replace this boundary with a qualified host producer before
    # `supports` or `refutes` can become reachable.
    if contrast["verdict"] != "inconclusive":
        bad(f"{label}: causal verdict {contrast['verdict']!r} is deferred to P0.7/P0.8; "
            f"bootstrap E3 records are deterministic scaffold, not host proof")
    axis = axes.get(contrast["axis_id"])
    if axis is None:
        bad(f"{label}: axis {contrast['axis_id']!r} is not in the preregistration")
        continue
    axis_arms = {arm["arm_id"]: arm for arm in axis.get("arms", [])}
    if sorted(contrast["arm_ids"]) != sorted(axis_arms):
        bad(f"{label}: pairs {sorted(contrast['arm_ids'])}, not the preregistered "
            f"{sorted(axis_arms)}")
        continue
    if contrast["claim"].strip().lower() in prohibited:
        bad(f"{label}: restates a conclusion the preregistration prohibited")

    reasons = []
    for arm_id in contrast["arm_ids"]:
        arm = reported.get(arm_id)
        if arm is None:
            reasons.append(f"{arm_id} was not reported")
            continue
        if arm["status"] != "completed":
            reasons.append(f"{arm_id} is {arm['status']}")
        if arm["runtime_attestation"].get("status") != "available":
            reasons.append(f"{arm_id} carries no runtime attestation")
    varied = axis.get("varies")
    for field in HELD_FIELDS:
        if field == varied:
            continue
        values = {json.dumps(axis_arms[arm_id].get(field), sort_keys=True)
                  for arm_id in contrast["arm_ids"]}
        if len(values) > 1:
            reasons.append(f"{field} differs across the pair though the axis holds it constant")
    if len({json.dumps(axis_arms[arm_id].get(varied), sort_keys=True)
            for arm_id in contrast["arm_ids"]}) < 2:
        reasons.append(f"the arms do not differ in {varied!r}, so there is no contrast")

    if reasons and contrast["verdict"] != "inconclusive":
        bad(f"{label}: verdict {contrast['verdict']!r} rests on a contrast that is not valid "
            f"({'; '.join(sorted(set(reasons)))}); an unattested or uncontrolled pair is "
            f"INCONCLUSIVE, and no session-wide field, holistic pass, declaration re-read or model "
            f"self-report repairs it")

# --- calls ------------------------------------------------------------------------------------------

if protocol["launcher"]["kind"] == "deterministic_fixture" and result["external_calls_made"] != 0:
    bad(f"result.external_calls_made is {result['external_calls_made']} against a deterministic "
        f"fixture, which cannot make one")

if problems:
    finish()

valid = sum(1 for contrast in result["contrasts"] if contrast["verdict"] != "inconclusive")
print(f"verify-execution: {len(reported)} arm(s), {len(result['contrasts'])} contrast(s), "
      f"{valid} held to a causal verdict, {len(result['contrasts']) - valid} inconclusive")
for contrast in result["contrasts"]:
    print(f"  {contrast['axis_id']}: {contrast['verdict'].upper()} — {contrast['basis']}")
finish()
PY
