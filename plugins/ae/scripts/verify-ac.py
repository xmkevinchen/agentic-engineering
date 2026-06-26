#!/usr/bin/env python3
"""verify-ac.py — run ONE acceptance criterion's `verify:` command.

SUBPROCESS-ONLY: run as `python3 verify-ac.py <plan.md> <AC-id>`.
  exit 0 = the AC's `verify:` command passed
  exit 1 = command failed / no `verify:` line / forgeable `verify:` value / AC not found / plan unreadable
  exit 2 = usage error

The deterministic per-AC floor for HDD: gives the per-AC granularity a single
project `test.command` can't (which AC passed). No DAG, no ledger, no NODE_STATE
— one AC's runnable check, nothing else.
"""
import sys
import re
import subprocess

if __name__ != "__main__":
    raise SystemExit("verify-ac.py is subprocess-only; do not import")

FORGEABLE = ("", ".", "./", "*")


def main(argv):
    if len(argv) != 3:
        sys.stderr.write("usage: verify-ac.py <plan.md> <AC-id>\n")
        return 2
    plan, ac_id = argv[1], argv[2].strip()
    m = re.match(r"^(?:AC)?(\w+)$", ac_id)
    if not m:
        sys.stderr.write(f"bad AC-id: {ac_id}\n")
        return 2
    key = "AC" + m.group(1)
    try:
        text = open(plan, encoding="utf-8").read()
    except OSError as e:
        sys.stderr.write(f"cannot read plan: {e}\n")
        return 1
    lines = text.splitlines()
    start = None
    for i, ln in enumerate(lines):
        if re.match(rf"^###\s+{re.escape(key)}\b", ln):
            start = i
            break
    if start is None:
        sys.stderr.write(f"AC not found: {key}\n")
        return 1
    cmd = None
    for ln in lines[start + 1:]:
        if re.match(r"^#{2,3}\s", ln):  # next ## / ### heading ends the AC block
            break
        mm = re.match(r"^\s*-?\s*verify:\s*(.*)$", ln)
        if mm:
            cmd = mm.group(1).strip()
            break
    if cmd is None:
        sys.stderr.write(f"{key}: no verify: line (no runnable check)\n")
        return 1
    if cmd in FORGEABLE:
        sys.stderr.write(f"{key}: forgeable verify: value ({cmd!r})\n")
        return 1
    return 0 if subprocess.run(cmd, shell=True).returncode == 0 else 1


sys.exit(main(sys.argv))
