#!/usr/bin/env python3
"""unguarded-rules.py — which of a checker's messages can be deleted with its suite still green.

Usage: python3 plugins/ae/tests/scripts/unguarded-rules.py <checker.py> <suite.sh>
Exit 0 = every message site is guarded. Exit 1 = at least one is not, listed on stdout.

It neuters one message-emitting statement at a time — every `problems.append(...)` and every
`print(...)` — and runs the suite against the result. A site the suite still passes over is a
rule nothing on disk keeps red: it may have been watched failing by hand when it was written,
and nothing will notice when the next edit breaks it.

**It never writes the file it is testing.** The mutants go to a copy under a temporary directory
and the suite is pointed at that copy through `CHECK_UNDER_TEST`. Writing the real file made
every concurrent reader of the tree wrong for the length of a run — a suite run, another sweep,
someone checking a claim — which is not a crash-safety problem but a concurrency one, and the
tree is shared.

**It refuses to run unless the suite passes on the unmutated copy first.** Against a checker
that is already broken — three sites left neutered by an interrupted run, say — every mutation
fails because the baseline already fails, so nothing reads as unguarded and the report is
`0 unguarded`: a clean bill of health at exactly the moment the checker is not clean. Measured,
not reasoned: suite 59 passed 6 failed, tool 34 sites 0 unguarded, exit 0. A green baseline is
the only thing that makes a red mutant mean anything.

**Why this is mechanical rather than a list.** The list was the defect. Three passes running, a
sweep enumerated from what the author had been working on came back complete and a reader found
survivors in it — the same blind spot each time, because recall is what produced both the code
and the list of what to check about it. Reading the sites out of the file cannot miss a site the
file has.

What it does not decide: whether an unguarded rule is worth guarding. Some are not — a message
in a branch the suite has no reason to reach may be dead code to delete rather than a fixture to
write. It says which ones nothing is watching; what to do about each is a judgement.
"""

import ast
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile


def message_sites(tree):
    """Every statement whose whole job is to emit one message, outermost first."""
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)):
            continue
        func = node.value.func
        name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", None)
        if name in ("append", "print"):
            yield node.lineno, node.end_lineno


def neutered(lines, start, end):
    """The file with one statement replaced by `pass`, its line count unchanged.

    `pass` rather than a comment because a statement that is the only one in its block leaves an
    empty block behind, and the SyntaxError that follows fails the suite — which reads as the
    rule being guarded. That false negative hid the one rule this tool was written to find.
    """
    out = list(lines)
    first = lines[start - 1]
    out[start - 1] = first[:len(first) - len(first.lstrip())] + "pass\n"
    for index in range(start, end):
        out[index] = "#" + out[index]
    return out


def main(argv):
    if len(argv) != 3:
        print(f"usage: {argv[0]} <checker.py> <suite.sh>", file=sys.stderr)
        return 2

    checker, suite = pathlib.Path(argv[1]).resolve(), pathlib.Path(argv[2]).resolve()
    original = checker.read_text()
    lines = original.splitlines(keepends=True)
    sites = sorted(set(message_sites(ast.parse(original))))

    with tempfile.TemporaryDirectory() as workspace:
        copy = pathlib.Path(workspace) / checker.name
        shutil.copy(checker, copy)
        environment = {**os.environ, "CHECK_UNDER_TEST": str(copy)}

        def suite_passes():
            return subprocess.run([str(suite)], capture_output=True, text=True,
                                  env=environment).returncode == 0

        if not suite_passes():
            print(f"{suite} does not pass against {checker} unmutated, so a mutant failing it "
                  f"would say nothing. Fix that first — and check whether the file is one an "
                  f"interrupted run left part-neutered, which is the shape that makes this tool "
                  f"report every rule guarded.", file=sys.stderr)
            return 2

        unguarded = []
        for start, end in sites:
            copy.write_text("".join(neutered(lines, start, end)))
            if suite_passes():
                unguarded.append((start, lines[start - 1].strip()))
            copy.write_text(original)

    for start, text in unguarded:
        print(f"{checker}:{start}: nothing in {suite.name} fails when this is deleted — {text}")
    print(f"\n{len(sites)} message sites, {len(unguarded)} unguarded")
    return 1 if unguarded else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
