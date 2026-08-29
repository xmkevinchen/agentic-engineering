#!/bin/sh
# test-e3-execution.sh — F-083 AC3/AC11, execution half.
#
# The preregistration half proves a design was a commitment. This half proves the two things that
# come after it: that the runner cannot start an arm nobody approved, and that a result cannot
# claim more than its attestation carries.
#
# Every arm here runs through a deterministic fixture launcher built at runtime — a shell script
# that prints canned bytes and, when the arm asks it to, writes an attestation record. No host CLI,
# no model, no backend, no network, and no path outside the throwaway repository and TMPDIR. The
# `host_cli` launcher kind is exercised only through its permanent M5 refusal. A future P0.7/P0.8
# adapter needs new code and new authorization; no document can promote this scaffold.
#
# Run: sh plugins/ae/tests/scripts/test-e3-execution.sh
# Exit 0 = every assertion held. Exit 1 = at least one did not.

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS/../../../.." && pwd))"
RUNNER="$REPO/plugins/ae/tests/live/cc-host/e3/run-experiment.mjs"
VERIFIER="$REPO/plugins/ae/tests/live/cc-host/e3/verify-execution.sh"

[ -f "$RUNNER" ] || { echo "  FAIL: runner missing: $RUNNER" >&2; exit 1; }
[ -f "$VERIFIER" ] || { echo "  FAIL: verifier missing: $VERIFIER" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "  FAIL: python3 is required" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "  FAIL: git is required" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "  FAIL: node is required" >&2; exit 1; }

exec python3 - "$RUNNER" "$VERIFIER" <<'PY'
import copy, hashlib, json, os, shutil, subprocess, sys, tempfile

RUNNER, VERIFIER = sys.argv[1], sys.argv[2]
passed, failed = [], []

# The E3 root the protocol forbids for this attempt's whole lifetime. Nothing here may create it,
# and the assertion below is cheap enough to keep next to the code that could.
FORBIDDEN_E3_ROOT = "/private/tmp/ae-f083-e3"

PROMPT = "a" * 64
SOURCE = "b" * 64
REPO_STATE = "c" * 64


def ok(message):
    passed.append(message)
    print(f"  ok: {message}")


def bad(message, detail=""):
    failed.append(message)
    print(f"  FAIL: {message}", file=sys.stderr)
    if detail:
        for line in detail.strip().split("\n")[:6]:
            print(f"       {line}", file=sys.stderr)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def digest(path):
    with open(path, "rb") as handle:
        return sha(handle.read())


# A launcher that answers from canned bytes. It writes the arm's attestation only when the arm
# asks for one, which is what makes "no attestation" a reachable, honest state rather than a bug.
FIXTURE = """#!/bin/sh
printf 'arm %s answered from canned bytes\\n' "$E3_ARM_ID"
if [ "${E3_EMIT_ATTESTATION:-1}" = "1" ]; then
  printf '{"status":"available","producer":"cc_host_runtime_attestation_v1",' > "$E3_ATTESTATION_PATH"
  printf '"correlated_arm_id":"%s","values":{"model":"%s","profile":"%s"},"facts":[]}\\n' \\
    "${E3_ATTESTED_ARM_ID:-$E3_ARM_ID}" "$E3_MODEL" "$E3_PROFILE" >> "$E3_ATTESTATION_PATH"
fi
"""


