#!/bin/sh
# test-effective-metadata-contract.sh — F-083 AC1, producer-contract half.
#
# `cc_registry_session_resolution_v1` is frozen precisely so an executor cannot pick a producer
# that agrees with it. Every case here is a producer that would have been convenient: the plugin
# reporting on itself, a model saying what it thinks it is running as, a re-read of the YAML that
# was the thing under test. Each has to be rejected by name, not merely fail a shape check,
# because the reason matters to whoever reads the failure.
#
# It also pins the M5 staging outcome. An honest unavailable observation remains distinguishable
# as BLOCKED (42), while a caller-supplied positive fixture is rejected until P0.7/P0.8 provides a
# qualified host producer. This keeps useful contract fixtures without turning their labels into
# proof about the running host.
#
# Fixtures are built at runtime under a throwaway repository. Nothing here contacts a host or a
# backend, and no real credential, bearer, or transcript is written: the correlation records are
# generated fixtures with generated identifiers.
#
# Run: sh plugins/ae/tests/scripts/test-effective-metadata-contract.sh
# Exit 0 = every assertion held. Exit 1 = at least one did not.

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS/../../../.." && pwd))"
SUBJECT="$REPO/plugins/ae/tests/live/cc-host/effective-metadata/verify-effective-snapshot.sh"

[ -f "$SUBJECT" ] || { echo "  FAIL: subject missing: $SUBJECT" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "  FAIL: python3 is required" >&2; exit 1; }

exec python3 - "$SUBJECT" "$REPO" <<'PY'
import copy, hashlib, json, os, shutil, subprocess, sys, tempfile

SUBJECT, REPO = sys.argv[1], sys.argv[2]
passed, failed = [], []


def ok(message):
    passed.append(message)
    print(f"  ok: {message}")


def bad(message, detail=""):
    failed.append(message)
    print(f"  FAIL: {message}", file=sys.stderr)
    if detail:
        for line in detail.strip().split("\n")[:5]:
            print(f"       {line}", file=sys.stderr)


