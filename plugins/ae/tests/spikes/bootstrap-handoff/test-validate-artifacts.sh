#!/bin/sh
# test-validate-artifacts.sh — F-083 AC13.
#
# The validator's job is to fail. So every case here builds a COMPLETE, VALID handoff package in
# a throwaway Git repository, applies exactly one mutation, and requires the validator to reject
# it for that reason. The clean build is asserted valid first, which is what makes the rest
# differential: a validator that rejected everything would fail case 1, and one that accepted
# everything would fail all the others.
#
# The mutations are the ways a bootstrap could look finished without being it — an inert template
# passed off as work, a placeholder left in an identity, a digest that does not match its bytes,
# a result bound to a request it was not issued from, an allowed path that quietly overlaps a
# mandatory denial, an evidence directory that grew a verifier, an exclusion that removes a file
# from review with nothing else hashing it, and a resolver pointed at whichever attempt looks
# best.
#
# Nothing outside the temporary repository is touched.
#
# Run: sh plugins/ae/tests/spikes/bootstrap-handoff/test-validate-artifacts.sh
# Exit 0 = every assertion held. Exit 1 = at least one did not.

set -u
THIS="$(cd "$(dirname "$0")" && pwd)"
command -v python3 >/dev/null 2>&1 || { echo "  FAIL: python3 is required" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "  FAIL: git is required" >&2; exit 1; }

exec python3 - "$THIS" "$THIS/dispositions.F-083-M5.json" <<'PY'
import copy, hashlib, json, os, shutil, subprocess, sys, tempfile

HERE = sys.argv[1]
LANDING_DISPOSITIONS = sys.argv[2]
VALIDATE = os.path.join(HERE, "validate-artifacts.sh")
RESOLVE = os.path.join(HERE, "resolve-attempt.sh")
DISPOSITIONS = os.path.join(HERE, "validate-dispositions.sh")

passed, failed = [], []


def ok(message):
    passed.append(message)
    print(f"  ok: {message}")


def bad(message, detail=""):
    failed.append(message)
    print(f"  FAIL: {message}", file=sys.stderr)
    if detail:
        for line in detail.strip().split("\n")[:6]:
            print(f"       {line}", file=sys.stderr)


FEATURE = ".ae/features/active/F-083-ae-v1-implementation"
PACKAGE = f"{FEATURE}/handoffs/WP-P0.0"
EVIDENCE = ".ae/bootstrap/F-083/evidence/WP-P0.0"
DENIALS = json.load(open(os.path.join(HERE, "bootstrap-artifacts.schema.json"),
                         encoding="utf-8"))["x-required-write-denials"]["patterns"]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write(root, rel, data):
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(data if isinstance(data, bytes) else json.dumps(data, indent=2).encode())
    return path


def digest(root, rel):
    with open(os.path.join(root, rel), "rb") as handle:
        return sha(handle.read())


def identity(root, rel):
    return {"path": rel, "sha256": digest(root, rel)}


