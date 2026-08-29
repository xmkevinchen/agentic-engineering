#!/bin/sh
# resolve-attempt.sh — the closed resolver every frozen verifier goes through.
#
# The frozen AC verify commands name a stable package directory, never an attempt number. That
# is deliberate: an AC whose command has to be edited to point at `A-004` is an AC that can be
# pointed at whichever attempt looks best. So the attempt is RESOLVED from the append-only
# artifacts, under rules that make "which one counts" a fact rather than a choice.
#
#   pending  (default) — exactly one append-only, unreviewed verification-subject.json exists.
#                        This is what a reviewer runs BEFORE choosing a verdict; it is why
#                        `review_pending` can never read as accepted.
#   accepted           — the no-clobber accepted-attempt.json exists, its review says accepted,
#                        it names that attempt's own subject, and no pending subject remains.
#
# The failures it must produce are the ways a chain could be made to look finished: no subject,
# more than one, a pointer with no review behind it, a pointer to a non-accepted review, a
# pointer naming a different attempt than the subject it binds, a pointer sitting next to a
# still-pending subject, and — the quiet one — resolving to a reviewed `changes_required`
# attempt when a later append-only attempt exists to supersede it.
#
# Usage: sh resolve-attempt.sh <package-dir> [--mode pending|accepted]
# Prints the resolved attempt directory on stdout.
# Exit 0 = resolved. 1 = the chain does not resolve. 2 = usage or unreadable input.

set -eu

mode=pending
package=""
while [ "$#" -gt 0 ]; do
  case $1 in
    --mode) [ "$#" -ge 2 ] || { echo "resolve-attempt: --mode needs a value" >&2; exit 2; }
            mode=$2; shift 2 ;;
    -*)     echo "resolve-attempt: unknown option: $1" >&2; exit 2 ;;
    *)      [ -z "$package" ] || { echo "resolve-attempt: one package directory only" >&2; exit 2; }
            package=$1; shift ;;
  esac
done

[ -n "$package" ] || { echo "usage: sh resolve-attempt.sh <package-dir> [--mode pending|accepted]" >&2; exit 2; }
[ -d "$package" ] || { echo "resolve-attempt: not a directory: $package" >&2; exit 2; }
case $mode in pending|accepted) ;; *) echo "resolve-attempt: unknown mode: $mode" >&2; exit 2 ;; esac
command -v python3 >/dev/null 2>&1 || { echo "resolve-attempt: python3 is required" >&2; exit 2; }

exec python3 - "$package" "$mode" <<'PY'
import json, os, re, sys

package, mode = os.path.abspath(sys.argv[1]), sys.argv[2]
problems = []


def die():
    for problem in problems:
        sys.stderr.write(f"resolve-attempt: {problem}\n")
    raise SystemExit(1)


def load(path):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError) as exc:
        problems.append(f"unreadable artifact {os.path.relpath(path, package)}: {exc}")
        return None


# Reviews live beside the handoffs tree, not inside the package, so a reviewer's verdict is not
# something an attempt can write next to its own result.
reviews_dir = os.path.join(os.path.dirname(os.path.dirname(package)), "reviews")
work_package = os.path.basename(package)

attempts = sorted(d for d in os.listdir(package) if re.fullmatch(r"A-\d{3}", d)
                  and os.path.isdir(os.path.join(package, d)))
if not attempts:
    problems.append(f"no A-NNN attempt directory under {package}")
    die()


def verdict_of(attempt):
    """The verdict recorded for one attempt, or None when no review exists."""
    path = os.path.join(reviews_dir, f"{work_package}-{attempt}-codex-review.md")
    if not os.path.isfile(path):
        return None
    found = None
    for line in open(path, encoding="utf-8", errors="replace").read().split("\n"):
        match = re.fullmatch(r"verdict:\s*(\S+)", line.strip())
        if match:
            if found is not None:
                problems.append(f"{attempt}: its review declares more than one verdict")
                return "ambiguous"
            found = match.group(1)
    if found is None:
        problems.append(f"{attempt}: a review file exists with no verdict line")
        return "ambiguous"
    if found not in ("accepted", "changes_required", "blocked"):
        problems.append(f"{attempt}: review verdict {found!r} is not one of "
                        f"accepted|changes_required|blocked")
        return "ambiguous"
    return found


subjects, verdicts = {}, {}
for attempt in attempts:
    subject_path = os.path.join(package, attempt, "verification-subject.json")
    if os.path.isfile(subject_path):
        subjects[attempt] = subject_path
    verdicts[attempt] = verdict_of(attempt)

pointer_path = os.path.join(package, "accepted-attempt.json")
pointer = load(pointer_path) if os.path.isfile(pointer_path) else None
if problems:
    die()

unreviewed = [a for a in attempts if a in subjects and verdicts[a] is None]

if mode == "pending":
    if pointer is not None:
        problems.append("this package already carries accepted-attempt.json; a pending subject "
                        "after acceptance is not resolvable — use --mode accepted")
    if not unreviewed:
        reviewed = [f"{a}:{verdicts[a]}" for a in attempts if a in subjects]
        problems.append("no unreviewed verification-subject.json"
                        + (f" (subjects present: {', '.join(reviewed)})" if reviewed else ""))
    elif len(unreviewed) > 1:
        problems.append(f"{len(unreviewed)} unreviewed verification subjects "
                        f"({', '.join(unreviewed)}); exactly one may be pending")
    if problems:
        die()
    resolved = unreviewed[0]
    # A superseded attempt must not be resolvable while a later one is open. Append-only means
    # the newest attempt is the live one, not the most convenient one.
    superseded = [a for a in attempts if a > resolved and a in subjects]
    if superseded:
        problems.append(f"{resolved} is pending but later attempt(s) {', '.join(superseded)} "
                        f"also carry subjects; the chain is not append-only")
        die()
    print(os.path.join(package, resolved))
    raise SystemExit(0)

# --- accepted -------------------------------------------------------------------------------
if pointer is None:
    problems.append("no accepted-attempt.json; nothing has been accepted for this package")
    die()

attempt = pointer.get("attempt_id")
if attempt not in attempts:
    problems.append(f"pointer names attempt {attempt!r}, which has no directory in this package")
    die()
if pointer.get("state") != "accepted":
    problems.append(f"pointer state is {pointer.get('state')!r}, not 'accepted'")
if pointer.get("artifact_kind") != "bootstrap_accepted_attempt":
    problems.append(f"pointer artifact_kind is {pointer.get('artifact_kind')!r}; a template or "
                    f"other kind is not an accepted pointer")
if pointer.get("work_package") != work_package:
    problems.append(f"pointer work_package {pointer.get('work_package')!r} is not {work_package}")

verdict = verdicts.get(attempt)
if verdict is None:
    problems.append(f"pointer names {attempt} but no review exists for it — a pointer created "
                    f"before its review is not evidence of acceptance")
elif verdict != "accepted":
    problems.append(f"pointer names {attempt} whose review verdict is {verdict!r}")

subject_ref = (pointer.get("verification_subject") or {}).get("path", "")
if not subject_ref.endswith(f"{attempt}/verification-subject.json"):
    problems.append(f"pointer binds {subject_ref!r}, which is not {attempt}'s own subject")
if attempt not in subjects:
    problems.append(f"{attempt} has no verification-subject.json to bind")

still_pending = [a for a in unreviewed]
if still_pending:
    problems.append(f"subject(s) {', '.join(still_pending)} are still unreviewed while a pointer "
                    f"exists; every subject must be reviewed before acceptance resolves")

if problems:
    die()
print(os.path.join(package, attempt))
PY
