#!/bin/sh
# Mutation check — plant a defect, confirm the suite turns red, revert.
#
# A suite that stays green under a planted defect is not testing what it claims.
# This run already earned its keep: it found that removing the empty-schema guard
# left everything green, because the guard was unreachable — any `{}` has no type,
# so the type check caught it first. An unreachable second layer is not defence in
# depth, it is a claim of protection no test can hold to account. The guard was
# removed rather than given a test.
#
# Run: sh plugins/ae/v1/test/mutation-check.sh
# Not part of the standard suite: it edits sources in place, so it is run
# deliberately rather than on every commit.
set -e
V1=$(cd "$(dirname "$0")/.." && pwd)
run() { node "$V1/test/all.mjs" >/dev/null 2>&1 && echo GREEN || echo RED; }

# An interrupted run used to leave a planted defect in the working tree — piping
# this script's output into `head` is enough to do it, since the write that gets
# SIGPIPE dies before its revert. Every plant registers itself here, and the trap
# puts back whatever is still out.
PLANTED=""
restore_all() {
  for f in $PLANTED; do
    [ -f "${TMPDIR:-/tmp}/$f.mut.bak" ] && cp "${TMPDIR:-/tmp}/$f.mut.bak" "$V1/lib/$f"
  done
  PLANTED=""
}
trap 'restore_all' EXIT INT TERM PIPE

plant() { # file, from, to
  cp "$V1/lib/$1" "${TMPDIR:-/tmp}/$1.mut.bak"
  PLANTED="$PLANTED $1"
  python3 - "$V1/lib/$1" "$2" "$3" <<'PY'
import io,sys
p,a,b=sys.argv[1],sys.argv[2],sys.argv[3]
s=io.open(p,encoding='utf-8').read()
assert a in s, f"pattern not found: {a[:50]}"
io.open(p,'w',encoding='utf-8').write(s.replace(a,b,1))
PY
}
revert() { cp "${TMPDIR:-/tmp}/$1.mut.bak" "$V1/lib/$1"; PLANTED=""; }

echo "baseline                                $(run)"

plant gate.mjs "if (outcomes.size > 1) {" "if (false) {"
printf "contradiction no longer fails closed   %s\n" "$(run)"; revert gate.mjs

plant gate.mjs "const latest = attempts[attempts.length - 1];" "const latest = attempts[0];"
printf "earliest attempt decides instead       %s\n" "$(run)"; revert gate.mjs

plant gate.mjs "if (record.contract_revision !== ctx.currentRevision) {" "if (false) {"
printf "superseded revision not stale          %s\n" "$(run)"; revert gate.mjs

plant identity.mjs "if (actual.byte_sha256 !== recorded.byte_sha256) {" "if (false) {"
printf "lexical mutation undetected            %s\n" "$(run)"; revert identity.mjs

plant kernel.mjs "if (Object.prototype.hasOwnProperty.call(payload, 'origin')) {" "if (false) {"
printf "caller-written origin accepted          %s\n" "$(run)"; revert kernel.mjs

plant writer.mjs "assertNoSymlinkComponents(resolve(root), target);" ""
printf "symlink parent unchecked               %s\n" "$(run)"; revert writer.mjs

plant schema.mjs "if (!schema.type || !TYPES.includes(schema.type)) {" "if (false) {"
printf "untyped schema accepted as closed      %s\n" "$(run)"; revert schema.mjs

plant schema.mjs "if (schema.additional !== false) {" "if (false) {"
printf "object admitting extras called closed  %s\n" "$(run)"; revert schema.mjs

plant admissibility.mjs "if (result.origin !== 'harness') return 'result_self_authored';" ""
printf "submission-authored result accepted    %s\n" "$(run)"; revert admissibility.mjs

plant family.mjs "fail('observed_without_answer'" "return true; fail('observed_without_answer'"
printf "observed present with no answer        %s\n" "$(run)"; revert family.mjs

# The four below stand for the defects the second implementation review found: a
# verdict asserted rather than computed, an Assignment the holder supplied for
# itself, a completion write over verdicts the caller named, and a pass over a
# run that exercised nothing.
plant gate.mjs "const outcome = ctx.outcomeOf(record, ctx);" \
  "const outcome = record.satisfied !== undefined ? record.satisfied : ctx.outcomeOf(record, ctx);"
printf "a submitted verdict is believed         %s\n" "$(run)"; revert gate.mjs

plant kernel.mjs "const issued = this.records().find(" \
  "const issued = { grants: { attempt_producer: producer } } || this.records().find("
printf "self-selected grants accepted           %s\n" "$(run)"; revert kernel.mjs

plant writer.mjs "const forRun = recordedVerdicts.filter(" \
  "const forRun = recordedVerdicts.concat(obligations.map((o) => ({ obligation: o, status: 'passed', run, contract_revision: revision }))).filter("
printf "completion over invented verdicts       %s\n" "$(run)"; revert writer.mjs

plant admissibility.mjs "if (!(result.subjects > 0)) return 'vacuous_observation';" ""
printf "a run that exercised nothing passes     %s\n" "$(run)"; revert admissibility.mjs

# The round-3 findings: state the party being judged used to supply.
plant gate.mjs "(r) => r.kind === 'attempt_opened' && r.lineage === lineage && r.run === run," \
  "(r) => r.kind === 'attempt_opened' && r.lineage === lineage,"
printf "another run's attempt decides this one  %s\n" "$(run)"; revert gate.mjs

plant gate.mjs "  if (record.kind === 'capability_unavailable') {
    return { status: STATUS.UNAVAILABLE, code: null, record };
  }" "  if (record.kind === 'capability_unavailable') {
    return { status: STATUS.UNAVAILABLE, code: null, record };
  }
  return { status: STATUS.UNAVAILABLE, code: null, record };"
printf "unavailable arm skips admissibility     %s\n" "$(run)"; revert gate.mjs

plant admissibility.mjs "  if (path.startsWith('/')) return false;" ""
printf "an absolute path is inside the boundary %s\n" "$(run)"; revert admissibility.mjs

plant admissibility.mjs "      if (parts.length === 0) return false;" ""
printf "traversal above the root cancels out    %s\n" "$(run)"; revert admissibility.mjs

plant kernel.mjs "    const formation = formationProblems(contract);" "    const formation = [];"
printf "a Contract tracing to nothing approved  %s\n" "$(run)"; revert kernel.mjs

plant kernel.mjs "    if (named.size !== 1) {" "if (false) { named.add('art1');"
printf "a deliverable nothing evidenced         %s\n" "$(run)"; revert kernel.mjs

# Not a defect in a branch — a staging call introduced onto the write path, which
# is what AC-11's no-staging property is actually about.
plant writer.mjs "const result = atomicFileNoReplace({ path: target, bytes });" \
  "renameSync(target + '.staged', target); const result = atomicFileNoReplace({ path: target, bytes });"
printf "completion staged then moved            %s\n" "$(run)"; revert writer.mjs

echo "after revert                            $(run)"
