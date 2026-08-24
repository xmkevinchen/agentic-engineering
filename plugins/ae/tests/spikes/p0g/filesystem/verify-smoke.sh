#!/bin/sh
# P0.G-lite: macOS file+directory no-replace feasibility. Not qualification.
set -eu
[ "$(uname -s)" = Darwin ] || { echo 'filesystem-smoke: unknown (Darwin only)'; exit 42; }
command -v python3 >/dev/null 2>&1 || { echo 'filesystem-smoke: unknown (python3 missing)'; exit 42; }

exec python3 - <<'PY'
import ctypes, errno, json, os, shutil, tempfile

libc = ctypes.CDLL(None, use_errno=True)
renamex = libc.renamex_np
renamex.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
renamex.restype = ctypes.c_int
RENAME_EXCL = 0x00000004
root = tempfile.mkdtemp(prefix="ae-p0g-fs-")
checks = []


def move_excl(source, target):
    ctypes.set_errno(0)
    rc = renamex(os.fsencode(source), os.fsencode(target), RENAME_EXCL)
    return rc, ctypes.get_errno()


def fsync_dir(directory):
    fd = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def race(kind):
    source_parents = [os.path.join(root, f"{kind}-source-{index}") for index in (1, 2)]
    target_parent = os.path.join(root, f"{kind}-target")
    for directory in [*source_parents, target_parent]:
        os.mkdir(directory)
    sources = [os.path.join(source_parents[index], "candidate") for index in (0, 1)]
    payloads = [f"complete-{kind}-{index}\n".encode() for index in (1, 2)]
    for source, payload in zip(sources, payloads):
        if kind == "file":
            with open(source, "xb") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
        else:
            os.mkdir(source)
            nested = os.path.join(source, "payload")
            with open(nested, "xb") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            fsync_dir(source)
        fsync_dir(os.path.dirname(source))

    target = os.path.join(target_parent, "published")
    start_r, start_w = os.pipe()
    result_r, result_w = os.pipe()
    children = []
    for index, source in enumerate(sources):
        pid = os.fork()
        if pid == 0:
            os.close(start_w); os.close(result_r)
            os.read(start_r, 1)
            rc, err = move_excl(source, target)
            os.write(result_w, json.dumps({"index": index, "rc": rc, "errno": err}).encode() + b"\n")
            os._exit(0)
        children.append(pid)
    os.close(start_r); os.close(result_w)
    os.write(start_w, b"12"); os.close(start_w)
    raw = b""
    while True:
        part = os.read(result_r, 4096)
        if not part: break
        raw += part
    os.close(result_r)
    for pid in children: os.waitpid(pid, 0)
    outcomes = [json.loads(line) for line in raw.splitlines()]
    winners = [item for item in outcomes if item["rc"] == 0]
    losers = [item for item in outcomes if item["rc"] == -1 and item["errno"] == errno.EEXIST]
    assert len(winners) == 1 and len(losers) == 1, outcomes
    winner = winners[0]["index"]
    actual = open(target, "rb").read() if kind == "file" else open(os.path.join(target, "payload"), "rb").read()
    assert actual == payloads[winner]
    assert os.path.lexists(sources[1 - winner])
    fsync_dir(source_parents[winner])
    fsync_dir(target_parent)
    checks.append(f"{kind}: one race winner, loser EEXIST, intact payload, both parents fsynced")


def target_exists(kind):
    parent = os.path.join(root, f"{kind}-exists")
    os.mkdir(parent)
    source, target = os.path.join(parent, "source"), os.path.join(parent, "target")
    if kind == "file":
        open(source, "wb").write(b"new")
        open(target, "wb").write(b"old")
    else:
        os.mkdir(source); os.mkdir(target)
        open(os.path.join(source, "payload"), "wb").write(b"new")
        open(os.path.join(target, "payload"), "wb").write(b"old")
    rc, err = move_excl(source, target)
    assert rc == -1 and err == errno.EEXIST
    actual = open(target, "rb").read() if kind == "file" else open(os.path.join(target, "payload"), "rb").read()
    assert actual == b"old" and os.path.lexists(source)
    checks.append(f"{kind}: existing target preserved and source retained")


try:
    race("file"); race("directory")
    target_exists("file"); target_exists("directory")
    print(json.dumps({"lane": "filesystem", "result": "plausible", "qualification": False,
                      "support_arm": "macos-26.6.2-arm64-cc-2.1.231-plugin-dir",
                      "api": "renamex_np(RENAME_EXCL)",
                      "filesystem": "unqualified_p0g_lite",
                      "device": os.stat(root).st_dev, "checks": checks}, sort_keys=True))
finally:
    shutil.rmtree(root)
PY