DEFINITIONS = [
    ("plugins/ae/agents/workflow/gemini-proxy.md", "gemini-proxy", "agent"),
    ("plugins/ae/skills/discuss/SKILL.md", "ae:discuss", "skill"),
    ("plugins/ae/skills/plan/SKILL.md", "ae:plan", "skill"),
    ("plugins/ae/skills/review/SKILL.md", "ae:review", "skill"),
    ("plugins/ae/skills/analyze/SKILL.md", "ae:analyze", "skill"),
    ("plugins/ae/skills/work/SKILL.md", "ae:work", "skill"),
]
SESSION = "00000000-0000-4000-8000-00000000f083"
ROOT_PATH = "/fixture/plugin-dir/plugins/ae"
RECORD = ".ae/bootstrap/F-083/evidence/fixture/session-init.json"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def build(status="available", mutate=None):
    """A complete, valid snapshot in a throwaway repo. `mutate` makes exactly one thing wrong."""
    root = tempfile.mkdtemp()
    subprocess.run(["git", "init", "-q", root], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def write(rel, data):
        path = os.path.join(root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        blob = data if isinstance(data, bytes) else json.dumps(data, indent=2).encode()
        with open(path, "wb") as handle:
            handle.write(blob)
        return sha(blob)

    record_digest = write(RECORD, {"type": "system", "subtype": "init", "session_id": SESSION,
                                   "plugins": [{"name": "ae", "path": ROOT_PATH}]})
    plugin_list_digest = write(".ae/bootstrap/F-083/evidence/fixture/plugin-list.json",
                               [{"id": "ae@agentic-engineering", "installPath": ROOT_PATH}])

    definition_digests = {}
    for rel, _cid, _kind in DEFINITIONS:
        definition_digests[rel] = write(rel, f"---\nname: {os.path.basename(rel)}\n---\nbody\n".encode())

    rows = []
    for rel, component_id, kind in DEFINITIONS:
        rows.append({
            "definition_path": rel, "definition_sha256": definition_digests[rel],
            "component_id": component_id, "component_kind": kind,
            "session_id": SESSION, "source_root": ROOT_PATH,
            "effective": {"model": "claude-opus-5", "tools": "Read, Grep", "effort": "high"},
            "correlation": {"record_path": RECORD, "record_sha256": record_digest,
                            "locator": f"$.components[?(@.id=='{component_id}')]"},
        })

    snapshot = {
        "artifact_kind": "cc_registry_session_resolution_v1", "artifact_version": 1,
        "authority": "bootstrap_non_authoritative",
        "producer": {
            "kind": "cc_registry_session_resolution_v1",
            "generated_by": "claude-code-host", "host_build": "2.1.231",
            "invocation_mode": "bare_plugin_dir_registry_discovery", "session_id": SESSION,
            "argv": ["claude", "--bare", "--plugin-dir", "plugins/ae"],
            "raw_records": [
                {"record_kind": "session_init", "path": RECORD, "sha256": record_digest},
                {"record_kind": "plugin_list",
                 "path": ".ae/bootstrap/F-083/evidence/fixture/plugin-list.json",
                 "sha256": plugin_list_digest},
            ]},
        "resolution": {"plugin_id": "ae@agentic-engineering", "source_root": ROOT_PATH,
                       "source_root_kind": "plugin_dir", "session_id": SESSION,
                       "cc_build": "2.1.231", "mode": "plan"},
        "availability": {"status": "available", "unavailable_facts": []},
        "rows": rows,
    }

    if status == "unavailable":
        snapshot["availability"] = {
            "status": "unavailable",
            "unavailable_facts": [{
                "fact": "no per-definition effective model/tools/effort is emitted",
                "observed_in": RECORD,
                "observation": "skills and agents are name lists; no metadata accompanies them"}]}
        snapshot["rows"] = []

    if mutate == "plugin_authored_producer":
        snapshot["producer"]["generated_by"] = "plugin_ae_producer_script"
    if mutate == "model_self_report":
        snapshot["producer"]["generated_by"] = "model_self_report"
    if mutate == "yaml_reread":
        snapshot["producer"]["generated_by"] = "yaml_reread_of_frontmatter"
    if mutate == "self_declared_kind":
        snapshot["producer"]["kind"] = "cc_registry_session_resolution_v1"
        snapshot["artifact_kind"] = "ae_effective_metadata_v2"
    if mutate == "plugin_authored_record":
        digest = write("plugins/ae/tests/live/cc-host/effective-metadata/fixture-record.json", {"x": 1})
        snapshot["producer"]["raw_records"][0] = {
            "record_kind": "session_debug",
            "path": "plugins/ae/tests/live/cc-host/effective-metadata/fixture-record.json",
            "sha256": digest}
    if mutate == "cross_session_row":
        snapshot["rows"][2]["session_id"] = "11111111-0000-4000-8000-00000000f083"
    if mutate == "cross_root_row":
        snapshot["rows"][1]["source_root"] = "/some/other/install/root"
    if mutate == "missing_effective_field":
        snapshot["rows"][0]["effective"]["effort"] = ""
    if mutate == "missing_row":
        snapshot["rows"] = snapshot["rows"][:-1]
    if mutate == "duplicate_row":
        snapshot["rows"].append(copy.deepcopy(snapshot["rows"][0]))
    if mutate == "forged_correlation":
        snapshot["rows"][0]["correlation"]["record_sha256"] = sha(b"not this record")
    if mutate == "unknown_field":
        snapshot["rows"][0]["declared"] = {"model": "opus"}
    if mutate == "available_with_facts":
        snapshot["availability"]["unavailable_facts"] = [
            {"fact": "x", "observed_in": "y", "observation": "z"}]
    if mutate == "unavailable_with_rows":
        snapshot["availability"] = {
            "status": "unavailable",
            "unavailable_facts": [{"fact": "f", "observed_in": "o", "observation": "b"}]}
    if mutate == "unavailable_without_facts":
        snapshot["availability"] = {"status": "unavailable", "unavailable_facts": []}
        snapshot["rows"] = []

    write(".ae/snapshot.json", snapshot)
    return root, os.path.join(root, ".ae/snapshot.json")


def run(path, *flags):
    proc = subprocess.run(["sh", SUBJECT, *flags, "--snapshot", path],
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return proc.returncode, proc.stdout.decode("utf-8", "replace")


# --- the three outcomes -----------------------------------------------------------------------
root, path = build()
code, out = run(path)
if code != 0 and "deferred to p0.7/p0.8" in out.lower():
    ok("a structurally complete positive snapshot remains non-authoritative until P0.7/P0.8")
else:
    bad("a caller-supplied positive snapshot escaped the M5 deferred boundary", out)
shutil.rmtree(root)

root, path = build(status="unavailable")
code, out = run(path)
if code == 42:
    ok("an honest 'the host cannot emit this' snapshot exits 42 — blocked, not invalid")
elif code == 0:
    bad("an unavailable snapshot was reported as a satisfied AC1", out)
else:
    bad(f"an unavailable snapshot exited {code}; blocked must be distinguishable from invalid", out)
shutil.rmtree(root)

# --- the two dimensions ------------------------------------------------------------------------
# `--accept-unavailable` is where the declaration answer and the attestation answer stop being one
# number. The pair of assertions that matter are that it says 'unavailable' out loud with the
# no-claim sentence attached, and that it rescues nothing else.
root, path = build(status="unavailable")
code, out = run(path, "--accept-unavailable")
lowered = out.lower()
if code != 0:
    bad(f"an honest unavailable attestation exited {code} under --accept-unavailable", out)
elif "declaration_result: pass" not in lowered or \
        "effective_metadata_attestation: unavailable" not in lowered:
    bad("--accept-unavailable did not report the two dimensions separately", out)
elif "makes no claim" not in lowered:
    bad("--accept-unavailable accepted an unavailable host without disclaiming force", out)
else:
    ok("--accept-unavailable reports declaration and attestation as separate answers")
shutil.rmtree(root)

root, path = build(mutate="unavailable_with_rows")
code, out = run(path, "--accept-unavailable")
if code == 0:
    bad("--accept-unavailable turned an invalid snapshot into an accepted one", out)
elif "partial row set" not in out.lower():
    bad("--accept-unavailable rejected an invalid snapshot for the wrong reason", out)
else:
    ok("--accept-unavailable rescues an honest observation, never an invalid snapshot")
shutil.rmtree(root)

root, path = build(status="unavailable")
code, out = run(path)
if code == 42:
    ok("without the flag the same snapshot still blocks rather than passing")
else:
    bad(f"the flag changed the default outcome; the same snapshot exited {code}", out)
shutil.rmtree(root)

CASES = [
    ("plugin_authored_producer", "a plugin-authored producer", "plugin"),
    ("model_self_report", "a model self-report", "not an observation of the host"),
    ("yaml_reread", "a YAML re-read of the definitions", "restates the declaration"),
    ("self_declared_kind", "an artifact kind this snapshot chose for itself", "artifact_kind"),
    ("plugin_authored_record", "a raw record living inside the plugin tree", "plugin tree"),
    ("cross_session_row", "a row correlated to a different session", "another world"),
    ("cross_root_row", "a row resolved to a different source root", "resolved to root"),
    ("missing_effective_field", "an empty effective field", "empty where a value is required"),
    ("missing_row", "a snapshot covering only some definitions", "no row for"),
    ("duplicate_row", "two rows for one definition", "one definition, one row"),
    ("forged_correlation", "a correlation digest that is not the record's", "does not hash"),
    ("unknown_field", "an unknown field smuggled into a row", "unknown field"),
    ("available_with_facts", "a snapshot that disagrees with itself about availability",
     "disagrees with itself"),
    ("unavailable_with_rows", "rows present under an 'unavailable' status", "partial row set"),
    ("unavailable_without_facts", "'unavailable' asserted with no facts", "reviewable"),
]

for mutation, description, signature in CASES:
    root, path = build(mutate=mutation)
    code, out = run(path)
    if code == 0:
        bad(f"accepted {description}")
    elif code == 42:
        bad(f"reported {description} as merely blocked", out)
    elif signature.lower() not in out.lower():
        bad(f"rejected {description}, but not for that reason (wanted {signature!r})", out)
    else:
        ok(f"rejects {description}")
    shutil.rmtree(root)

# No real secret may reach a tracked path. The fixtures are generated, and this asserts it rather
# than trusting it: the tracked live tree holds harness, schema and sanitized fixtures only.
live = os.path.join(REPO, "plugins/ae/tests/live")
leaked = []
for directory, _subdirs, files in os.walk(live) if os.path.isdir(live) else ():
    for name in files:
        text = open(os.path.join(directory, name), encoding="utf-8", errors="ignore").read()
        for marker in ("sk-ant-", "ANTHROPIC_API_KEY=", "Bearer ey", "-----BEGIN"):
            if marker in text:
                leaked.append(f"{os.path.relpath(os.path.join(directory, name), REPO)}: {marker}")
if leaked:
    bad(f"a credential-shaped value is present under tracked tests/live: {leaked[:3]}")
else:
    ok("no credential-shaped value is stored under tracked plugins/ae/tests/live")

print()
if failed:
    print(f"test-effective-metadata-contract: FAIL ({len(failed)} of {len(passed) + len(failed)})",
          file=sys.stderr)
    raise SystemExit(1)
print(f"test-effective-metadata-contract: PASS ({len(passed)} assertions)")
PY
