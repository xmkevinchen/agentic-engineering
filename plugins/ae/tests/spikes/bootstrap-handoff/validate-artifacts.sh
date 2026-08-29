#!/bin/sh
# validate-artifacts.sh — the closed validator for F-083 bootstrap handoff artifacts.
#
# Until this existed, the first work request was checked by a human reading a template, which is
# the bootstrap-of-the-bootstrap exception the protocol names and this file closes. Everything
# it rejects is a way an attempt could look complete without being it:
#
#   * an inert template presented as issued work, or a placeholder left where an identity goes;
#   * an unknown, missing, or duplicated field, path, or evidence entry;
#   * a path that traverses, or evidence delivered through a symlink;
#   * a digest that is not a SHA-256, does not match the bytes, or matches bytes that were never
#     produced by the run (a no-op capture);
#   * a result that binds a different request than the one assigned, or a subject that binds a
#     different result than the one written;
#   * an executor summary that disagrees with the raw output it points at;
#   * a request that omits a mandatory write denial, or lets an allowed path overlap one;
#   * a WP-P0.G request whose source set does not bind an accepted WP-P0.0 pointer, or a
#     continuation that claims P0.1 without both accepted pointers and a feasible join.
#
# It also enforces the two rules an evidence tree exists to keep: an evidence directory contains
# DATA — no verifier, no summary that could disagree with the bytes beside it — and the
# `bootstrap_ignored_v1` projection subtracts only exact paths that some other artifact
# independently binds. A directory exclusion, a prefix, a self-referencing binding, or an
# unknown extra output file all fail, because each is a way to stop looking at the bytes a run
# produced while still reporting a clean projection.
#
# Schemas are JSON Schema in shape but are read by the compact interpreter below rather than by
# `jsonschema`, which is not a dependency this repository has. The supported vocabulary is
# type / properties / required / additionalProperties:false / items / minItems / minLength /
# enum / const / pattern / $ref -> #/$defs. A schema keyword outside that set is an error, not a
# silent pass — an unenforced constraint reads exactly like an enforced one.
#
# Usage:
#   sh validate-artifacts.sh --artifact <file>       one JSON artifact, by its declared kind
#   sh validate-artifacts.sh --evidence <manifest>   an evidence manifest and every path in it
#   sh validate-artifacts.sh --ignored <projection>  a bootstrap_ignored_v1 projection
#   sh validate-artifacts.sh --package <dir>         one package's request -> result -> subject chain
#
# Exit 0 = valid. 1 = at least one defect, each reported with its exact location. 2 = usage.

set -eu

[ "$#" -eq 2 ] || {
  echo "usage: sh validate-artifacts.sh --artifact|--evidence|--ignored|--package <path>" >&2
  exit 2
}
case $1 in
  --artifact|--evidence|--ignored|--package) ;;
  *) echo "validate-artifacts: unknown mode: $1" >&2; exit 2 ;;
esac
[ -e "$2" ] || { echo "validate-artifacts: no such path: $2" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "validate-artifacts: python3 is required" >&2; exit 2; }

HERE="$(cd "$(dirname "$0")" && pwd)"
exec python3 - "$1" "$2" "$HERE" <<'PY'
import hashlib, json, os, re, sys

mode, target, here = sys.argv[1], os.path.abspath(sys.argv[2]), sys.argv[3]
problems = []


def bad(message):
    problems.append(message)


def finish():
    for message in problems:
        sys.stderr.write(f"  defect: {message}\n")
    if problems:
        sys.stderr.write(f"validate-artifacts: {len(problems)} defect(s)\n")
        raise SystemExit(1)
    raise SystemExit(0)


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
    sys.stderr.write("validate-artifacts: cannot locate the repository root\n")
    raise SystemExit(2)

SHA256 = re.compile(r"^[0-9a-f]{64}$")


def load_json(path, label):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except OSError as exc:
        bad(f"{label}: unreadable ({exc.strerror})")
    except ValueError as exc:
        bad(f"{label}: not valid JSON ({exc})")
    return None


