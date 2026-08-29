#!/bin/sh
# test-e3-preregistration.sh — F-083 AC3/AC11, preregistration half.
#
# Every case is a preregistration that would still have read as rigorous. The one that matters
# most is the quiet one: an axis declaring a field held constant when the arms disagree about it.
# That is not a lie anyone tells on purpose — it is what happens when a prompt gets edited between
# arms — and it is precisely how the E3 result this replaces ended up with two live explanations
# for one difference.
#
# The rest are ways a commitment turns into a description: results already observed, external
# calls already spent, arm output already on disk, an axis varying two things at once, an arm
# renamed or duplicated after the fact, an invalid arm pointed at a real profile or the real
# repository, a binding digest belonging to a different plan, and a missing prohibition on the
# tier/density claim.
#
# Fixtures are built at runtime in a throwaway repository. No host, no backend, no model call.
#
# Run: sh plugins/ae/tests/scripts/test-e3-preregistration.sh
# Exit 0 = every assertion held. Exit 1 = at least one did not.

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
REPO="$(git -C "$THIS" rev-parse --show-toplevel 2>/dev/null || (cd "$THIS/../../../.." && pwd))"
SUBJECT="$REPO/plugins/ae/tests/live/cc-host/e3/validate-preregistration.sh"

[ -f "$SUBJECT" ] || { echo "  FAIL: subject missing: $SUBJECT" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "  FAIL: python3 is required" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "  FAIL: git is required" >&2; exit 1; }

exec python3 - "$SUBJECT" <<'PY'
import copy, hashlib, json, os, shutil, subprocess, sys, tempfile

