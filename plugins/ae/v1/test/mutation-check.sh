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

# The whole tree is snapshotted before anything is planted, and put back at the
# end whatever happened in between.
#
# Two earlier versions tracked which files were currently planted and restored
# those. Both leaked: bookkeeping that a failed plant, a signal, or one revert
# clearing another's record can get wrong is bookkeeping that will get it wrong,
# and the symptom is a planted defect left in the working tree — or worse, a
# source file quietly reverted to a copy predating real edits. Both happened.
#
# Restoring everything unconditionally cannot be got wrong, and the verification
# at the end says so out loud rather than leaving it to be discovered.
RUNDIR=$(mktemp -d "${TMPDIR:-/tmp}/ae-mutation.XXXXXX")
SNAP="$RUNDIR/snapshot"
mkdir -p "$SNAP"
cp -R "$V1/lib" "$SNAP/lib"
cp -R "$V1/schema" "$SNAP/schema"

restore_all() {
  [ -d "$SNAP/lib" ] || return 0
  cp -R "$SNAP/lib/." "$V1/lib/"
  cp -R "$SNAP/schema/." "$V1/schema/"
}
cleanup() { restore_all; rm -rf "$RUNDIR"; }
trap 'cleanup' EXIT INT TERM PIPE

plant() { # file, from, to
  python3 - "$V1/lib/$1" "$2" "$3" <<'PY'
import io,sys
p,a,b=sys.argv[1],sys.argv[2],sys.argv[3]
s=io.open(p,encoding='utf-8').read()
assert a in s, f"pattern not found: {a[:50]}"
io.open(p,'w',encoding='utf-8').write(s.replace(a,b,1))
PY
}
revert() { cp "$SNAP/lib/$1" "$V1/lib/$1"; }

echo "baseline                                $(run)"

plant gate.mjs "if (outcomes.size > 1) {" "if (false) {"
printf "contradiction no longer fails closed   %s\n" "$(run)"; revert gate.mjs

plant gate.mjs "const latest = attempts[attempts.length - 1];" "const latest = attempts[0];"
printf "earliest attempt decides instead       %s\n" "$(run)"; revert gate.mjs

plant gate.mjs "if (record.contract_revision !== ctx.currentRevision) {" "if (false) {"
printf "superseded revision not stale          %s\n" "$(run)"; revert gate.mjs

plant identity.mjs "if (actual.byte_sha256 !== recorded.byte_sha256) {" "if (false) {"
printf "lexical mutation undetected            %s\n" "$(run)"; revert identity.mjs

plant kernel.mjs "  recordUnavailable({ lineage, run, obligation, attempt, requested }) {" \
  "  recordUnavailable({ lineage, run, obligation, attempt, requested, origin }) {"
printf "a public operation takes an origin      %s\n" "$(run)"; revert kernel.mjs

plant kernel.mjs "    assertNoSymlinkComponents(resolve(this.#completionRoot), resolve(path));" ""
printf "symlink parent unchecked               %s\n" "$(run)"; revert kernel.mjs

plant schema.mjs "if (!schema.type || !TYPES.includes(schema.type)) {" "if (false) {"
printf "untyped schema accepted as closed      %s\n" "$(run)"; revert schema.mjs

plant schema.mjs "if (schema.additional !== false) {" "if (false) {"
printf "object admitting extras called closed  %s\n" "$(run)"; revert schema.mjs

plant admissibility.mjs "if (result.origin !== 'harness') return 'result_self_authored';" ""
printf "submission-authored result accepted    %s\n" "$(run)"; revert admissibility.mjs

plant ../schema/records.mjs "      requested: { type: 'array', minItems: 1, items: id },
      // Present only when a seat actually answered." \
  "      requested: { type: 'array', minItems: 1, items: id },
      observed: id,
      // Present only when a seat actually answered."
printf "observed given a position in the record %s\n" "$(run)"; revert ../schema/records.mjs

# The four below stand for the defects the second implementation review found: a
# verdict asserted rather than computed, an Assignment the holder supplied for
# itself, a completion write over verdicts the caller named, and a pass over a
# run that exercised nothing.
plant gate.mjs "const outcome = ctx.outcomeOf(record, ctx);" \
  "const outcome = record.satisfied !== undefined ? record.satisfied : ctx.outcomeOf(record, ctx);"