def build(attempt="A-001", review=None, mutate=None):
    """A complete, valid package. `mutate` renames one thing to make it not."""
    root = tempfile.mkdtemp()
    subprocess.run(["git", "init", "-q", root], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    mutate = mutate or ""
    attempt_dir = f"{PACKAGE}/{attempt}"
    evidence_dir = f"{EVIDENCE}/{attempt}"

    write(root, "plugins/ae/skills/demo/SKILL.md", b"---\nname: demo\ndescription: \"a: b\"\n---\nbody\n")

    # --- raw evidence -------------------------------------------------------------------------
    capture = {"artifact_kind": "bootstrap_command_capture", "command_id": "probe",
               "argv": ["sh", "-c", "true"], "expected_exit_codes": [0], "actual_exit_code": 0,
               "stdout": {"encoding": "base64", "bytes": 3, "sha256": sha(b"ok\n"),
                          "data": "b2sK"},
               "stderr": {"encoding": "base64", "bytes": 0, "sha256": sha(b""), "data": ""}}
    if mutate == "summary_raw_disagreement":
        capture["actual_exit_code"] = 7
    if mutate == "forged_capture_digest":
        capture["stdout"]["sha256"] = sha(b"something else")
    write(root, f"{evidence_dir}/raw/probe.command.json", capture)

    write(root, f"{evidence_dir}/baseline-before/git-status.bin", b"# clean\n")
    write(root, f"{evidence_dir}/baseline-before/ignored-raw.bin", b"")
    write(root, f"{evidence_dir}/baseline-after/git-status.bin", b"# clean after\n")
    write(root, f"{evidence_dir}/baseline-after/ignored-raw.bin", b"")

    def repo_state(phase):
        demo_digest = sha(b"the change this attempt was assigned to make") \
            if mutate == "allowed_source_drift" and phase == "after" \
            else digest(root, "plugins/ae/skills/demo/SKILL.md")
        entries = [{"path": "plugins/ae/skills/demo/SKILL.md", "type": "file",
                    "mode": "0644", "sha256": demo_digest, "link_target": None}]
        if mutate == "out_of_scope_directory" and phase == "after":
            entries.append({"path": "scratch/unexpected", "type": "directory",
                            "mode": "0755", "sha256": None, "link_target": None})
        if mutate == "out_of_scope_mode":
            entries.append({"path": "scratch/mode-target", "type": "file",
                            "mode": "0600" if phase == "after" else "0644",
                            "sha256": sha(b"same bytes"), "link_target": None})
        if mutate == "out_of_scope_symlink_target":
            entries.append({"path": "scratch/link", "type": "symlink", "mode": "0777",
                            "sha256": None,
                            "link_target": "target-b" if phase == "after" else "target-a"})
        return {"artifact_kind": "bootstrap_repo_state", "phase": phase,
                "entries": entries}

    write(root, f"{evidence_dir}/baseline-before/repo-state.json", repo_state("before"))
    write(root, f"{evidence_dir}/baseline-after/repo-state.json", repo_state("after"))

    # The ignored projection is where a request's plan, frozen goal and ignored source inputs are
    # captured, so the phase-aware rule reads its entries rather than the live tree. Building it
    # per phase is what lets one mutation move a single path between the baselines.
    def ignored_entries(phase):
        rows = {f"{FEATURE}/goal.frozen.md": digest(root, f"{FEATURE}/goal.frozen.md"),
                f"{FEATURE}/plan.md": digest(root, f"{FEATURE}/plan.md")}
        if mutate == "goal_absent_from_baseline":
            rows.pop(f"{FEATURE}/goal.frozen.md")
        if mutate == "allowed_source_drift":
            rows["plugins/ae/skills/demo/SKILL.md"] = \
                sha(b"the change this attempt was assigned to make") if phase == "after" \
                else digest(root, "plugins/ae/skills/demo/SKILL.md")
        if carrier_review and phase == "before":
            rows[carrier_review] = digest(root, carrier_review)
        if phase == "after" and mutate == "immutable_source_drift":
            rows[f"{FEATURE}/goal.frozen.md"] = sha(b"a frozen goal edited during the attempt")
        if phase == "after" and mutate == "out_of_scope_drift":
            rows[f"{FEATURE}/decision-register.md"] = sha(b"moved with nothing allowing it")
        return [{"path": rel, "type": "file", "mode": "0644", "sha256": rows[rel],
                 "link_target": None} for rel in sorted(rows)]

    def projection(phase, exclusions):
        return {
            "artifact_kind": "bootstrap_ignored_projection", "artifact_version": 1,
            "authority": "bootstrap_non_authoritative", "feature_id": "F-083",
            "work_package": "WP-P0.0", "attempt_id": attempt, "capture_phase": phase,
            "captured_at": "2026-08-23T00:00:00.000Z", "repository_root": ".",
            "commit": "0" * 40, "profile": "bootstrap_ignored_v1",
            "enumerator": {"path": "plugins/ae/tests/spikes/bootstrap-handoff/enumerate-ignored.sh",
                           "sha256": "1" * 64},
            "request_scope": {"path": f"{attempt_dir}/request-scope.json", "sha256": "2" * 64},
            "inputs": {
                "git_ignored": {"argv": ["git", "ls-files", "--others", "--ignored",
                                         "--exclude-standard", "-z"], "raw_sha256": "3" * 64},
                "ae_untracked": {"root": ".ae", "canonical_raw_sha256": "4" * 64},
                "canonical_ignored_raw": {"path": f"{evidence_dir}/baseline-{phase}/ignored-raw.bin",
                                          "sha256": digest(root, f"{evidence_dir}/baseline-{phase}/ignored-raw.bin")},
                "ignore_config": {
                    "gitignore": {"state": "absent", "path": ".gitignore", "type": None,
                                  "sha256": None, "link_target": None},
                    "info_exclude": {"state": "absent", "path": ".git/info/exclude", "type": None,
                                     "sha256": None, "link_target": None},
                    "global_excludes": {"state": "not_configured", "path": None, "type": None,
                                        "sha256": None, "link_target": None}}},
            "protocol_output_exclusions": exclusions,
            "entries": ignored_entries(phase),
        }

    write(root, f"{FEATURE}/plan.md", b"# plan\n\n## Acceptance Criteria\n\n### AC1\n")
    write(root, f"{FEATURE}/goal.frozen.md", b"## Acceptance Criteria\n\n### AC1\n")
    write(root, f"{FEATURE}/decision-register.md", b"| D-001 | accepted |\n")

    # A review whose verdict was not `accepted` can never be followed by a pointer, so the only
    # artifact downstream of it is the next attempt's request.
    prior_review = f"{FEATURE}/reviews/WP-P0.0-A-000-codex-review.md"
    carrier_review = {"blocked_review_carrier": prior_review,
                      "review_carrier_wrong_field": prior_review,
                      "review_carrier_same_attempt":
                          f"{FEATURE}/reviews/WP-P0.0-{attempt}-codex-review.md"}.get(mutate)
    if carrier_review:
        write(root, carrier_review,
              b"---\ntype: bootstrap-package-review\nverdict: blocked\n---\n")

    def exclusion(path, reason, artifact_path, field, state="absent", phase="before"):
        return {"path": path, "capture_phase": phase, "reason": reason,
                "expected_state": state,
                "binding": {"artifact_path": artifact_path, "field": field}}

    result_rel = f"{attempt_dir}/work-result.json"
    subject_rel = f"{attempt_dir}/verification-subject.json"
    manifest_rel = f"{evidence_dir}/manifest.json"

    before_exclusions = [
        exclusion(f"{attempt_dir}/work-request.json", "work_request", result_rel, "request.sha256"),
    ]
    after_exclusions = [
        exclusion(f"{attempt_dir}/work-request.json", "work_request", result_rel,
                  "request.sha256", state="present", phase="after"),
        exclusion(result_rel, "work_result", subject_rel, "result.sha256", phase="after"),
        exclusion(subject_rel, "verification_subject", subject_rel,
                  "$external_unreviewed_subject_sha256", phase="after"),
        exclusion(manifest_rel, "evidence_manifest", subject_rel, "evidence_manifest.sha256",
                  phase="after"),
        # A binding that RESOLVES through an entry selector. The clean build needs one: without
        # it, only the failing selector paths were ever exercised, and a selector that silently
        # resolved to nothing looked identical to a correctly bound output.
        exclusion(f"{evidence_dir}/raw/probe.command.json", "evidence_entry", manifest_rel,
                  f"entries[path={evidence_dir}/raw/probe.command.json].sha256",
                  state="present", phase="after"),
    ]
    if carrier_review:
        field = "source_set.sha256" if mutate == "review_carrier_wrong_field" \
            else f"source_inputs[path={carrier_review}].sha256"
        after_exclusions.append(exclusion(carrier_review, "package_review",
                                          f"{attempt_dir}/work-request.json", field,
                                          state="present", phase="after"))
    if mutate == "directory_exclusion":
        after_exclusions.append(exclusion(f"{evidence_dir}/raw", "evidence_entry", manifest_rel,
                                          "entries[path=x].sha256", phase="after"))
    if mutate == "unbound_exclusion":
        # A different path from the positive selector case above, so this asserts "nothing binds
        # it" rather than tripping the duplicate-exclusion rule first.
        after_exclusions.append(exclusion(f"{evidence_dir}/baseline-before/repo-state.json",
                                          "evidence_entry", f"{evidence_dir}/absent-manifest.json",
                                          "entries[path=x].sha256", state="present", phase="after"))
    if mutate == "binding_cycle":
        after_exclusions.append(exclusion(f"{attempt_dir}/loop-a.json", "work_result",
                                          f"{attempt_dir}/loop-b.json", "result.sha256",
                                          phase="after"))
        after_exclusions.append(exclusion(f"{attempt_dir}/loop-b.json", "work_result",
                                          f"{attempt_dir}/loop-a.json", "result.sha256",
                                          phase="after"))

    write(root, f"{evidence_dir}/baseline-before/ignored-projection.json",
          projection("before", before_exclusions))
    write(root, f"{evidence_dir}/baseline-after/ignored-projection.json",
          projection("after", after_exclusions))

    # --- evidence manifest ---------------------------------------------------------------------
    evidence_paths = [
        (f"{evidence_dir}/raw/probe.command.json", "command_capture"),
        (f"{evidence_dir}/baseline-before/repo-state.json", "repo_state"),
        (f"{evidence_dir}/baseline-before/git-status.bin", "git_status_raw"),
        (f"{evidence_dir}/baseline-before/ignored-projection.json", "ignored_projection"),
        (f"{evidence_dir}/baseline-before/ignored-raw.bin", "ignored_paths_raw"),
        (f"{evidence_dir}/baseline-after/repo-state.json", "repo_state"),
        (f"{evidence_dir}/baseline-after/git-status.bin", "git_status_raw"),
        (f"{evidence_dir}/baseline-after/ignored-projection.json", "ignored_projection"),
        (f"{evidence_dir}/baseline-after/ignored-raw.bin", "ignored_paths_raw"),
    ]
    if mutate == "no_op_evidence":
        write(root, f"{evidence_dir}/raw/empty.command.json", b"")
        evidence_paths.append((f"{evidence_dir}/raw/empty.command.json", "command_capture"))
    if mutate == "evidence_holds_a_verifier":
        write(root, f"{evidence_dir}/raw/check.sh", b"#!/bin/sh\nexit 0\n")
        evidence_paths.append((f"{evidence_dir}/raw/check.sh", "command_capture"))
    if mutate == "unknown_extra_output":
        write(root, f"{evidence_dir}/raw/stray.json", b"{}\n")
    if mutate == "symlink_evidence":
        target = os.path.join(root, f"{evidence_dir}/raw/link.command.json")
        os.symlink(os.path.join(root, f"{evidence_dir}/raw/probe.command.json"), target)
        evidence_paths.append((f"{evidence_dir}/raw/link.command.json", "command_capture"))

    entries = []
    for rel, kind in evidence_paths:
        entries.append({"path": rel, "artifact_kind": kind, "required": True,
                        "sha256": digest(root, rel),
                        "bytes": os.path.getsize(os.path.join(root, rel))})
    if mutate == "duplicate_evidence_path":
        entries.append(copy.deepcopy(entries[0]))
    if mutate == "wrong_evidence_digest":
        entries[0]["sha256"] = sha(b"not these bytes")
    if mutate == "invalid_sha256":
        entries[0]["sha256"] = "NOTAHASH"
    if mutate == "unknown_evidence_kind":
        entries[0]["artifact_kind"] = "arm_transcript"
    if mutate == "traversal_evidence_path":
        entries[0]["path"] = f"{evidence_dir}/raw/../../../../../etc/passwd"

    manifest = {"artifact_kind": "bootstrap_evidence_manifest", "artifact_version": 1,
                "authority": "bootstrap_non_authoritative", "feature_id": "F-083",
                "work_package": "WP-P0.0", "attempt_id": attempt,
                "sealed_at": "2026-08-23T00:00:00.000Z", "commit": "0" * 40, "entries": entries}
    write(root, manifest_rel, manifest)

    # --- request -------------------------------------------------------------------------------
    source_inputs = [identity(root, f"{FEATURE}/plan.md"),
                     identity(root, f"{FEATURE}/goal.frozen.md")]
    if mutate == "allowed_source_drift":
        source_inputs.append(identity(root, "plugins/ae/skills/demo/SKILL.md"))
    if carrier_review:
        source_inputs.append(identity(root, carrier_review))
    source_inputs.sort(key=lambda item: item["path"])
    source_set_entries = copy.deepcopy(source_inputs)
    if mutate == "source_set_digest_mismatch":
        source_set_entries[0]["sha256"] = sha(b"different bytes under the same path")
    write(root, f"{attempt_dir}/source-set.json",
          {"artifact_kind": "bootstrap_source_set", "entries": source_set_entries})

    def baseline(phase):
        return {"commit": "0" * 40,
                "repo_state": identity(root, f"{evidence_dir}/baseline-{phase}/repo-state.json"),
                "git_status": identity(root, f"{evidence_dir}/baseline-{phase}/git-status.bin"),
                "ignored_roots": {"profile": "bootstrap_ignored_v1",
                                  **identity(root, f"{evidence_dir}/baseline-{phase}/ignored-projection.json")}}

    allowed = ["plugins/ae/skills/demo/SKILL.md", result_rel, subject_rel,
               f"{evidence_dir}/manifest.json"]
    forbidden = list(DENIALS)
    if mutate == "missing_denial":
        forbidden.remove(".git/**")
    if mutate == "allow_deny_conflict":
        allowed.append(f"{FEATURE}/plan.md")

    request = {
        "artifact_kind": "bootstrap_work_request", "artifact_version": 1,
        "authority": "bootstrap_non_authoritative", "feature_id": "F-083",
        "work_package": "WP-P0.0", "attempt_id": attempt, "state": "assigned",
        "branch": "feature/ae-v1-implementation", "material_revision": "M1",
        "strategy_revision": "S1", "baseline_before": baseline("before"),
        "plan": {**identity(root, f"{FEATURE}/plan.md"), "acceptance_section_sha256": "5" * 64},
        "frozen_goal": identity(root, f"{FEATURE}/goal.frozen.md"),
        "source_set": identity(root, f"{attempt_dir}/source-set.json"),
        "human_approvals": [{"decision_ref": f"{FEATURE}/decision-register.md#D-001",
                             "decision_entry_sha256": "6" * 64,
                             "decision_register_sha256": "7" * 64,
                             "purpose": "confirmed frozen goal"}],
        "acceptance_ids": ["AC13"], "source_inputs": source_inputs,
        "allowed_paths": allowed, "forbidden_paths": forbidden,
        "feature_tree_mutation": {"allowed": False, "human_decision_ref": None,
                                  "human_decision_sha256": None, "approved_view_sha256": None,
                                  "exact_operations": []},
        "commands": [{"argv": ["sh", "-c", "true"], "cwd": ".", "expected_exit_codes": [0]}],
        "expected_evidence": [{"path": manifest_rel, "artifact_kind": "evidence_manifest",
                               "required": True}],
        "stop_conditions": [{"code": "TEST_FAILURE", "condition": "a command exits outside its set",
                             "required_action": "preserve output and stop"}],
        "replacement_dispositions": [],
        "rollout_lock_forbidden": True, "same_session_review_forbidden": True,
    }
    if mutate == "template_as_issued":
        request["artifact_kind"] = "bootstrap_work_request_template"
        request["state"] = "template"
    if mutate == "placeholder_identity":
        request["frozen_goal"] = {"path": None, "sha256": None}
    if mutate == "plan_baseline_drift":
        request["plan"] = {**request["plan"], "sha256": sha(b"a plan this attempt never saw")}
    if mutate == "empty_required_array":
        request["acceptance_ids"] = []
    if mutate == "unknown_field":
        request["extra_authority"] = "rollout"
    if mutate == "missing_field":
        del request["stop_conditions"]
    write(root, f"{attempt_dir}/work-request.json", request)

    # --- result --------------------------------------------------------------------------------
    result = {
        "artifact_kind": "bootstrap_work_result", "artifact_version": 1,
        "authority": "bootstrap_non_authoritative", "feature_id": "F-083",
        "work_package": "WP-P0.0", "attempt_id": attempt, "state": "review_pending",
        "request": identity(root, f"{attempt_dir}/work-request.json"),
        "material_revision": "M1", "strategy_revision": "S1",
        "plan": request["plan"], "frozen_goal": request["frozen_goal"],
        "source_set": request["source_set"],
        "baseline_before": request["baseline_before"], "baseline_after": baseline("after"),
        "changed_files": [], "ignored_path_changes": [], "commits": [],
        "commands": [{"argv": ["sh", "-c", "true"], "cwd": ".", "expected_exit_codes": [0],
                      "actual_exit_code": 0,
                      "raw_output": identity(root, f"{evidence_dir}/raw/probe.command.json")}],
        "evidence_manifest": identity(root, manifest_rel),
        "replacement_dispositions": [
            {"artifact": "plugins/ae/skills/demo/SKILL.md",
             "disposition": "retain_as_repaired_definition", "owner": "claude",
             "evidence_sha256": digest(root, "plugins/ae/skills/demo/SKILL.md"),
             "authority_reachability": "none", "follow_up": "none"}],
        "deviations": [], "unresolved": [], "executor_summary": "fixture",
    }
    if mutate == "result_binds_other_request":
        result["request"]["sha256"] = sha(b"a different request")
    if mutate == "result_baseline_drift":
        result["baseline_before"] = baseline("after")
    if mutate == "unclassifiable_disposition":
        result["replacement_dispositions"][0]["disposition"] = "handled"
    write(root, result_rel, result)

    # --- subject -------------------------------------------------------------------------------
    subject = {
        "artifact_kind": "bootstrap_verification_subject", "artifact_version": 1,
        "authority": "bootstrap_non_authoritative", "feature_id": "F-083",
        "work_package": "WP-P0.0", "attempt_id": attempt, "state": "review_pending",
        "request": identity(root, f"{attempt_dir}/work-request.json"),
        "result": identity(root, result_rel), "source_set": request["source_set"],
        "baseline_before": result["baseline_before"], "baseline_after": result["baseline_after"],
        "evidence_manifest": result["evidence_manifest"],
        "created": "2026-08-23", "writer_family": "anthropic",
    }
    if mutate == "subject_attempt_mismatch":
        subject["attempt_id"] = "A-009"
    if mutate == "subject_binds_other_result":
        subject["result"]["sha256"] = sha(b"a different result")
    write(root, subject_rel, subject)

    # A request rejected before assignment: its bytes stay as an immutable input, deliberately
    # carrying a STALE plan digest, because it was written against an earlier plan revision. That
    # staleness is the point — it must not be reported as a defect in the package.
    if mutate.startswith("rejected_"):
        stale = copy.deepcopy(request)
        stale["attempt_id"] = "A-000"
        stale["plan"] = {**stale["plan"], "sha256": sha(b"an earlier plan revision")}
        write(root, f"{PACKAGE}/A-000/work-request.json", stale)
        write(root, f"{PACKAGE}/A-000/request-audit.json",
              {"artifact_kind": "bootstrap_request_audit", "attempt_id": "A-000",
               "verdict": "rejected_pre_assignment",
               "reason": "the audit found an incompatible attempt identity",
               "write_token_transferred": False})
        if mutate == "rejected_with_result":
            write(root, f"{PACKAGE}/A-000/work-result.json", result)
        if mutate == "rejected_with_subject":
            write(root, f"{PACKAGE}/A-000/verification-subject.json", subject)

    if review:
        write(root, f"{FEATURE}/reviews/WP-P0.0-{attempt}-codex-review.md",
              f"---\ntype: bootstrap-package-review\nverdict: {review}\n---\n".encode())

    # An approved material revision moves the plan and goal after an attempt has already been
    # issued against them. The attempt's bytes are immutable, so nothing it recorded can be
    # brought forward — which is why its identities are held against its own baseline and not
    # against whatever the tree says today.
    if mutate == "superseded_material_revision":
        write(root, f"{FEATURE}/plan.md", b"# plan\n\n## Acceptance Criteria\n\n### AC1 revised\n")
        write(root, f"{FEATURE}/goal.frozen.md", b"## Acceptance Criteria\n\n### AC1 revised\n")
    return root


def run(script, *args):
    proc = subprocess.run(["sh", script, *args], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return proc.returncode, proc.stdout.decode("utf-8", "replace")


# --- 1. the clean build is valid --------------------------------------------------------------
root = build()
code, out = run(VALIDATE, "--package", os.path.join(root, PACKAGE))
if code == 0:
    ok("a complete, valid package is accepted — the cases below are differential")
else:
    bad("the clean fixture package was rejected; every case below is meaningless", out)
shutil.rmtree(root)

ACCEPTED = [
    ("rejected_pre_assignment",
     "a rejected pre-assignment request is kept as an input, not held to an attempt's contract"),
    ("superseded_material_revision",
     "an attempt issued before an approved revision stays valid after the plan and goal move"),
    ("allowed_source_drift",
     "a source the request allowed may differ from its preimage once the after baseline binds it"),
    ("blocked_review_carrier",
     "a review no pointer can follow is carried by the next attempt's request"),
]

for mutation, description in ACCEPTED:
    root = build(mutate=mutation)
    code, out = run(VALIDATE, "--package", os.path.join(root, PACKAGE))
    if code == 0:
        ok(description)
    else:
        bad(f"rejected: {description}", out)
    shutil.rmtree(root)

CASES = [
    ("plan_baseline_drift", "a plan identity its own baseline never captured",
     "before baseline captured"),
    ("goal_absent_from_baseline", "a frozen goal no baseline enumerates",
     "not enumerated by the attempt's own before baseline"),
    ("immutable_source_drift", "a source outside the allowed paths that moved anyway",
     "is not an allowed path but the after baseline records"),
    ("out_of_scope_drift", "a path that changed with nothing allowing it",
     "no allowed path covers it"),
    ("out_of_scope_directory", "an out-of-scope directory added between baselines",
     "type/mode/content/link state"),
    ("out_of_scope_mode", "an out-of-scope chmod-only change between baselines",
     "type/mode/content/link state"),
    ("out_of_scope_symlink_target", "an out-of-scope symlink-target change between baselines",
     "type/mode/content/link state"),
    ("source_set_digest_mismatch", "a source set that keeps the path but changes its digest",
     "path/digest pairs disagree"),
    ("review_carrier_wrong_field", "a request that carries a review by some other field",
     "only as its own source input"),
    ("review_carrier_same_attempt", "an attempt carrying the review of itself",
     "does not come after"),
    ("rejected_with_result", "a rejected request that also produced a result",
     "cannot also have produced work"),
    ("rejected_with_subject", "a rejected request carrying a verification subject",
     "never became an attempt"),
    ("template_as_issued", "inert template", "template"),
    ("placeholder_identity", "a placeholder left where an identity goes", "null"),
    ("empty_required_array", "an empty required array", "at least"),
    ("unknown_field", "an unknown field", "unknown field"),
    ("missing_field", "a missing required field", "missing required field"),
    ("duplicate_evidence_path", "a duplicated evidence path", "listed twice"),
    ("traversal_evidence_path", "an evidence path that traverses", "traverses"),
    ("symlink_evidence", "evidence delivered through a symlink", "symlink"),
    ("invalid_sha256", "a digest that is not a SHA-256", "sha256: 'notahash'"),
    ("wrong_evidence_digest", "a digest that does not match its bytes", "hashes to"),
    ("unknown_evidence_kind", "an evidence shape outside the closed kind set", "not one of"),
    ("no_op_evidence", "an empty capture standing in for a run", "no-op"),
    ("forged_capture_digest", "a capture whose digest disagrees with its own bytes", "digest does not match"),
    ("summary_raw_disagreement", "a command that exited outside its expected set", "outside"),
    ("result_binds_other_request", "a result bound to a different request", "request digest"),
    ("result_baseline_drift", "a result that did not start where it was assigned", "baseline_before"),
    ("subject_attempt_mismatch", "a subject naming a different attempt", "attempt_id"),
    ("subject_binds_other_result", "a subject bound to a different result", "result digest"),
    ("missing_denial", "a request omitting a mandatory write denial", "write denial"),
    ("allow_deny_conflict", "an allowed path overlapping a denial", "overlaps"),
    ("evidence_holds_a_verifier", "an evidence directory holding a verifier", "not verifiers"),
    ("unknown_extra_output", "an output present but not in the manifest", "not listed"),
    ("directory_exclusion", "a directory excluded from the projection", "individual paths"),
    ("unbound_exclusion", "an excluded output nothing binds", "binding artifact"),
    ("binding_cycle", "an exclusion binding cycle", "cycle"),
]

for mutation, description, signature in CASES:
    root = build(mutate=mutation)
    code, out = run(VALIDATE, "--package", os.path.join(root, PACKAGE))
    if code == 0:
        bad(f"accepted {description}")
    elif signature.lower() not in out.lower():
        bad(f"rejected {description}, but not for that reason (wanted {signature!r})", out)
    else:
        ok(f"rejects {description}")
    shutil.rmtree(root)

# --- dispositions -------------------------------------------------------------------------------
try:
    landing = json.load(open(LANDING_DISPOSITIONS, encoding="utf-8"))
except (OSError, ValueError) as error:
    bad("the tracked M5 landing dispositions are unreadable", str(error))
    landing = {}
required_categories = {
    "repaired_definitions_and_consumers",
    "deterministic_regressions",
    "host_dependent_contract_scaffolds",
    "bootstrap_handoff_tools",
    "attempt_specific_evidence",
}
categories = landing.get("categories", []) if isinstance(landing, dict) else []
category_ids = {entry.get("id") for entry in categories if isinstance(entry, dict)}
allowed_classes = {"ordinary_product_code", "ordinary_test_code", "deferred_scaffold",
                   "audit_only_tooling", "ignored_audit_history"}
if landing.get("artifact_kind") != "phase0_landing_dispositions_v1" or \
        landing.get("authority") != "none":
    bad("the tracked M5 dispositions claim an unknown kind or authority")
elif category_ids != required_categories:
    bad(f"the tracked M5 dispositions do not close every category: {sorted(category_ids)}")
elif any(entry.get("classification") not in allowed_classes or not entry.get("paths") or
         entry.get("authority_reachability") not in ("none", "hard_disabled")
         for entry in categories):
    bad("the tracked M5 dispositions contain an unclassifiable or authority-reachable category")
else:
    ok("the tracked M5 landing dispositions classify every retained bootstrap category")

root = build()
code, out = run(DISPOSITIONS, os.path.join(root, PACKAGE))
if code == 0:
    ok("a complete disposition set is accepted")
else:
    bad("a complete disposition set was rejected", out)
shutil.rmtree(root)

root = build(mutate="unclassifiable_disposition")
code, out = run(DISPOSITIONS, os.path.join(root, PACKAGE))
if code != 0 and "classif" in out.lower():
    ok("rejects a disposition that names no fate")
else:
    bad("accepted a disposition that classifies as none of delete|retain|pending-audit", out)
shutil.rmtree(root)

# --- resolver -------------------------------------------------------------------------------------
def resolver_case(description, signature, setup, mode="pending", expect_ok=False):
    root = build()
    setup(root)
    code, out = run(RESOLVE, os.path.join(root, PACKAGE), "--mode", mode)
    if expect_ok:
        if code == 0:
            ok(description)
        else:
            bad(description, out)
    elif code == 0:
        bad(f"resolver accepted {description}")
    elif signature.lower() not in out.lower():
        bad(f"resolver rejected {description}, but not for that reason (wanted {signature!r})", out)
    else:
        ok(f"resolver rejects {description}")
    shutil.rmtree(root)


resolver_case("resolves the single unreviewed subject", "", lambda root: None, expect_ok=True)

def add_second_subject(root):
    src = os.path.join(root, PACKAGE, "A-001")
    dst = os.path.join(root, PACKAGE, "A-002")
    shutil.copytree(src, dst)

resolver_case("more than one unreviewed subject", "unreviewed verification subjects",
              add_second_subject)

resolver_case("no unreviewed subject at all", "no unreviewed",
              lambda root: os.remove(os.path.join(root, PACKAGE, "A-001",
                                                  "verification-subject.json")))

def pointer_without_review(root):
    subject = json.load(open(os.path.join(root, PACKAGE, "A-001", "verification-subject.json")))
    pointer = {"artifact_kind": "bootstrap_accepted_attempt", "artifact_version": 1,
               "authority": "bootstrap_non_authoritative", "feature_id": "F-083",
               "work_package": "WP-P0.0", "attempt_id": "A-001", "state": "accepted",
               "request": subject["request"], "result": subject["result"],
               "verification_subject": {"path": f"{PACKAGE}/A-001/verification-subject.json",
                                        "sha256": "8" * 64},
               "review": {"path": f"{FEATURE}/reviews/WP-P0.0-A-001-codex-review.md",
                          "sha256": "9" * 64},
               "source_set": subject["source_set"],
               "baseline_before": subject["baseline_before"],
               "baseline_after": subject["baseline_after"],
               "evidence_manifest": subject["evidence_manifest"],
               "created": "2026-08-23", "writer_family": "openai"}
    write(root, f"{PACKAGE}/accepted-attempt.json", pointer)

resolver_case("a pointer created before its review", "no review exists",
              pointer_without_review, mode="accepted")

def pointer_over_blocked_review(root):
    pointer_without_review(root)
    write(root, f"{FEATURE}/reviews/WP-P0.0-A-001-codex-review.md",
          b"---\ntype: bootstrap-package-review\nverdict: blocked\n---\n")

resolver_case("a pointer over a non-accepted review", "verdict",
              pointer_over_blocked_review, mode="accepted")

def pointer_naming_another_attempt(root):
    pointer_without_review(root)
    pointer_path = os.path.join(root, PACKAGE, "accepted-attempt.json")
    pointer = json.load(open(pointer_path))
    pointer["verification_subject"]["path"] = f"{PACKAGE}/A-007/verification-subject.json"
    write(root, f"{PACKAGE}/accepted-attempt.json", pointer)
    write(root, f"{FEATURE}/reviews/WP-P0.0-A-001-codex-review.md",
          b"---\ntype: bootstrap-package-review\nverdict: accepted\n---\n")

resolver_case("a pointer binding another attempt's subject", "not A-001's own subject",
              pointer_naming_another_attempt, mode="accepted")

def pending_after_acceptance(root):
    pointer_without_review(root)
    write(root, f"{FEATURE}/reviews/WP-P0.0-A-001-codex-review.md",
          b"---\ntype: bootstrap-package-review\nverdict: accepted\n---\n")
    src = os.path.join(root, PACKAGE, "A-001")
    shutil.copytree(src, os.path.join(root, PACKAGE, "A-002"))

resolver_case("a subject still pending after acceptance", "still unreviewed",
              pending_after_acceptance, mode="accepted")

def superseded_changes_required(root):
    write(root, f"{FEATURE}/reviews/WP-P0.0-A-001-codex-review.md",
          b"---\ntype: bootstrap-package-review\nverdict: changes_required\n---\n")

def superseded_selected_over_next(root):
    src = os.path.join(root, PACKAGE, "A-001")
    shutil.copytree(src, os.path.join(root, PACKAGE, "A-002"))
    write(root, f"{FEATURE}/reviews/WP-P0.0-A-002-codex-review.md",
          b"---\ntype: bootstrap-package-review\nverdict: changes_required\n---\n")

resolver_case("selecting a reviewed changes_required attempt while a later one is open",
              "append-only", superseded_selected_over_next)

print()
if failed:
    print(f"test-validate-artifacts: FAIL ({len(failed)} of {len(passed) + len(failed)})",
          file=sys.stderr)
    raise SystemExit(1)
print(f"test-validate-artifacts: PASS ({len(passed)} assertions)")
PY