SUBJECT = sys.argv[1]
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
    "plugins/ae/agents/workflow/gemini-proxy.md",
    "plugins/ae/skills/discuss/SKILL.md",
    "plugins/ae/skills/plan/SKILL.md",
    "plugins/ae/skills/review/SKILL.md",
    "plugins/ae/skills/analyze/SKILL.md",
    "plugins/ae/skills/work/SKILL.md",
]
PROMPT = "a" * 64
SOURCE = "b" * 64
REPO_STATE = "c" * 64
HELD = ["prompt_sha256", "source_sha256", "repo_state_sha256", "invocation_mode",
        "session_construction"]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def build(mutate=None):
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

    feature = ".ae/features/active/F-083-ae-v1-implementation"
    plan_digest = write(f"{feature}/plan.md", b"# plan\n")
    goal_digest = write(f"{feature}/goal.frozen.md", b"## Acceptance Criteria\n")
    e3_digest = write(".ae/fable-v1/evidence.md", b"# corrected E3 record\n")
    definitions = [{"path": rel, "sha256": write(rel, f"---\nname: x\n---\n{rel}\n".encode())}
                   for rel in DEFINITIONS]

    def isolation(disposable=True, base="/private/tmp/e3-disposable"):
        return {"disposable": disposable, "profile_root": f"{base}/profile",
                "cache_root": f"{base}/cache", "repo_root": f"{base}/repo",
                "plugin_copy_root": f"{base}/plugin", "cleanup_manifest": f"{base}/cleanup.json"}

    def arm(arm_id, state, profile, **overrides):
        base = {"arm_id": arm_id, "definition_state": state, "model_profile": profile,
                "prompt_sha256": PROMPT, "source_sha256": SOURCE,
                "repo_state_sha256": REPO_STATE, "invocation_mode": "print_stream_json",
                "session_construction": "fresh_no_persistence",
                "isolation": isolation() if state == "isolated_invalid"
                else isolation(base="/private/tmp/e3-readonly")}
        base.update(overrides)
        return base

    prereg = {
        "artifact_kind": "e3_preregistration_v1", "artifact_version": 1,
        "authority": "bootstrap_non_authoritative", "feature_id": "F-083",
        "work_package": "WP-P0.0", "attempt_id": "A-003",
        "registered_at": "2026-08-24T00:00:00.000Z",
        "results_observed": False, "external_calls_made": 0,
        "bindings": {
            "plan": {"path": f"{feature}/plan.md", "sha256": plan_digest},
            "frozen_goal": {"path": f"{feature}/goal.frozen.md", "sha256": goal_digest},
            "definitions": definitions,
            "corrected_e3_record": {"path": ".ae/fable-v1/evidence.md", "sha256": e3_digest}},
        "axes": [
            {"axis_id": "AX-01",
             "question": "does definition validity alone change the outcome?",
             "varies": "definition_state",
             "held_constant": ["model_profile", *HELD],
             "arms": [arm("E3-AX01-VALID", "valid", "profile-A"),
                      arm("E3-AX01-INVALID", "isolated_invalid", "profile-A")]},
            {"axis_id": "AX-02",
             "question": "does the host-attested profile alone change the outcome?",
             "varies": "model_profile",
             "held_constant": ["definition_state", *HELD],
             "arms": [arm("E3-AX02-A", "valid", "profile-A"),
                      arm("E3-AX02-B", "valid", "profile-B")]},
        ],
        "unavoidable_differences": [
            {"difference": "wall-clock time between arms", "axis_id": "AX-02",
             "why_unavoidable": "arms run sequentially on one host",
             "effect_on_inference": "no backend state is shared; recorded for completeness"}],
        "prohibited_conclusions": [
            {"claim": "a capability-tier cause for the observed difference",
             "why_unsupported": "tier is confounded unless both profiles are host-attested and "
                                "every other field is held"},
            {"claim": "a prompt-density cause for the observed difference",
             "why_unsupported": "prompt bytes are held constant, so density cannot be the "
                                "explanation this design tests"}],
        "human_gate": {"code": "E3_HUMAN_GATE", "status": "pending",
                       "what_the_human_approves": "the exact arm set and isolation before any "
                                                  "external call is spent"},
    }

    if mutate == "results_observed":
        prereg["results_observed"] = True
    if mutate == "calls_spent":
        prereg["external_calls_made"] = 2
    if mutate == "arm_output_exists":
        write(".ae/bootstrap/F-083/evidence/WP-P0.0/e3/results/AX-01.json", {"winner": "profile-B"})
    if mutate == "varies_two_fields":
        prereg["axes"][0]["arms"][1]["model_profile"] = "profile-B"
    if mutate == "held_constant_is_not":
        prereg["axes"][1]["arms"][1]["prompt_sha256"] = sha(b"an edited prompt")
    if mutate == "duplicate_arm_id":
        prereg["axes"][1]["arms"][1]["arm_id"] = "E3-AX01-VALID"
    if mutate == "no_contrast":
        prereg["axes"][1]["arms"][1]["model_profile"] = "profile-A"
    if mutate == "uncontrolled_field":
        prereg["axes"][0]["held_constant"] = ["model_profile", "prompt_sha256"]
    if mutate == "invalid_arm_not_disposable":
        prereg["axes"][0]["arms"][1]["isolation"]["disposable"] = False
    if mutate == "invalid_arm_in_real_repo":
        prereg["axes"][0]["arms"][1]["isolation"]["repo_root"] = root
    if mutate == "invalid_arm_real_profile":
        prereg["axes"][0]["arms"][1]["isolation"]["profile_root"] = \
            os.path.expanduser("~/.claude/profile")
    if mutate == "no_cleanup_manifest":
        prereg["axes"][0]["arms"][1]["isolation"]["cleanup_manifest"] = ""
    if mutate == "binding_drift":
        prereg["bindings"]["plan"]["sha256"] = sha(b"a different plan")

    # A preregistration's plan and goal identities are carried by the capture the attempt took,
    # not by the live tree, which every approved revision moves.
    captured = [{"path": f"{feature}/goal.frozen.md", "type": "file", "mode": "0644",
                 "sha256": goal_digest, "link_target": None},
                {"path": f"{feature}/plan.md", "type": "file", "mode": "0644",
                 "sha256": plan_digest, "link_target": None}]
    if mutate == "plan_absent_from_baseline":
        captured = [row for row in captured if not row["path"].endswith("plan.md")]
    write(".ae/bootstrap/F-083/evidence/WP-P0.0/A-003/baseline-before/ignored-projection.json",
          {"artifact_kind": "bootstrap_ignored_projection", "entries": captured})
    if mutate == "superseded_material_revision":
        write(f"{feature}/plan.md", b"# plan, one approved revision later\n")
        write(f"{feature}/goal.frozen.md", b"## Acceptance Criteria\n\n### AC1 revised\n")
    if mutate == "tier_claim_allowed":
        prereg["prohibited_conclusions"] = [prereg["prohibited_conclusions"][1]]
    if mutate == "gate_pre_crossed":
        prereg["human_gate"]["status"] = "approved"
    if mutate == "one_axis":
        prereg["axes"] = prereg["axes"][:1]
    if mutate == "unknown_field":
        prereg["axes"][0]["arms"][0]["expected_outcome"] = "profile-A wins"

    write(".ae/prereg.json", prereg)
    return root, os.path.join(root, ".ae/prereg.json")