printf "a submitted verdict is believed         %s\n" "$(run)"; revert gate.mjs

plant kernel.mjs "    if (!assignment) {
      fail('assignment_not_issued', 'no Assignment was issued for this run', { lineage, run });
    }
    if (assignment.grants.attempt_producer !== producer) {" \
  "    const assignment2 = assignment || { grants: { attempt_producer: producer, obligations } };
    if (assignment2.grants.attempt_producer !== producer) {"
printf "self-selected grants accepted           %s\n" "$(run)"; revert kernel.mjs


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

plant kernel.mjs "      decision: { outcome: 'accepted', origin: HOST, run, seq: signoff.seq }," \
  "      decision: { outcome: 'accepted', origin: HOST, run, seq: signoff.seq, why: 'because' },"
printf "an Acceptance carrying an extra field   %s\n" "$(run)"; revert kernel.mjs

# Round 4's findings.
plant kernel.mjs "      path, identity, origin: HARNESS," "      path, identity, origin: 'submission',"
printf "the artifact recorded by a submission   %s\n" "$(run)"; revert kernel.mjs

plant kernel.mjs "    const stale = checkVerifiableSources(" \
  "    const stale = []; const unusedStale = checkVerifiableSources("
printf "a citation to changed content accepted  %s\n" "$(run)"; revert kernel.mjs

plant kernel.mjs "    if (pkg.lineage !== lineage) {" "    if (false) {"
printf "a package from another lineage filed    %s\n" "$(run)"; revert kernel.mjs

# Round 5's findings.
plant admissibility.mjs "    if (result.artifact !== record.artifact) return 'binding_cross_execution';" ""
printf "a green run vouches for any artifact    %s\n" "$(run)"; revert admissibility.mjs

plant formation.mjs "    if (!text.includes(entry.quote)) {" "    if (false) {"
printf "a citation to a passage nobody wrote    %s\n" "$(run)"; revert formation.mjs

plant kernel.mjs "    if (!this.#render) {" "    if (false) { this.__r = 1;"
printf "an unrenderable Contract approved       %s\n" "$(run)"; revert kernel.mjs

plant kernel.mjs "    return parseNdjson(bytes).map((r, seq) => ({ ...r, seq }));" \
  "    return parseNdjson(bytes).map((r) => ({ ...r, seq: 0 }));"
printf "every record claims the same position   %s\n" "$(run)"; revert kernel.mjs

plant kernel.mjs "    const deliverable = this.deliverableFor({ lineage, run, contract: approved.contract });" \
  "    const deliverable = { identity: 'sha256:' + '0'.repeat(64) };"
printf "a sign-off names any deliverable        %s\n" "$(run)"; revert kernel.mjs

plant codes.mjs "  if (!KNOWN.has(code)) {" "  if (false) {"
printf "a refusal with an unknown code          %s\n" "$(run)"; revert codes.mjs

# Round 10's findings: what a run is run against, and what it reads.
plant kernel.mjs "    const command = entry.observation;
    const inputsUsed = entry.material_inputs;" \
  "    const command = entry.observation;
    const inputsUsed = [];"
printf "a run that declares it read nothing     %s\n" "$(run)"; revert kernel.mjs

plant kernel.mjs "    const path = \`\${this.#sourceRoot}/\${entry.artifact}\`;" \
  "    const path = \`\${this.#sourceRoot}/work/decoy-artifact.txt\`;"
printf "the artifact is not the one named       %s\n" "$(run)"; revert kernel.mjs

plant admissibility.mjs "      if (!recorded.has(used)) return 'material_input_incomplete';" ""
printf "a package that omits a stated input     %s\n" "$(run)"; revert admissibility.mjs

# Round 9's findings.
plant kernel.mjs "        if (r.attempt !== latest) continue;" ""
printf "a superseded attempt still decides      %s\n" "$(run)"; revert kernel.mjs

plant admissibility.mjs "      if (now.path !== input.path) return 'material_input_incomplete';" ""
printf "a decoy is observed under an input's id %s\n" "$(run)"; revert admissibility.mjs

plant kernel.mjs "    if (contract.independence.required === 'cross_family_required') {" "    if (false) {"
printf "a cross-family Contract completes       %s\n" "$(run)"; revert kernel.mjs

plant kernel.mjs "    if (actor !== this.#owner) {" "    if (false) {"
printf "anyone acts as the Human Owner          %s\n" "$(run)"; revert kernel.mjs

plant kernel.mjs "    if (contract.final_signer !== this.#owner) {" "    if (false) {"
printf "a Contract nominates its own signer     %s\n" "$(run)"; revert kernel.mjs

# Round 8's findings.
plant kernel.mjs "      this.path = realpathSync(path);" "      this.path = path;"
printf "an aliased log takes its own lock       %s\n" "$(run)"; revert kernel.mjs

plant admissibility.mjs "      if (!(now.seq > pkg.seq)) return 'material_input_incomplete';" ""
printf "an input observed before the evidence   %s\n" "$(run)"; revert admissibility.mjs

# Round 7's findings: facts the Harness must produce rather than accept.
plant kernel.mjs "      exit = typeof error.status === 'number' ? error.status : 1;" "      exit = 0;"
printf "a failing command reports success       %s\n" "$(run)"; revert kernel.mjs

plant kernel.mjs "    let identity;
    try {
      identity = digestBytes(readFileSync(path));
    } catch {
      fail('binding_unresolved'" \
  "    let identity = digestBytes(Buffer.from('a constant'));
    try {
      if (false) identity = digestBytes(readFileSync(path));
    } catch {
      fail('binding_unresolved'"
printf "the artifact is not actually digested   %s\n" "$(run)"; revert kernel.mjs

plant kernel.mjs "    for (let i = 1; i < prior.length; i += 1) {" "    for (let i = 1; i < 0; i += 1) {"
printf "a forked approval history reads clean   %s\n" "$(run)"; revert kernel.mjs

# Round 6's findings.
plant kernel.mjs "    if (!reported) {" "    if (false) {"
printf "a sign-off before the Gate reported     %s\n" "$(run)"; revert kernel.mjs

plant kernel.mjs "    if (issued.length > 1) {" "    if (false) {"
printf "a run with two Assignments proceeds     %s\n" "$(run)"; revert kernel.mjs

# Not planted: the write's re-reduction. `verdictsNow` is exercised directly, but
# its call site inside `complete` only matters when another process advances the
# log between the reduction and the write, and there is no seam to schedule
# against. A mutation that cannot turn red would say the guard is covered.

# AC-13: a log that replays into a different verdict cannot account for its own
# Acceptance. The fresh-process check is what catches this; nothing in-process can.
plant admissibility.mjs "    if (record.run !== run) return 'binding_cross_execution';" ""
printf "a submission from another run admitted  %s\n" "$(run)"; revert admissibility.mjs

plant kernel.mjs "    if (!unavailable) {" "    if (false) {"
printf "a pre-authorized choice accepted        %s\n" "$(run)"; revert kernel.mjs

plant kernel.mjs "      ([k, v]) => r[k] === undefined || r[k] === v," "      ([k, v]) => r[k] === v,"
printf "replay cannot say which Contract ran    %s\n" "$(run)"; revert kernel.mjs

# Not a defect in a branch — a staging call introduced onto the write path, which
# is what AC-11's no-staging property is actually about.
plant kernel.mjs "    const result = atomicFileNoReplace({ path: target, bytes });" \
  "    renameSync(target + '.staged', target); const result = atomicFileNoReplace({ path: target, bytes });"
printf "completion staged then moved            %s\n" "$(run)"; revert kernel.mjs

echo "after revert                            $(run)"

# Said out loud, because a leak here is silent by nature: the suite goes green
# again either way, and the defect travels in the working tree.
restore_all
if diff -r "$SNAP/lib" "$V1/lib" >/dev/null 2>&1 \
  && diff -r "$SNAP/schema" "$V1/schema" >/dev/null 2>&1; then
  echo "sources restored                        VERIFIED"
else
  echo "sources restored                        FAILED — the tree still differs"
  exit 1
fi