def digest_of(abs_path):
    with open(abs_path, "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def canonical_path(value, label):
    """A repo-relative path that cannot escape, hide, or resolve to a link."""
    if not isinstance(value, str) or not value:
        bad(f"{label}: path is not a non-empty string")
        return None
    if value.startswith("/") or "\\" in value or "\x00" in value:
        bad(f"{label}: {value!r} is not a canonical repo-relative path")
        return None
    if any(part in ("", ".", "..") for part in value.split("/")):
        bad(f"{label}: {value!r} traverses or contains an empty segment")
        return None
    return value


def resolved_file(rel, label, must_exist=True):
    """Resolve a repo-relative path, refusing symlinks anywhere along it."""
    if rel is None:
        return None
    abs_path = os.path.join(REPO, rel)
    walked = REPO
    for part in rel.split("/"):
        walked = os.path.join(walked, part)
        if os.path.islink(walked):
            bad(f"{label}: {rel} passes through a symlink at {os.path.relpath(walked, REPO)} — "
                f"evidence is bytes in the repository, not a pointer out of it")
            return None
    if must_exist and not os.path.exists(abs_path):
        bad(f"{label}: {rel} does not exist")
        return None
    return abs_path


# --- the compact schema interpreter ---------------------------------------------------------

SUPPORTED = {"type", "properties", "required", "additionalProperties", "items", "minItems",
             "minLength", "enum", "const", "pattern", "$ref", "description", "$schema", "$id",
             "title", "$defs"}
TYPES = {"object": dict, "array": list, "string": str, "boolean": bool, "null": type(None)}


def properties_of(schema, name):
    return schema.get("properties", {}).get(name, {})


def _nullable(sub):
    """Whether a field's own schema permits null. A null where null is allowed is a recorded
    fact — `feature_tree_mutation` carries three of them precisely because nothing was approved.
    A null where it is not allowed is a placeholder that was never filled in."""
    declared = sub.get("type")
    if isinstance(declared, list):
        return "null" in declared
    return declared == "null"


def check_schema(value, schema, root, where):
    for keyword in schema:
        if keyword not in SUPPORTED:
            bad(f"{where}: schema uses unsupported keyword {keyword!r}; an unenforced constraint "
                f"reads like an enforced one")
            return
    if "$ref" in schema:
        ref = schema["$ref"]
        if not ref.startswith("#/$defs/"):
            bad(f"{where}: unsupported $ref {ref!r}")
            return
        return check_schema(value, root["$defs"][ref.split("/")[-1]], root, where)
    if "const" in schema and value != schema["const"]:
        bad(f"{where}: is {value!r}, must be {schema['const']!r}")
        return
    if "enum" in schema and value not in schema["enum"]:
        bad(f"{where}: is {value!r}, not one of {schema['enum']}")
        return
    if "type" in schema:
        wanted = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if "integer" in wanted:
            allowed = tuple(TYPES[t] for t in wanted if t in TYPES) + (int,)
        else:
            allowed = tuple(TYPES[t] for t in wanted if t in TYPES)
        matched = isinstance(value, allowed) and not (isinstance(value, bool)
                                                      and "boolean" not in wanted)
        if not matched:
            bad(f"{where}: is {type(value).__name__}, must be {'|'.join(wanted)}")
            return
    if isinstance(value, str):
        if "pattern" in schema and not re.fullmatch(schema["pattern"], value):
            bad(f"{where}: {value!r} does not match {schema['pattern']}")
        if "minLength" in schema and len(value) < schema["minLength"]:
            bad(f"{where}: is shorter than {schema['minLength']} character(s) — a placeholder or "
                f"an emptied required field")
    if isinstance(value, dict):
        for name in schema.get("required", []):
            if name not in value:
                bad(f"{where}: missing required field {name!r}")
            elif value[name] is None and not _nullable(properties_of(schema, name)):
                bad(f"{where}.{name}: is null where the schema requires a value — a template "
                    f"placeholder, not an issued identity")
        properties = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            for name in value:
                if name not in properties:
                    bad(f"{where}: unknown field {name!r}")
        for name, sub in properties.items():
            if name in value:
                check_schema(value[name], sub, root, f"{where}.{name}")
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            bad(f"{where}: has {len(value)} item(s), needs at least {schema['minItems']} — an "
                f"empty required array is a placeholder")
        if "items" in schema:
            for index, item in enumerate(value):
                check_schema(item, schema["items"], root, f"{where}[{index}]")


def schema_file(name):
    loaded = load_json(os.path.join(here, name), f"schema {name}")
    if loaded is None:
        finish()
    return loaded


# --- shared artifact rules -------------------------------------------------------------------

STATE_BY_KIND = {
    "bootstrap_work_request": "assigned",
    "bootstrap_work_result": "review_pending",
    "bootstrap_verification_subject": "review_pending",
    "bootstrap_accepted_attempt": "accepted",
    "bootstrap_implementation_continuation": "reviewed",
}


def check_identity(obj, label, expect_digest=True):
    """A {path, sha256} pair must name real bytes whose digest is the one recorded."""
    if not isinstance(obj, dict):
        bad(f"{label}: is not a {{path, sha256}} object")
        return
    rel = canonical_path(obj.get("path"), f"{label}.path")
    digest = obj.get("sha256")
    if not isinstance(digest, str) or not SHA256.fullmatch(digest):
        bad(f"{label}.sha256: {digest!r} is not a full lowercase SHA-256")
        return
    if not expect_digest:
        return
    abs_path = resolved_file(rel, label)
    if abs_path and os.path.isfile(abs_path):
        actual = digest_of(abs_path)
        if actual != digest:
            bad(f"{label}: recorded {digest} but {rel} hashes to {actual}")


_baseline_entries_cache = {}


def baseline_entries(baseline, label):
    """path -> complete lstat-style record as the attempt's own baseline captured it.

    Comparing only sha256 drops directories, chmod-only changes, type changes, and symlink target
    changes. Those are repository state too, so the phase-aware comparison keeps the complete
    {path,type,mode,sha256,link_target} tuple from both tracked and ignored projections.

    The plan and frozen goal live
    under `.ae/**`, which is ignored, so they are enumerated by the ignored projection rather than
    the repo-state manifest; both are read so the lookup does not depend on which side of
    .gitignore a path falls."""
    entries = {}
    if not isinstance(baseline, dict):
        return entries
    for source in (baseline.get("repo_state", {}), baseline.get("ignored_roots", {})):
        if not isinstance(source, dict):
            continue
        rel = source.get("path")
        if not isinstance(rel, str) or not rel:
            continue
        if rel not in _baseline_entries_cache:
            abs_path = resolved_file(canonical_path(rel, label), label)
            loaded = load_json(abs_path, label) if abs_path and os.path.isfile(abs_path) else None
            _baseline_entries_cache[rel] = {
                entry.get("path"): {
                    field: entry.get(field)
                    for field in ("path", "type", "mode", "sha256", "link_target")
                }
                for entry in (loaded or {}).get("entries", [])
                if isinstance(entry, dict) and isinstance(entry.get("path"), str)
            }
        for entry_path, state in _baseline_entries_cache[rel].items():
            if entry_path in entries and entries[entry_path] != state:
                bad(f"{label}: tracked and ignored projections disagree about {entry_path}: "
                    f"{entries[entry_path]!r} != {state!r}")
            entries[entry_path] = state
    return entries


def baseline_digests(baseline, label):
    """Digest view used only for identities whose contract is specifically raw file bytes."""
    return {
        rel: state.get("sha256")
        for rel, state in baseline_entries(baseline, label).items()
        if state.get("type") != "directory" and isinstance(state.get("sha256"), str)
    }


def baseline_exclusions(baseline):
    """Paths the projection deliberately stopped enumerating. Their bytes are not absent from
    review — check_exclusion_bindings holds each one against the artifact that carries it — so a
    phase-aware comparison of projection entries has nothing to say about them."""
    if not isinstance(baseline, dict):
        return set()
    rel = (baseline.get("ignored_roots") or {}).get("path")
    if not isinstance(rel, str) or not rel:
        return set()
    abs_path = os.path.join(REPO, rel)
    if not os.path.isfile(abs_path):
        return set()
    loaded = load_json(abs_path, "baseline projection exclusions")
    return {entry.get("path") for entry in (loaded or {}).get("protocol_output_exclusions", [])
            if isinstance(entry, dict)}


def check_assigned_identity(obj, baseline, label):
    """A request's plan and frozen goal are BEFORE bindings, exactly like its source inputs: they
    record which revision the attempt was assigned under. Hashing them against the live tree makes
    an approved material revision retroactively defective in every attempt issued before it — and
    an immutable attempt cannot be edited to follow a plan it predates, so the defect is
    unclearable. The digest is held against the attempt's OWN captured baseline instead, where
    those bytes were recorded and can no longer move."""
    if not isinstance(obj, dict):
        bad(f"{label}: is not a {{path, sha256}} object")
        return
    rel = canonical_path(obj.get("path"), f"{label}.path")
    digest = obj.get("sha256")
    if not isinstance(digest, str) or not SHA256.fullmatch(digest):
        bad(f"{label}.sha256: {digest!r} is not a full lowercase SHA-256")
        return
    if rel is None:
        return
    recorded = baseline_digests(baseline, f"{label}.baseline").get(rel)
    if recorded is None:
        bad(f"{label}: {rel} is not enumerated by the attempt's own before baseline, so the "
            f"digest it binds is carried by nothing")
    elif recorded != digest:
        bad(f"{label}: binds {digest} but the attempt's before baseline captured {rel} as "
            f"{recorded}")


def check_artifact(artifact, path_label, artifact_path=None):
    kind = artifact.get("artifact_kind")
    if not isinstance(kind, str):
        bad(f"{path_label}: no artifact_kind")
        return None
    if kind.endswith("_template") or artifact.get("state") == "template":
        bad(f"{path_label}: artifact_kind {kind!r} / state {artifact.get('state')!r} is an inert "
            f"template; an issued artifact changes its kind and state")
        return None
    schema = schema_file("bootstrap-artifacts.schema.json")
    if kind not in schema["$defs"]:
        bad(f"{path_label}: unknown artifact_kind {kind!r}")
        return None
    check_schema(artifact, schema["$defs"][kind], schema, path_label)
    if artifact.get("state") != STATE_BY_KIND[kind]:
        bad(f"{path_label}: state {artifact.get('state')!r} is not {STATE_BY_KIND[kind]!r} "
            f"for {kind}")
    if artifact_path:
        stated = artifact.get("attempt_id")
        if stated and f"/{stated}/" not in artifact_path.replace(os.sep, "/") + "/":
            bad(f"{path_label}: declares {stated} but lives outside that attempt's directory")
    return kind


REQUIRED_DENIALS = None


def check_request(request, label):
    global REQUIRED_DENIALS
    schema = schema_file("bootstrap-artifacts.schema.json")
    REQUIRED_DENIALS = schema["x-required-write-denials"]["patterns"]
    allowed = request.get("allowed_paths", [])
    denied = request.get("forbidden_paths", [])
    for pattern in REQUIRED_DENIALS:
        if pattern not in denied:
            bad(f"{label}: mandatory write denial {pattern!r} is absent — a request that does "
                f"not deny it cannot be trusted not to write it")
    for name, values in (("allowed_paths", allowed), ("forbidden_paths", denied)):
        if len(set(values)) != len(values):
            duplicates = sorted({v for v in values if values.count(v) > 1})
            bad(f"{label}.{name}: duplicate entries {duplicates}")
        for value in values:
            canonical_path(value.replace("**", "x").replace("*", "x"), f"{label}.{name}")

    # An allowed path that also matches a denial is a contradiction, and the protocol resolves it
    # one way only: the request is invalid. An allowed path never implicitly overrides a denial.
    for allow in allowed:
        for deny in denied:
            if _overlaps(allow, deny):
                bad(f"{label}: allowed path {allow!r} overlaps denial {deny!r}; an allowed path "
                    f"never overrides a forbidden one")

    mutation = request.get("feature_tree_mutation", {})
    if mutation.get("allowed") is True:
        if request.get("work_package") != "WP-F082-APPLY":
            bad(f"{label}: feature_tree_mutation.allowed is true outside WP-F082-APPLY")
        for field in ("human_decision_ref", "human_decision_sha256", "approved_view_sha256"):
            if not mutation.get(field):
                bad(f"{label}: feature_tree_mutation.allowed is true without {field}")
        if not mutation.get("exact_operations"):
            bad(f"{label}: feature_tree_mutation.allowed is true with no exact_operations")
    else:
        if mutation.get("exact_operations"):
            bad(f"{label}: exact_operations are listed while feature_tree_mutation.allowed is "
                f"false")

    # Source inputs are a BEFORE binding: they record the bytes the attempt was assigned to work
    # from. Re-hashing them against the live tree would conflate "this request was well formed"
    # with "nothing has changed since" — and the attempt's whole job is to change some of them.
    # Shape and uniqueness gate here; the reviewer re-derives the digests against baseline_before.
    for index, entry in enumerate(request.get("source_inputs", [])):
        check_identity(entry, f"{label}.source_inputs[{index}]", expect_digest=False)
    paths = [entry.get("path") for entry in request.get("source_inputs", [])]
    if len(set(paths)) != len(paths):
        bad(f"{label}.source_inputs: duplicate path entries")
    if paths != sorted(paths):
        bad(f"{label}.source_inputs: not in canonical path order")

    baseline = request.get("baseline_before", {})
    check_assigned_identity(request.get("plan", {}), baseline, f"{label}.plan")
    check_assigned_identity(request.get("frozen_goal", {}), baseline, f"{label}.frozen_goal")
    check_identity(request.get("source_set", {}), f"{label}.source_set")
    check_baseline(baseline, f"{label}.baseline_before")

    # A source set is a closed manifest: it must list exactly the request's source_inputs.
    source_set = request.get("source_set", {})
    set_rel = canonical_path(source_set.get("path"), f"{label}.source_set.path")
    set_abs = resolved_file(set_rel, f"{label}.source_set") if set_rel else None
    if set_abs and os.path.isfile(set_abs):
        loaded = load_json(set_abs, f"{label}.source_set")
        if isinstance(loaded, dict):
            listed = [(e.get("path"), e.get("sha256"))
                      for e in loaded.get("entries", loaded.get("source_inputs", []))
                      if isinstance(e, dict)]
            requested = [(e.get("path"), e.get("sha256"))
                         for e in request.get("source_inputs", []) if isinstance(e, dict)]
            if sorted(listed) != sorted(requested):
                only_set = sorted(set(listed) - set(requested))
                only_req = sorted(set(requested) - set(listed))
                bad(f"{label}: source set and source_inputs path/digest pairs disagree "
                    f"(only in set: {only_set[:3]}, only in request: {only_req[:3]})")

    if request.get("work_package") == "WP-P0.G":
        pointers = [p for p in paths if p and p.endswith("WP-P0.0/accepted-attempt.json")]
        if not pointers:
            bad(f"{label}: a WP-P0.G request must bind the accepted WP-P0.0 pointer in its "
                f"source set; without it the package rests on an unaccepted predecessor")


def path_covered(rel, patterns):
    """True when a concrete path falls inside one of the request's path patterns."""
    for pattern in patterns:
        if not isinstance(pattern, str):
            continue
        if pattern.endswith("/**"):
            prefix = pattern[:-3]
            if rel == prefix or rel.startswith(prefix + "/"):
                return True
        elif "**/" in pattern:
            head, tail = pattern.split("**/", 1)
            if rel.startswith(head) and rel.endswith(tail):
                return True
        elif rel == pattern:
            return True
    return False


def check_phase_aware_sources(request, result, attempt):
    """The rule that lets an attempt change a file it was assigned to change without letting it
    change anything else.

    A source input is a BEFORE binding, so it is held against the attempt's own before baseline.
    Afterwards the two halves separate: a path the request allowed is bound by the AFTER baseline
    and never compared to the preimage it was required to move away from — comparing it would make
    doing the assigned work indistinguishable from tampering — while every other source must still
    hash to exactly what it did. Anything else that moved between the baselines is drift nobody
    authorised, whether or not the request listed it as a source."""
    before = baseline_entries(result.get("baseline_before", {}), f"{attempt}.baseline_before")
    after = baseline_entries(result.get("baseline_after", {}), f"{attempt}.baseline_after")
    if not before or not after:
        bad(f"{attempt}: the phase-aware source rule needs both baselines enumerated; one of them "
            f"records no paths")
        return
    allowed = request.get("allowed_paths", [])
    excluded = baseline_exclusions(result.get("baseline_before", {})) \
        | baseline_exclusions(result.get("baseline_after", {}))
    for index, entry in enumerate(request.get("source_inputs", [])):
        if not isinstance(entry, dict) or entry.get("path") in excluded:
            continue
        rel, digest = entry.get("path"), entry.get("sha256")
        label = f"{attempt}.source_inputs[{index}]"
        before_state = before.get(rel)
        after_state = after.get(rel)
        if before_state is None:
            bad(f"{label}: {rel} is not enumerated by the before baseline, so the digest the "
                f"request froze is carried by nothing")
        elif before_state.get("sha256") != digest:
            bad(f"{label}: binds {digest} but the before baseline captured {rel} as "
                f"{before_state.get('sha256')}")
        if path_covered(rel, allowed):
            if after_state is None:
                bad(f"{label}: {rel} was allowed to change, but the after baseline does not "
                    f"record it — an allowed source is bound by the after capture, not excused "
                    f"from one")
        elif after_state is None or after_state.get("sha256") != digest:
            bad(f"{label}: {rel} is not an allowed path but the after baseline records "
                f"{(None if after_state is None else after_state.get('sha256'))!r} instead of "
                f"{digest}")
    for rel in sorted(set(before) | set(after)):
        if rel in excluded or before.get(rel) == after.get(rel) or path_covered(rel, allowed):
            continue
        bad(f"{attempt}: {rel} changed type/mode/content/link state between the baselines and no "
            f"allowed path covers it")


def _overlaps(allow, deny):
    """True when an allowed path falls inside a denial pattern."""
    if deny.endswith("/**"):
        prefix = deny[:-3]
        return allow == prefix or allow.startswith(prefix + "/")
    if "**/" in deny:
        head, tail = deny.split("**/", 1)
        return allow.startswith(head) and allow.endswith(tail)
    return allow == deny


def check_baseline(baseline, label):
    if not isinstance(baseline, dict):
        bad(f"{label}: is not a baseline object")
        return
    check_identity(baseline.get("repo_state", {}), f"{label}.repo_state")
    check_identity(baseline.get("git_status", {}), f"{label}.git_status")
    roots = baseline.get("ignored_roots", {})
    if roots.get("profile") != "bootstrap_ignored_v1":
        bad(f"{label}.ignored_roots.profile: {roots.get('profile')!r} is not bootstrap_ignored_v1")
    check_identity({"path": roots.get("path"), "sha256": roots.get("sha256")},
                   f"{label}.ignored_roots")


def baselines_equal(left, right):
    def normalise(value):
        return json.dumps(value, sort_keys=True)
    return normalise(left) == normalise(right)


# --- evidence ---------------------------------------------------------------------------------

def check_evidence(manifest_path):
    manifest = load_json(manifest_path, "evidence manifest")
    if manifest is None:
        finish()
    schema = schema_file("evidence-manifest.schema.json")
    check_schema(manifest, schema, schema, "manifest")

    seen = {}
    directory = os.path.dirname(manifest_path)
    for index, entry in enumerate(manifest.get("entries", [])):
        label = f"manifest.entries[{index}]"
        rel = canonical_path(entry.get("path"), f"{label}.path")
        if rel is None:
            continue
        if rel in seen:
            bad(f"{label}: {rel} is listed twice (first at entry {seen[rel]})")
            continue
        seen[rel] = index
        abs_path = resolved_file(rel, label)
        if abs_path is None:
            continue
        if not os.path.isfile(abs_path):
            bad(f"{label}: {rel} is not a regular file")
            continue
        actual = digest_of(abs_path)
        if actual != entry.get("sha256"):
            bad(f"{label}: {rel} hashes to {actual}, manifest records {entry.get('sha256')}")
        size = os.path.getsize(abs_path)
        if size != entry.get("bytes"):
            bad(f"{label}: {rel} is {size} bytes, manifest records {entry.get('bytes')}")
        # An empty file is a no-op capture standing in for a run — except for the `*_raw` byte
        # streams, where empty is a real answer: no ignored paths, or a clean status. Treating
        # those as defects would make a clean repository unrepresentable.
        if size == 0 and not str(entry.get("artifact_kind", "")).endswith("_raw"):
            bad(f"{label}: {rel} is empty — a no-op capture is not evidence that anything ran")

    # An evidence directory holds data. A script under it could be executed by a verifier that
    # trusted the tree, which is how evidence starts deciding its own validity.
    for root, _dirs, files in os.walk(directory):
        for name in files:
            abs_path = os.path.join(root, name)
            rel = os.path.relpath(abs_path, REPO)
            if os.path.islink(abs_path):
                bad(f"evidence tree: {rel} is a symlink; evidence is bytes, not a pointer")
                continue
            if name.endswith((".sh", ".mjs", ".js", ".py", ".bash")) or os.access(abs_path, os.X_OK):
                bad(f"evidence tree: {rel} is executable or a script — evidence directories "
                    f"contain data, not verifiers")
            # The two baseline subtrees are bound by the request's `baseline_before` and the
            # result's `baseline_after` identities, not by this manifest — and the protocol seals
            # the manifest BEFORE capturing the after projection, so the after files cannot be in
            # it. They are bound, just not here; everything else present and unlisted is a byte
            # nobody reviewed.
            in_baseline = "/baseline-before/" in f"/{rel}" or "/baseline-after/" in f"/{rel}"
            if (rel != os.path.relpath(manifest_path, REPO) and rel not in seen
                    and not in_baseline):
                bad(f"evidence tree: {rel} is present but not listed in the manifest — an "
                    f"unbound output is a byte nobody reviewed")

    check_command_agreement(manifest, seen)
    return manifest


def check_command_agreement(manifest, listed):
    """A command capture must agree with itself: the recorded exit code is the one in the bytes."""
    for rel in sorted(listed):
        if not rel.endswith(".command.json"):
            continue
        loaded = load_json(os.path.join(REPO, rel), f"command capture {rel}")
        if not isinstance(loaded, dict):
            continue
        actual = loaded.get("actual_exit_code")
        expected = loaded.get("expected_exit_codes")
        if actual is None or not isinstance(expected, list):
            bad(f"command capture {rel}: missing actual_exit_code or expected_exit_codes")
            continue
        if actual not in expected:
            bad(f"command capture {rel}: exited {actual}, outside its expected set {expected}")
        for stream in ("stdout", "stderr"):
            block = loaded.get(stream)
            if not isinstance(block, dict):
                continue
            data = block.get("data")
            if isinstance(data, str) and block.get("encoding") == "base64":
                import base64
                try:
                    raw = base64.b64decode(data, validate=True)
                except Exception:
                    bad(f"command capture {rel}: {stream}.data is not valid base64")
                    continue
                if hashlib.sha256(raw).hexdigest() != block.get("sha256"):
                    bad(f"command capture {rel}: {stream} digest does not match its own bytes")
                if len(raw) != block.get("bytes"):
                    bad(f"command capture {rel}: {stream} byte count disagrees with its bytes")


# --- ignored projection -------------------------------------------------------------------------

# `reason` says what the excluded path IS; the binding names the artifact DOWNSTREAM of it that
# carries its digest. The direction matters: a request is not evidence for itself, it is bound by
# the result that quotes it, and the result by the subject that quotes the result. The last link
# in the chain has nothing after it yet, so it is carried externally — a `$`-prefixed field — and
# is the one case where the binding artifact may be the excluded path itself. That is the
# protocol's answer to "no artifact is asked to hash itself".
CARRIER_BY_REASON = {
    "work_request": {"work-result.json"},
    "work_result": {"verification-subject.json"},
    "verification_subject": {"verification-subject.json"},
    # A review is carried by the accepted pointer that quotes it — unless the verdict was not
    # `accepted`, in which case no pointer may ever exist and the only artifact downstream of the
    # review is the successor attempt's request, which binds it as a source input.
    "package_review": {"accepted-attempt.json", "work-request.json"},
    "accepted_pointer": {"implementation-continuation.json", "accepted-attempt.json"},
    "implementation_continuation": {"implementation-continuation.json"},
    "evidence_manifest": {"verification-subject.json", "work-result.json"},
    "evidence_entry": {"manifest.json"},
    "projection_manifest": {"work-request.json", "work-result.json"},
    "projection_raw_component": {"ignored-projection.json"},
}


REVIEW_NAME = re.compile(r"^(WP-[A-Za-z0-9._-]+)-(A-\d{3})-codex-review\.md$")
REQUEST_IN_ATTEMPT = re.compile(r"/(WP-[A-Za-z0-9._-]+)/(A-\d{3})/work-request\.json$")


def check_review_carried_by_request(rel, artifact_rel, field, label):
    """The request route exists for a review that no pointer can follow, so it is held to the two
    things that make it independent: the request carries the review as a source input, and it
    belongs to a LATER attempt. Without the ordering an attempt could name its own request and
    subtract its own review from the projection."""
    if field != f"source_inputs[path={rel}].sha256":
        bad(f"{label}: a request carries a review only as its own source input; {field!r} is not "
            f"source_inputs[path={rel}].sha256")
        return
    reviewed = REVIEW_NAME.fullmatch(rel.rsplit("/", 1)[-1])
    carrying = REQUEST_IN_ATTEMPT.search(artifact_rel)
    if not reviewed or not carrying:
        bad(f"{label}: {artifact_rel} and {rel} do not name a work package and attempt, so the "
            f"review's carrier cannot be shown to come after it")
        return
    if reviewed.group(1) != carrying.group(1) or carrying.group(2) <= reviewed.group(2):
        bad(f"{label}: {carrying.group(2)} of {carrying.group(1)} does not come after "
            f"{reviewed.group(2)} of {reviewed.group(1)}; only a later attempt in the same "
            f"package carries an unaccepted review")


def check_projection(projection_path):
    projection = load_json(projection_path, "ignored projection")
    if projection is None:
        finish()
    schema = schema_file("ignored-projection.schema.json")
    check_schema(projection, schema, schema, "projection")

    self_rel = os.path.relpath(projection_path, REPO)
    excluded = {}
    for index, entry in enumerate(projection.get("protocol_output_exclusions", [])):
        label = f"projection.protocol_output_exclusions[{index}]"
        rel = canonical_path(entry.get("path"), f"{label}.path")
        if rel is None:
            continue
        if rel in excluded:
            bad(f"{label}: {rel} is excluded twice")
            continue
        excluded[rel] = entry
        if "*" in rel or "?" in rel or rel.endswith("/"):
            bad(f"{label}: {rel!r} is a pattern or directory, not an exact path; a prefix "
                f"exclusion hides whatever later lands under it")
        abs_path = os.path.join(REPO, rel)
        if os.path.isdir(abs_path) and not os.path.islink(abs_path):
            bad(f"{label}: {rel} is a directory; exclusions expand to individual paths")

        binding = entry.get("binding", {})
        artifact_rel = canonical_path(binding.get("artifact_path"), f"{label}.binding.artifact_path")
        external = str(binding.get("field", "")).startswith("$")
        if artifact_rel == rel and not external:
            bad(f"{label}: {rel} is bound by itself — a self-reference is not an independent "
                f"binding")
            continue
        carriers = CARRIER_BY_REASON.get(entry.get("reason"))
        if carriers and artifact_rel and artifact_rel.rsplit("/", 1)[-1] not in carriers:
            bad(f"{label}: reason {entry.get('reason')!r} must be carried by one of "
                f"{sorted(carriers)}, not {artifact_rel}")
        elif entry.get("reason") == "package_review" and artifact_rel \
                and artifact_rel.endswith("/work-request.json"):
            check_review_carried_by_request(rel, artifact_rel, binding.get("field", ""), label)
        # `expected_state` describes the path AT CAPTURE, not now. A `before` projection declares
        # the attempt's own outputs absent precisely because the attempt has not produced them
        # yet; they must exist afterwards. So only `present` is checkable from here, and whether
        # a produced output is genuinely bound is checked in --package, where the artifact that
        # binds it exists to be read.
        if entry.get("expected_state") == "present" and not os.path.lexists(os.path.join(REPO, rel)):
            bad(f"{label}: {rel} is declared present at capture but is absent")

    # A binding chain that loops proves nothing: A binds B and B binds A means neither is
    # independently carried.
    # An externally carried identity terminates the chain rather than pointing onward, so it is
    # not an edge. Without that, the last link would always look like a one-node cycle.
    edges = {rel: entry.get("binding", {}).get("artifact_path")
             for rel, entry in excluded.items()
             if not str(entry.get("binding", {}).get("field", "")).startswith("$")}
    for start in edges:
        seen, node = set(), start
        while node in edges and node not in seen:
            seen.add(node)
            node = edges[node]
        if node in seen:
            bad(f"projection: exclusion binding cycle through {sorted(seen)[:3]}")
            break

    if self_rel in excluded and excluded[self_rel].get("reason") != "projection_manifest":
        bad(f"projection: excludes itself for reason "
            f"{excluded[self_rel].get('reason')!r} rather than projection_manifest")

    entry_paths = [entry.get("path") for entry in projection.get("entries", [])]
    if len(set(entry_paths)) != len(entry_paths):
        bad("projection.entries: a path is listed more than once")
    if entry_paths != sorted(entry_paths, key=lambda item: item.encode("utf-8")):
        bad("projection.entries: not in canonical byte order")
    for rel in entry_paths:
        if rel in excluded:
            bad(f"projection.entries: {rel} is both enumerated and excluded")
    return projection, excluded


EXTERNAL = object()


def resolve_field(document, expression):
    """Read the value a binding names. Supports dotted paths, `entries[path=X].field` selectors,
    and `$name` for an identity deliberately carried outside the artifact."""
    if expression.startswith("$"):
        return EXTERNAL
    # Split on dots OUTSIDE the brackets. A selector names a repo-relative path, and those are
    # full of dots (".ae/…", "….command.json"), so a plain split on "." tears the selector apart
    # and every binding silently resolves to nothing — which reads exactly like an unbound output.
    steps, depth, current_step = [], 0, ""
    for character in expression:
        if character == "[":
            depth += 1
        elif character == "]":
            depth -= 1
        if character == "." and depth == 0:
            steps.append(current_step)
            current_step = ""
        else:
            current_step += character
    steps.append(current_step)

    current = document
    for step in steps:
        match = re.fullmatch(r"([A-Za-z0-9_-]+)(?:\[path=([^\]]+)\])?", step)
        if not match:
            return None
        name, selector = match.group(1), match.group(2)
        if not isinstance(current, dict) or name not in current:
            return None
        current = current[name]
        if selector is not None:
            if not isinstance(current, list):
                return None
            rows = [row for row in current
                    if isinstance(row, dict) and row.get("path") == selector]
            if len(rows) != 1:
                return None
            current = rows[0]
    return current


def check_exclusion_bindings(excluded, label):
    """Every excluded path that the attempt actually produced must have its bytes carried by the
    independent artifact its binding names. This is the rule that stops an exclusion from being a
    way to remove a file from review: subtracting it from the projection is only allowed because
    something else is still hashing it."""
    for rel, entry in sorted(excluded.items()):
        abs_path = os.path.join(REPO, rel)
        if not os.path.isfile(abs_path):
            continue
        binding = entry.get("binding", {})
        artifact_rel = binding.get("artifact_path")
        field = binding.get("field", "")
        artifact_abs = os.path.join(REPO, artifact_rel) if artifact_rel else None
        if not artifact_abs or not os.path.isfile(artifact_abs):
            bad(f"{label}: {rel} exists but its binding artifact {artifact_rel} does not — an "
                f"excluded output that nothing binds is a byte removed from review")
            continue
        document = load_json(artifact_abs, f"{label} binding {artifact_rel}")
        if document is None:
            continue
        carried = resolve_field(document, field)
        if carried is EXTERNAL:
            continue
        if carried is None:
            bad(f"{label}: {artifact_rel} has no field {field!r} to carry {rel}")
            continue
        actual = digest_of(abs_path)
        if carried != actual:
            bad(f"{label}: {rel} hashes to {actual} but {artifact_rel}.{field} records "
                f"{carried!r}")


# --- package chain ------------------------------------------------------------------------------

def check_package(package_dir):
    attempts = sorted(d for d in os.listdir(package_dir)
                      if re.fullmatch(r"A-\d{3}", d)
                      and os.path.isdir(os.path.join(package_dir, d)))
    if not attempts:
        bad(f"{package_dir}: no A-NNN attempt directory")
        finish()

    for attempt in attempts:
        attempt_dir = os.path.join(package_dir, attempt)
        request_path = os.path.join(attempt_dir, "work-request.json")
        result_path = os.path.join(attempt_dir, "work-result.json")
        subject_path = os.path.join(attempt_dir, "verification-subject.json")
        audit_path = os.path.join(attempt_dir, "request-audit.json")

        # A request rejected BEFORE assignment is not an attempt. It never received the write
        # token and never produced work, so holding it to an issued request's contract reports
        # defects that are just its age — it was written against an earlier plan revision, and
        # that revision is exactly what the audit records. The protocol keeps its bytes as an
        # ordinary immutable input to the next baseline, and what must be checked is that it
        # stayed that: no result, no subject, nothing that could be mistaken for a prior attempt.
        if os.path.isfile(audit_path) and not os.path.isfile(result_path):
            if os.path.isfile(subject_path):
                bad(f"{attempt}: rejected pre-assignment (it carries request-audit.json) but also "
                    f"has a verification-subject.json — a rejected request never became an attempt")
            if not os.path.isfile(request_path):
                bad(f"{attempt}: has request-audit.json but no work-request.json to audit")
            continue
        if os.path.isfile(audit_path):
            bad(f"{attempt}: carries both request-audit.json and work-result.json — a request "
                f"rejected before assignment cannot also have produced work")

        if not os.path.isfile(request_path):
            bad(f"{attempt}: no work-request.json")
            continue
        request = load_json(request_path, f"{attempt} request")
        if request is None:
            continue
        if check_artifact(request, f"{attempt}.request", request_path) is None:
            continue
        check_request(request, f"{attempt}.request")

        if not os.path.isfile(result_path):
            continue
        result = load_json(result_path, f"{attempt} result")
        if result is None or check_artifact(result, f"{attempt}.result", result_path) is None:
            continue

        # The result must bind the request it was issued from — the exact bytes, not a path that
        # happens to sit in the same directory.
        bound = result.get("request", {})
        if canonical_path(bound.get("path"), f"{attempt}.result.request.path") != \
                os.path.relpath(request_path, REPO):
            bad(f"{attempt}: result binds request {bound.get('path')!r}, not its own "
                f"{os.path.relpath(request_path, REPO)}")
        if bound.get("sha256") != digest_of(request_path):
            bad(f"{attempt}: result binds a request digest that is not this request's bytes")
        for field in ("work_package", "attempt_id", "material_revision", "strategy_revision"):
            if result.get(field) != request.get(field):
                bad(f"{attempt}: result {field} {result.get(field)!r} does not match the "
                    f"request's {request.get(field)!r}")
        for field in ("plan", "frozen_goal", "source_set"):
            if result.get(field) != request.get(field):
                bad(f"{attempt}: result {field} identity differs from the request's")
        if not baselines_equal(result.get("baseline_before"), request.get("baseline_before")):
            bad(f"{attempt}: result baseline_before differs from the request's — the attempt did "
                f"not start where it was assigned to start")
        check_baseline(result.get("baseline_after", {}), f"{attempt}.result.baseline_after")
        check_identity(result.get("evidence_manifest", {}), f"{attempt}.result.evidence_manifest")
        check_phase_aware_sources(request, result, attempt)

        # Commands: every command the request assigned must appear in the result with an actual
        # exit code inside its expected set, and raw output that exists.
        assigned = [(tuple(c.get("argv", [])), tuple(c.get("expected_exit_codes", [])))
                    for c in request.get("commands", [])]
        recorded = [(tuple(c.get("argv", [])), tuple(c.get("expected_exit_codes", [])))
                    for c in result.get("commands", [])]
        for spec in assigned:
            if spec not in recorded:
                bad(f"{attempt}: assigned command {' '.join(spec[0])!r} has no record in the result")
        for index, command in enumerate(result.get("commands", [])):
            label = f"{attempt}.result.commands[{index}]"
            if command.get("actual_exit_code") not in command.get("expected_exit_codes", []):
                bad(f"{label}: exited {command.get('actual_exit_code')}, outside "
                    f"{command.get('expected_exit_codes')}")
            check_identity(command.get("raw_output", {}), f"{label}.raw_output")

        manifest_rel = canonical_path(result.get("evidence_manifest", {}).get("path"),
                                      f"{attempt}.result.evidence_manifest.path")
        if manifest_rel:
            manifest_abs = resolved_file(manifest_rel, f"{attempt}.evidence_manifest")
            if manifest_abs and os.path.isfile(manifest_abs):
                check_evidence(manifest_abs)

        if not os.path.isfile(subject_path):
            continue
        subject = load_json(subject_path, f"{attempt} subject")
        if subject is None or check_artifact(subject, f"{attempt}.subject", subject_path) is None:
            continue
        if subject.get("result", {}).get("sha256") != digest_of(result_path):
            bad(f"{attempt}: subject binds a result digest that is not this result's bytes")
        if subject.get("request", {}).get("sha256") != digest_of(request_path):
            bad(f"{attempt}: subject binds a request digest that is not this request's bytes")
        for field in ("source_set", "evidence_manifest"):
            if subject.get(field) != result.get(field):
                bad(f"{attempt}: subject {field} identity differs from the result's")
        for field in ("baseline_before", "baseline_after"):
            if not baselines_equal(subject.get(field), result.get(field)):
                bad(f"{attempt}: subject {field} differs from the result's")
        if subject.get("attempt_id") != request.get("attempt_id"):
            bad(f"{attempt}: subject attempt_id {subject.get('attempt_id')!r} is not the "
                f"request's {request.get('attempt_id')!r}")

        # With the chain complete, the after projection's exclusions can be held to their
        # bindings: every output it stopped enumerating must be hashed somewhere else.
        after_rel = canonical_path(result.get("baseline_after", {})
                                   .get("ignored_roots", {}).get("path"),
                                   f"{attempt}.result.baseline_after.ignored_roots.path")
        after_abs = resolved_file(after_rel, f"{attempt}.baseline_after.ignored_roots") \
            if after_rel else None
        if after_abs and os.path.isfile(after_abs):
            _, exclusions = check_projection(after_abs)
            check_exclusion_bindings(exclusions, f"{attempt}.after-projection")

    pointer_path = os.path.join(package_dir, "accepted-attempt.json")
    if os.path.isfile(pointer_path):
        pointer = load_json(pointer_path, "accepted pointer")
        if pointer is not None:
            check_artifact(pointer, "accepted_pointer", pointer_path)

    continuation_path = os.path.join(package_dir, "implementation-continuation.json")
    if os.path.isfile(continuation_path):
        continuation = load_json(continuation_path, "continuation")
        if continuation is not None and \
                check_artifact(continuation, "continuation", continuation_path) is not None:
            for field in ("p0_0_accepted_attempt", "p0_g_accepted_attempt"):
                check_identity(continuation.get(field, {}), f"continuation.{field}")
            if continuation.get("implementation_next_allowed") == "P0.1" and \
                    continuation.get("program_decision") != "continue_mainline":
                bad("continuation: sets implementation_next_allowed to P0.1 without a "
                    "continue_mainline program decision")
            if continuation.get("rollout_eligible") is not False or \
                    continuation.get("rollout_lock_forbidden") is not True:
                bad("continuation: claims rollout eligibility this bootstrap cannot grant")


# --- dispatch ------------------------------------------------------------------------------------

rel_target = os.path.relpath(target, REPO)
if mode == "--artifact":
    artifact = load_json(target, "artifact")
    if artifact is None:
        finish()
    kind = check_artifact(artifact, "artifact", target)
    if kind == "bootstrap_work_request":
        check_request(artifact, "artifact")
    summary = f"{rel_target} ({kind})"
elif mode == "--evidence":
    check_evidence(target)
    summary = f"evidence manifest {rel_target}"
elif mode == "--ignored":
    check_projection(target)  # returns (projection, exclusions); only its checks matter here
    summary = f"projection {rel_target}"
else:
    check_package(target)
    summary = f"package {rel_target}"

if not problems:
    print(f"validate-artifacts: {summary} is valid")
finish()
PY