def build(mutate=""):
    """A complete, approved world: preregistration, fixture launcher, protocol, authorization."""
    root = tempfile.mkdtemp()
    subprocess.run(["git", "init", "-q", root], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    temp_root = os.path.join(root, "run")

    def write(rel, data, mode=0o600):
        path = os.path.join(root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        blob = data if isinstance(data, bytes) else json.dumps(data, indent=2).encode()
        with open(path, "wb") as handle:
            handle.write(blob)
        os.chmod(path, mode)
        return path

    fixture_path = write("fixture-launcher.sh", FIXTURE.encode(), mode=0o700)

    def arm_spec(arm_id, axis_id, state, profile):
        return {"arm_id": arm_id, "definition_state": state, "model_profile": profile,
                "prompt_sha256": PROMPT, "source_sha256": SOURCE,
                "repo_state_sha256": REPO_STATE, "invocation_mode": "print_stream_json",
                "session_construction": "fresh_no_persistence",
                "isolation": {"disposable": True,
                              "profile_root": f"{temp_root}/{arm_id}/profile",
                              "cache_root": f"{temp_root}/{arm_id}/cache",
                              "repo_root": f"{temp_root}/{arm_id}/repo",
                              "plugin_copy_root": f"{temp_root}/{arm_id}/plugin",
                              "cleanup_manifest": f"{temp_root}/{arm_id}/cleanup.json"},
                "axis_id": axis_id}

    specs = [arm_spec("E3-AX01-VALID", "AX-01", "valid", "profile-A"),
             arm_spec("E3-AX01-INVALID", "AX-01", "isolated_invalid", "profile-A"),
             arm_spec("E3-AX02-A", "AX-02", "valid", "profile-A"),
             arm_spec("E3-AX02-B", "AX-02", "valid", "profile-B")]
    if mutate == "held_field_differs":
        specs[2] = {**specs[2], "prompt_sha256": sha(b"an edited prompt")}

    def sealed(spec):
        return {key: value for key, value in spec.items() if key != "axis_id"}

    prereg = {
        "artifact_kind": "e3_preregistration_v1", "artifact_version": 1,
        "authority": "bootstrap_non_authoritative", "feature_id": "F-083",
        "work_package": "WP-P0.0", "attempt_id": "A-003",
        "results_observed": False, "external_calls_made": 0,
        "axes": [
            {"axis_id": "AX-01", "question": "does definition validity alone change the outcome?",
             "varies": "definition_state", "arms": [sealed(specs[0]), sealed(specs[1])]},
            {"axis_id": "AX-02", "question": "does the attested profile alone change the outcome?",
             "varies": "model_profile", "arms": [sealed(specs[2]), sealed(specs[3])]}],
        "prohibited_conclusions": [
            {"claim": "a capability-tier cause for the observed difference",
             "why_unsupported": "tier is confounded unless both profiles are host-attested"}],
    }
    prereg_path = write(".ae/prereg.json", prereg)

    def arm(spec):
        arm_root = f"{temp_root}/{spec['arm_id']}"
        environment = {
            "PATH": "/usr/bin:/bin", "HOME": f"{arm_root}/profile",
            "TMPDIR": f"{arm_root}/cache", "LANG": "C", "LC_ALL": "C",
            "E3_ARM_ID": spec["arm_id"], "E3_MODEL": "canned-model",
            "E3_PROFILE": spec["model_profile"],
            "E3_ATTESTATION_PATH": f"{arm_root}/attestation.json",
        }
        if mutate == "no_attestation" and spec["arm_id"] == "E3-AX01-INVALID":
            environment["E3_EMIT_ATTESTATION"] = "0"
        if mutate == "foreign_correlation" and spec["arm_id"] == "E3-AX02-B":
            environment["E3_ATTESTED_ARM_ID"] = "E3-AX02-A"
        output = {"raw_output": f"{arm_root}/raw.txt", "attestation": f"{arm_root}/attestation.json"}
        if mutate == "output_outside_root":
            output = {**output, "raw_output": os.path.join(root, "escaped-raw.txt")}
        return {"arm_id": spec["arm_id"], "axis_id": spec["axis_id"],
                "argv": [fixture_path], "environment": environment,
                "isolation": spec["isolation"], "output": output}

    protocol = {
        "artifact_kind": "e3_execution_protocol_v1", "artifact_version": 1,
        "authority": "bootstrap_non_authoritative", "feature_id": "F-083",
        "work_package": "WP-P0.0", "attempt_id": "A-007",
        "preregistration": {"path": prereg_path, "sha256": digest(prereg_path)},
        "human_gate": {"code": "E3_HUMAN_GATE", "status": "approved",
                       "decision_ref": ".ae/decision-register.md#D-999",
                       "decision_entry_sha256": sha(b"the approval row")},
        "launcher": {"kind": "deterministic_fixture", "path": "/bin/sh",
                     "sha256": digest("/bin/sh")},
        "launcher_script": {"path": fixture_path, "sha256": digest(fixture_path)},
        "budgets": {"per_process_usd": 0.25, "aggregate_usd": 1, "max_processes": 4,
                    "executor_retries": 0},
        "temp_root": temp_root,
        "arms": [arm(spec) for spec in specs],
    }
    if mutate == "gate_pending":
        protocol["human_gate"] = {**protocol["human_gate"], "status": "pending"}
    if mutate == "host_launcher_with_script":
        protocol["launcher"] = {**protocol["launcher"], "kind": "host_cli"}
    if mutate == "host_launcher_deferred":
        protocol["launcher"] = {**protocol["launcher"], "kind": "host_cli"}
        protocol["launcher_script"] = None
    protocol_path = write(".ae/protocol.json", protocol)

    if mutate == "launcher_script_drift":
        write("fixture-launcher.sh", (FIXTURE + "# an edit after approval\n").encode(), mode=0o700)
    if mutate == "output_present":
        os.makedirs(f"{temp_root}/E3-AX01-VALID", exist_ok=True)
        with open(f"{temp_root}/E3-AX01-VALID/raw.txt", "w", encoding="utf-8") as handle:
            handle.write("output from a run nobody recorded\n")

    authorization = {
        "artifact_kind": "e3_execution_authorization_v1", "artifact_version": 1,
        "execution_authorized": True,
        "protocol": {"path": protocol_path, "sha256": digest(protocol_path)},
        "human_gate_decision_entry_sha256": protocol["human_gate"]["decision_entry_sha256"],
        "external_calls_authorized": False,
    }
    if mutate == "fixture_authorized_for_calls":
        authorization["external_calls_authorized"] = True
    if mutate == "host_launcher_deferred":
        authorization["external_calls_authorized"] = True
    if mutate == "authorization_binds_other_protocol":
        authorization["protocol"] = {**authorization["protocol"], "sha256": sha(b"another protocol")}
    authorization_path = write(".ae/authorization.json", authorization)

    return {"root": root, "protocol": protocol_path, "authorization": authorization_path,
            "result": os.path.join(root, ".ae/execution-result.json"), "temp_root": temp_root}


def run(*args):
    proc = subprocess.run(list(args), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return proc.returncode, proc.stdout.decode("utf-8", "replace")


def plan(world):
    return run("node", RUNNER, "--plan", world["protocol"])


def execute(world):
    return run("node", RUNNER, "--execute", world["protocol"],
               "--authorization", world["authorization"], "--result", world["result"])


def verify(path):
    return run("sh", VERIFIER, path)


# --- the runner ---------------------------------------------------------------------------------

world = build()
code, out = plan(world)
if code != 0:
    bad("a complete protocol could not even be planned; every case below is meaningless", out)
elif os.path.isdir(world["temp_root"]):
    bad("--plan created the temp root; planning starts nothing", out)
elif out.count("E3-AX0") < 4:
    bad("--plan did not print the argv of every arm", out)
else:
    ok("--plan validates the protocol and prints each arm's exact argv without starting one")
shutil.rmtree(world["root"])

REFUSALS = [
    ("gate_pending", "an unapproved human gate", "human gate is"),
    ("authorization_binds_other_protocol", "an authorization bound to other bytes",
     "not this protocol's bytes"),
    ("fixture_authorized_for_calls", "a deterministic fixture authorized to spend calls",
     "cannot be authorized for external calls"),
    ("host_launcher_with_script", "a host launcher wrapped in an interposed script",
     "no interposed script"),
    ("host_launcher_deferred", "a host launcher even with an external-call authorization",
     "deferred to P0.7/P0.8"),
    ("launcher_script_drift", "a launcher script edited after approval", "not the approved"),
    ("output_outside_root", "an arm writing outside the approved isolation", "temp_root"),
    ("output_present", "an arm whose output already exists", "already exists"),
]

for mutation, description, signature in REFUSALS:
    world = build(mutate=mutation)
    code, out = execute(world)
    if code == 0:
        bad(f"ran with {description}")
    elif signature.lower() not in out.lower():
        bad(f"refused {description}, but not for that reason (wanted {signature!r})", out)
    elif os.path.isfile(world["result"]):
        bad(f"refused {description} but sealed a result anyway", out)
    else:
        ok(f"refuses to run with {description}")
    shutil.rmtree(world["root"])

# --- one deterministic execution ------------------------------------------------------------------

world = build()
code, out = execute(world)
if code != 0:
    bad("the deterministic fixture execution failed", out)
    sealed_result = None
else:
    sealed_result = json.load(open(world["result"], encoding="utf-8"))
    missing = [arm["arm_id"] for arm in sealed_result["arms"]
               if not os.path.isfile(arm["raw_output"]["path"])]
    if missing:
        bad(f"arms produced no raw output: {missing}")
    elif sealed_result["external_calls_made"] != 0:
        bad(f"a deterministic fixture recorded {sealed_result['external_calls_made']} external call(s)")
    elif any(contrast["verdict"] != "inconclusive" for contrast in sealed_result["contrasts"]):
        bad("the runner decided a causal verdict; that belongs to the verifier and its evidence")
    else:
        ok("four arms run through a deterministic fixture, zero external calls, no verdict claimed")

if os.path.lexists(FORBIDDEN_E3_ROOT):
    bad(f"the forbidden E3 root {FORBIDDEN_E3_ROOT} exists after a deterministic run")
else:
    ok("the deterministic run created nothing under the forbidden E3 root")

if sealed_result is not None:
    code, out = verify(world["result"])
    if code == 0:
        ok("a result whose verdicts match its attestation is accepted")
    else:
        bad("the sealed deterministic result was rejected; the cases below are differential", out)


def mutated(base_world, change):
    """One edit to a sealed result, written beside it so the original stays readable."""
    document = copy.deepcopy(sealed_result)
    change(document)
    path = os.path.join(base_world["root"], ".ae/mutated-result.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(document, handle, indent=2)
    return path


def attest_all(document):
    """Every arm attested, so a verdict below fails for the reason under test and not for this."""
    for arm in document["arms"]:
        arm["runtime_attestation"]["status"] = "available"


RESULT_CASES = [
    ("a fully fixture-attested causal verdict",
     "deferred to P0.7/P0.8",
     lambda document: (attest_all(document),
                       document["contrasts"][0].update({"verdict": "supports"}))),
    ("an arm the protocol assigned but the result drops",
     "does not report it",
     lambda document: document["arms"].pop()),
    ("an arm reported twice",
     "reported twice",
     lambda document: document["arms"].append(copy.deepcopy(document["arms"][0]))),
    ("a model reporting on what it ran as",
     "not an observation of the host",
     lambda document: document["arms"][0]["runtime_attestation"].update(
         {"producer": "model_self_report"})),
    ("the static registry snapshot cited as arm attestation",
     "not attestation of an arm",
     lambda document: document["arms"][0]["runtime_attestation"].update(
         {"producer": "cc_registry_session_resolution_v1"})),
    ("raw output that does not hash to its record",
     "not the recorded",
     lambda document: document["arms"][0]["raw_output"].update({"sha256": sha(b"other bytes")})),
    ("external calls recorded against a fixture that cannot make one",
     "cannot make one",
     lambda document: document.update({"external_calls_made": 2})),
    ("a prohibited conclusion dropped from the result",
     "cannot be dropped",
     lambda document: document.update({"prohibited_conclusions": [
         {"claim": "something else entirely", "why_unsupported": "unrelated"}]})),
    ("a contrast restating the conclusion the design prohibited",
     "restates a conclusion",
     lambda document: document["contrasts"][0].update(
         {"claim": "a capability-tier cause for the observed difference"})),
]

if sealed_result is not None:
    for description, signature, change in RESULT_CASES:
        path = mutated(world, change)
        code, out = verify(path)
        if code == 0:
            bad(f"accepted {description}")
        elif signature.lower() not in out.lower():
            bad(f"rejected {description}, but not for that reason (wanted {signature!r})", out)
        else:
            ok(f"rejects {description}")
    shutil.rmtree(world["root"])

# --- the verdict a missing attestation forces -------------------------------------------------------

world = build(mutate="no_attestation")
code, out = execute(world)
if code != 0:
    bad("an arm whose launcher emitted no attestation should still run and record the absence", out)
else:
    sealed_result = json.load(open(world["result"], encoding="utf-8"))
    unattested = [arm["arm_id"] for arm in sealed_result["arms"]
                  if arm["runtime_attestation"]["status"] != "available"]
    if unattested != ["E3-AX01-INVALID"]:
        bad(f"expected exactly the unattested arm to record it; got {unattested}")
    else:
        ok("an arm with no host record is 'unavailable' with facts, not a gap to be filled in")
    code, out = verify(world["result"])
    if code != 0:
        bad("an honest inconclusive result was rejected", out)
    else:
        ok("INCONCLUSIVE satisfies the evidence obligation with an arm the host cannot attest")

    path = mutated(world, lambda document: document["contrasts"][0].update({"verdict": "supports"}))
    code, out = verify(path)
    if code == 0:
        bad("accepted a causal verdict resting on an arm with no runtime attestation")
    elif "inconclusive" not in out.lower():
        bad("rejected the unattested causal verdict, but not as inconclusive", out)
    else:
        ok("rejects a 'supports' verdict on a pair the host cannot attest")
shutil.rmtree(world["root"])

world = build(mutate="foreign_correlation")
code, out = execute(world)
if code != 0:
    bad("the foreign-correlation world failed to run", out)
else:
    code, out = verify(world["result"])
    if code == 0:
        bad("accepted an attestation correlated to a different arm")
    elif "not about this arm" not in out.lower():
        bad("rejected the foreign correlation, but not for that reason", out)
    else:
        ok("rejects a session-wide record correlated to some other arm")
shutil.rmtree(world["root"])

world = build(mutate="held_field_differs")
code, out = execute(world)
if code != 0:
    bad("the drifted-held-field world failed to run", out)
else:
    sealed_result = json.load(open(world["result"], encoding="utf-8"))
    path = mutated(world, lambda document: (attest_all(document),
                                            document["contrasts"][1].update({"verdict": "refutes"})))
    code, out = verify(path)
    if code == 0:
        bad("accepted a causal verdict on a pair that differs in a field the axis holds constant")
    elif "holds it constant" not in out.lower():
        bad("rejected the uncontrolled pair, but not for that reason", out)
    else:
        ok("rejects a causal verdict on a pair whose held-constant field is not held")
shutil.rmtree(world["root"])

print()
if failed:
    print(f"test-e3-execution: FAIL ({len(failed)} of {len(passed) + len(failed)})", file=sys.stderr)
    raise SystemExit(1)
print(f"test-e3-execution: PASS ({len(passed)} assertions)")
PY
