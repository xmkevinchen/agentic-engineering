#!/usr/bin/env python3
"""collect-ac-evidence.py — run ONE acceptance criterion's `verify:` command and
emit a structured EVIDENCE record. It MEASURES; it never judges (verdict stays null).

SUBPROCESS-ONLY: `python3 collect-ac-evidence.py <plan.md> <AC-id>`.
  exit 0 = command ran + evidence is non-vacuous (or exit_code_only opt-in)
  exit 1 = collector-integrity-failure (evidence VACUOUS — zero/under-min match, or
           unknown parser with no match signal + exit 0) OR the command itself failed
  exit 2 = usage error

"Machines measure, LLM judges meaning" (F-065): this script reports facts
(exit_code, matched tests, zero_match) into <milestone-dir>/evidence/<AC-id>.json
with `verdict: null`; /ae:review Check 7's isolated cross-family judge reads the
evidence + the test bodies and WRITES BACK the verdict. The collector decides ONLY
"is this evidence vacuous", never "did the AC pass".
"""
import sys
import os
import re
import json
import subprocess

if __name__ != "__main__":
    raise SystemExit("collect-ac-evidence.py is subprocess-only; do not import")

FORGEABLE = ("", ".", "./", "*", "true", ":")


def ac_block(text, key):
    lines = text.splitlines()
    start = None
    for i, ln in enumerate(lines):
        if re.match(rf"^###\s+{re.escape(key)}\b", ln):
            start = i
            break
    if start is None:
        return None
    out = []
    for ln in lines[start + 1:]:
        if re.match(r"^#{2,3}\s", ln):
            break
        out.append(ln)
    return out


def field(block, name):
    for ln in block:
        m = re.match(rf"^\s*-?\s*{name}:\s*(.*)$", ln)
        if m:
            return m.group(1).strip()
    return None


def infer_parser(cmd, declared):
    if declared:
        return declared, True
    if re.search(r"\bcargo\s+test\b", cmd):
        return "cargo-test.v1", True
    if re.search(r"\bpytest\b", cmd):
        return "pytest.v1", True
    return (cmd.split()[0] if cmd.split() else "unknown"), False


def parse_output(parser, text):
    """Return (matched_count, matched_tests) or (None, []) if parser can't count.
    matched_count = EXECUTED non-skipped tests (filtered/ignored/skipped excluded)."""
    if parser == "cargo-test.v1":
        tests = []
        for m in re.finditer(r"^test\s+(\S+)\s+\.\.\.\s+(ok|FAILED)$", text, re.M):
            tests.append({"name": m.group(1), "status": m.group(2).lower(),
                          "file": None, "line": None})
        # executed = passed + failed (filtered/ignored not counted)
        agg = re.search(r"(\d+)\s+passed;\s*(\d+)\s+failed", text)
        if agg:
            return int(agg.group(1)) + int(agg.group(2)), tests
        return (len(tests) if tests else 0), tests
    if parser == "pytest.v1":
        passed = sum(int(x) for x in re.findall(r"(\d+)\s+passed", text))
        failed = sum(int(x) for x in re.findall(r"(\d+)\s+failed", text))
        tests = [{"name": m.group(1), "status": "fail" if "F" in m.group(2) else "ok",
                  "file": None, "line": None}
                 for m in re.finditer(r"^(\S+::\S+)\s+(PASSED|FAILED)", text, re.M)]
        if passed or failed or tests:
            return passed + failed, tests
        return 0, tests
    return None, []  # unknown parser — no count signal


def main(argv):
    if len(argv) != 3:
        sys.stderr.write("usage: collect-ac-evidence.py <plan.md> <AC-id>\n")
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
    block = ac_block(text, key)
    if block is None:
        sys.stderr.write(f"AC not found: {key}\n")
        return 1
    cmd = field(block, "verify")
    if cmd is None or cmd in FORGEABLE:
        sys.stderr.write(f"{key}: no/forgeable verify: ({cmd!r})\n")
        return 1

    exit_code_only = (field(block, "exit_code_only") or "").lower() == "true"
    em_raw = field(block, "expected_match") or ""
    mc = re.search(r"min_count:\s*(\d+)", em_raw)
    min_count = int(mc.group(1)) if mc else 1
    parser, parser_known = infer_parser(cmd, field(block, "parser"))

    milestone = os.path.join(os.path.dirname(plan) or ".", "milestones")
    ev_dir = os.path.join(milestone, "evidence")
    os.makedirs(ev_dir, exist_ok=True)
    raw_path = os.path.join(ev_dir, f"{key}.rawout.txt")

    started_at = subprocess.run(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"],
                                capture_output=True, text=True).stdout.strip()
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    raw = (r.stdout or "") + (r.stderr or "")
    open(raw_path, "w", encoding="utf-8").write(raw)
    matched_count, matched_tests = parse_output(parser, raw)
    zero_match = (matched_count == 0) if matched_count is not None else None

    evidence = {
        "ac_id": key, "command": cmd, "parser": parser, "parser_known": parser_known,
        "exit_code": r.returncode, "cwd": os.getcwd(), "started_at": started_at,
        "expected_match": {"min_count": min_count},
        "matched_count": matched_count, "matched_tests": matched_tests,
        "zero_match": zero_match,
        "raw_output_path": os.path.relpath(raw_path),
        "verdict": None,
    }
    open(os.path.join(ev_dir, f"{key}.json"), "w", encoding="utf-8").write(
        json.dumps(evidence, indent=2))
    print(json.dumps(evidence, indent=2))

    # Vacuity policy (the F1 close) — collector decides ONLY vacuity, never AC pass/fail.
    if exit_code_only:
        return 0 if r.returncode == 0 else 1            # opt-out: exit code is the signal
    if matched_count is None:                            # unknown parser, no count signal
        if r.returncode == 0:
            sys.stderr.write(f"{key}: collector-integrity-failure — unknown parser "
                             f"'{parser}', no match-count, exit 0 (cannot prove non-vacuous; "
                             f"declare exit_code_only: true if intended)\n")
            return 1
        return 1                                          # command failed
    if matched_count < min_count:
        sys.stderr.write(f"{key}: collector-integrity-failure — evidence vacuous "
                         f"(matched_count={matched_count} < min_count={min_count})\n")
        return 1
    return 0 if r.returncode == 0 else 1


sys.exit(main(sys.argv))