def run(path):
    proc = subprocess.run(["sh", SUBJECT, path], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return proc.returncode, proc.stdout.decode("utf-8", "replace")


root, path = build()
code, out = run(path)
if code == 0:
    ok("a complete two-axis preregistration with no arm run is accepted")
else:
    bad("the valid fixture was rejected; every case below is meaningless", out)
shutil.rmtree(root)

root, path = build(mutate="superseded_material_revision")
code, out = run(path)
if code == 0:
    ok("an immutable preregistration survives the plan and goal it was written against moving")
else:
    bad("a preregistration was failed for a revision approved after it was sealed", out)
shutil.rmtree(root)

CASES = [
    ("plan_absent_from_baseline", "a plan identity no capture enumerates",
     "not enumerated by the attempt's own before baseline"),
    ("results_observed", "a design recorded after the results", "written after the data"),
    ("calls_spent", "external calls already spent", "external_calls_made"),
    ("arm_output_exists", "arm output already on disk", "not a commitment"),
    ("varies_two_fields", "an axis varying two fields at once", "held constant but differs"),
    ("held_constant_is_not", "a held-constant field the arms disagree about", "differs across arms"),
    ("duplicate_arm_id", "a reused arm ID", "already used by"),
    ("no_contrast", "an axis whose arms are identical", "no contrast"),
    ("uncontrolled_field", "a field neither varied nor held", "uncontrolled field"),
    ("invalid_arm_not_disposable", "an invalid arm outside a disposable environment", "disposable"),
    ("invalid_arm_in_real_repo", "an invalid arm pointed at the real repository", "anywhere reachable"),
    ("invalid_arm_real_profile", "an invalid arm pointed at the real CC profile", "real CC profile"),
    ("no_cleanup_manifest", "a disposable environment with no cleanup manifest", "cleanup manifest"),
    ("binding_drift", "a binding digest belonging to different bytes", "before baseline captured"),
    ("tier_claim_allowed", "no recorded prohibition on the tier claim", "tier claim"),
    ("gate_pre_crossed", "a human gate recorded as already crossed", "may not record the gate"),
    ("one_axis", "a single-axis design", "needs at least 2"),
    ("unknown_field", "an expected outcome smuggled into an arm", "unknown field"),
]

for mutation, description, signature in CASES:
    root, path = build(mutate=mutation)
    code, out = run(path)
    if code == 0:
        bad(f"accepted {description}")
    elif signature.lower() not in out.lower():
        bad(f"rejected {description}, but not for that reason (wanted {signature!r})", out)
    else:
        ok(f"rejects {description}")
    shutil.rmtree(root)

print()
if failed:
    print(f"test-e3-preregistration: FAIL ({len(failed)} of {len(passed) + len(failed)})",
          file=sys.stderr)
    raise SystemExit(1)
print(f"test-e3-preregistration: PASS ({len(passed)} assertions)")
PY
