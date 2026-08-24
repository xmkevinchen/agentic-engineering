#!/bin/sh
# P0.G-lite: runner-owned sandbox-exec + process-group cleanup feasibility. Not qualification.
set -eu
[ "$(uname -s)" = Darwin ] || { echo 'isolation-smoke: unknown (Darwin only)'; exit 42; }
[ -x /usr/bin/sandbox-exec ] || { echo 'isolation-smoke: not_feasible (sandbox-exec absent)'; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo 'isolation-smoke: unknown (python3 missing)'; exit 42; }

exec python3 - <<'PY'
import json, os, shutil, signal, socket, subprocess, tempfile, time

root = os.path.realpath(tempfile.mkdtemp(prefix="ae-p0g-isolation-"))
allowed = os.path.join(root, "allowed")
denied = os.path.join(root, "denied")
os.mkdir(allowed); os.mkdir(denied)
child = os.path.join(root, "child.py")
profile = os.path.join(root, "profile.sb")
checks = []

source = r'''import json, os, socket, subprocess, sys, time
mode = sys.argv[1]
if mode == "boundaries":
    result = {"canary_absent": "AE_P0G_SECRET_CANARY" not in os.environ}
    try:
        open(os.path.join(os.environ["AE_ALLOWED"], "ok"), "x").write("ok")
        result["allowed_write"] = True
    except OSError:
        result["allowed_write"] = False
    try:
        open(os.path.join(os.environ["AE_DENIED"], "bad"), "x").write("bad")
        result["denied_write"] = False
    except OSError:
        result["denied_write"] = True
    sock = socket.socket()
    sock.settimeout(1)
    try:
        sock.connect(("127.0.0.1", int(os.environ["AE_PORT"])))
        result["network_denied"] = False
    except OSError:
        result["network_denied"] = True
    print(json.dumps(result))
elif mode == "descendant":
    proc = subprocess.Popen(["/bin/sleep", "60"])
    print(proc.pid, flush=True)
    time.sleep(60)
'''
with open(child, "x", encoding="utf-8") as handle: handle.write(source)

# Read access is deliberately broad for this feasibility smoke so the system Python can load.
# Writes are closed to the one scratch root and network has no allow rule.
policy = f'''(version 1)
(deny default)
(allow process*)
(allow signal (target same-sandbox))
(allow file-read*)
(allow file-write* (subpath "{allowed}"))
(allow sysctl-read)
(allow mach-lookup)
'''
with open(profile, "x", encoding="utf-8") as handle: handle.write(policy)

server = socket.socket()
server.bind(("127.0.0.1", 0)); server.listen(1)
env = {"PATH": "/usr/bin:/bin", "LANG": "C", "LC_ALL": "C", "HOME": allowed,
       "TMPDIR": allowed, "AE_ALLOWED": allowed, "AE_DENIED": denied,
       "AE_PORT": str(server.getsockname()[1])}

try:
    run = subprocess.run(["/usr/bin/sandbox-exec", "-f", profile, "/usr/bin/python3", child,
                          "boundaries"], env=env, text=True, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, timeout=10)
    if run.returncode != 0:
        raise RuntimeError(f"sandbox child exited {run.returncode}: {run.stderr.strip()}")
    result = json.loads(run.stdout)
    assert result == {"canary_absent": True, "allowed_write": True,
                      "denied_write": True, "network_denied": True}, result
    checks.extend(["environment canary absent", "allowed root writable",
                   "sibling root denied", "loopback network denied"])

    descendant = subprocess.Popen(["/usr/bin/sandbox-exec", "-f", profile,
                                   "/usr/bin/python3", child, "descendant"], env=env,
                                  text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                  start_new_session=True)
    descendant_pid = int(descendant.stdout.readline().strip())
    try:
        descendant.wait(timeout=0.25)
        raise AssertionError("descendant fixture exited before timeout")
    except subprocess.TimeoutExpired:
        os.killpg(descendant.pid, signal.SIGKILL)
        descendant.wait(timeout=5)
    time.sleep(0.05)
    try:
        os.kill(descendant_pid, 0)
    except ProcessLookupError:
        pass
    else:
        raise AssertionError(f"descendant {descendant_pid} survived process-group cleanup")
    checks.append("timeout kills runner process group and descendant")

    print(json.dumps({"lane": "child_isolation", "result": "plausible",
                      "support_arm": "macos-26.6.2-arm64-cc-2.1.231-plugin-dir",
                      "qualification": False, "provider_candidate": "sandbox-exec+process-group",
                      "checks": checks}, sort_keys=True))
finally:
    server.close()
    shutil.rmtree(root)
PY
