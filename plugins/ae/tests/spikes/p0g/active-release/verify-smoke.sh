#!/bin/sh
# P0.G-lite deterministic A/B and stale-session smoke. Not host qualification.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
command -v node >/dev/null 2>&1 || { echo 'active-release-smoke: unknown (node missing)'; exit 42; }
command -v python3 >/dev/null 2>&1 || { echo 'active-release-smoke: unknown (python3 missing)'; exit 42; }

exec python3 - "$HERE/resolve-active-root.mjs" <<'PY'
import copy, hashlib, json, os, shutil, subprocess, sys, tempfile

resolver = sys.argv[1]
root = tempfile.mkdtemp(prefix="ae-p0g-active-")
session = "00000000-0000-4000-8000-00000000f083"


def sha(data): return hashlib.sha256(data).hexdigest()
def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    raw = data if isinstance(data, bytes) else json.dumps(data, sort_keys=True).encode()
    with open(path, "wb") as handle: handle.write(raw)
    return sha(raw)


try:
    a, b = os.path.join(root, "cache-A"), os.path.join(root, "plugin-B")
    digest_a = write(os.path.join(a, "release-manifest-v1.json"), b"release A\n")
    digest_b = write(os.path.join(b, "release-manifest-v1.json"), b"release B\n")
    base = {
        "artifact_kind": "p0g_active_release_observation_v1", "artifact_version": 1,
        "authority": "none", "plugin_name": "ae", "expected_session_id": session,
        "launch": {"cwd": root, "argv": ["claude", "--plugin-dir", b]},
        "host_init": {"type": "system", "subtype": "init", "session_id": session,
                      "plugins": [{"name": "ae", "path": b, "source": "ae@inline",
                                   "version": "0.14.2"}]},
        "candidates": [{"root": a, "manifest_sha256": digest_a},
                       {"root": b, "manifest_sha256": digest_b}],
    }

    def run(document):
        target = os.path.join(root, "observation.json")
        with open(target, "w", encoding="utf-8") as handle: json.dump(document, handle)
        proc = subprocess.run(["node", resolver, target], text=True,
                              stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        return proc.returncode, proc.stdout

    code, out = run(base)
    assert code == 0, out
    result = json.loads(out)
    assert result["active_root"] == os.path.realpath(b) and result["capability"] is None

    cases = []
    altered = copy.deepcopy(base); altered["host_init"] = {}
    cases.append(("env-only/no host record", altered, "system-init"))
    altered = copy.deepcopy(base); altered["launch"]["argv"][-1] = a
    cases.append(("old A launcher while host active B", altered, "different roots"))
    altered = copy.deepcopy(base); altered["host_init"]["plugins"].append(
        copy.deepcopy(altered["host_init"]["plugins"][0]))
    cases.append(("duplicate active rows", altered, "not unique"))
    altered = copy.deepcopy(base); altered["expected_session_id"] = "old-session"
    cases.append(("stale session record", altered, "different session"))
    altered = copy.deepcopy(base); altered["candidates"][1]["manifest_sha256"] = "0" * 64
    cases.append(("manifest drift", altered, "does not match"))
    altered = copy.deepcopy(base); altered["caller_active_root"] = b
    cases.append(("direct caller root", altered, "unknown caller field"))
    for label, document, signature in cases:
        code, out = run(document)
        assert code != 0 and signature in out, (label, out)

    print(json.dumps({"lane": "active_release", "result": "plausible",
                      "qualification": False,
                      "support_arm": "macos-26.6.2-arm64-cc-2.1.231-plugin-dir",
                      "real_host_fact": "CC system-init emits session-correlated plugin name/path/source/version",
                      "checks": ["A/B selects host-emitted B", "old A rejected",
                                 "env-only rejected", "duplicate rejected", "stale session rejected",
                                 "manifest drift rejected", "direct caller root rejected"]}, sort_keys=True))
finally:
    shutil.rmtree(root)
PY
