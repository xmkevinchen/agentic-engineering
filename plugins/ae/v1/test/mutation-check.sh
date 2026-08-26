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
# Not part of the standard suite: it is slow, and it is run deliberately rather
# than on every commit.
set -e
V1=$(cd "$(dirname "$0")/.." && pwd)

# Nothing here touches the repository. The slice is copied into a scratch tree and
# every defect is planted there.
#
# Three earlier versions edited the sources in place and tried to put them back:
# per-file backups keyed by name (which a later run restored from, over real
# edits), then per-run backups (which leaked a planted defect when the bookkeeping
# went wrong), then an unconditional whole-tree restore — which is safe against
# both and still wrong, because it overwrites any edit made while it runs and then
# reports success by comparing against what it just erased.
#
# A copy cannot get any of that wrong. The working tree is never written to, so
# there is nothing to restore and nothing to verify.
RUNDIR=$(mktemp -d "${TMPDIR:-/tmp}/ae-mutation.XXXXXX")
trap 'rm -rf "$RUNDIR"' EXIT INT TERM PIPE
cp -R "$V1" "$RUNDIR/v1"
WORK="$RUNDIR/v1"
# The copy sits in a temporary directory, so the one test that reads the
# repository's own Contract is told where the repository is.
AE_REPO_ROOT=$(cd "$V1/../../.." && pwd)
export AE_REPO_ROOT
run() { node "$WORK/test/all.mjs" >/dev/null 2>&1 && echo GREEN || echo RED; }

plant() { # file, from, to
  python3 - "$WORK/lib/$1" "$2" "$3" <<'PY'
import io,sys
p,a,b=sys.argv[1],sys.argv[2],sys.argv[3]
s=io.open(p,encoding='utf-8').read()
assert a in s, f"pattern not found: {a[:50]}"
io.open(p,'w',encoding='utf-8').write(s.replace(a,b,1))
PY
}
revert() { cp "$V1/lib/$1" "$WORK/lib/$1"; }

# `run` reports; `probe` judges and tallies. Counting inside a command
# substitution loses the count — the increment happens in a subshell — so the
# label and the verdict are printed by the same function that records it.
SURVIVORS=0
probe() { # want, label
  want=$1; shift
  result=$(run)
  [ "$result" = "$want" ] || SURVIVORS=$((SURVIVORS + 1))
  printf '%-38s %s\n' "$*" "$result"
}

probe GREEN baseline

plant gate.mjs "if (outcomes.size > 1) {" "if (false) {"
probe RED "contradiction no longer fails closed"; revert gate.mjs

plant gate.mjs "const latest = attempts[attempts.length - 1];" "const latest = attempts[0];"
probe RED "earliest attempt decides instead"; revert gate.mjs

plant identity.mjs "if (actual.byte_sha256 !== recorded.byte_sha256) {" "if (false) {"
probe RED "lexical mutation undetected"; revert identity.mjs

plant kernel.mjs "  recordUnavailable({ lineage, run, obligation, attempt }) {" \
  "  recordUnavailable({ lineage, run, obligation, attempt, origin }) {"
probe RED "a public operation takes an origin"; revert kernel.mjs

plant kernel.mjs "    assertNoSymlinkComponents(resolve(this.#completionRoot), resolve(path));" ""
probe RED "symlink parent unchecked"; revert kernel.mjs

plant schema.mjs "if (!schema.type || !TYPES.includes(schema.type)) {" "if (false) {"
probe RED "untyped schema accepted as closed"; revert schema.mjs

plant schema.mjs "if (schema.additional !== false) {" "if (false) {"
probe RED "object admitting extras called closed"; revert schema.mjs

plant admissibility.mjs "if (result.origin !== 'harness') return 'result_self_authored';" ""
probe RED "submission-authored result accepted"; revert admissibility.mjs

plant ../schema/records.mjs "      requested: { type: 'array', minItems: 1, items: id },
      // Present only when a seat actually answered." \
  "      requested: { type: 'array', minItems: 1, items: id },
      observed: id,
      // Present only when a seat actually answered."
probe RED "observed given a position in the record"; revert ../schema/records.mjs

# The four below stand for the defects the second implementation review found: a
# verdict asserted rather than computed, an Assignment the holder supplied for
# itself, a completion write over verdicts the caller named, and a pass over a
# run that exercised nothing.
plant gate.mjs "const outcome = ctx.outcomeOf(record, ctx);" \
  "const outcome = record.satisfied !== undefined ? record.satisfied : ctx.outcomeOf(record, ctx);"
probe RED "a submitted verdict is believed"; revert gate.mjs

plant kernel.mjs "    if (!assignment) {
      fail('assignment_not_issued', 'no Assignment was issued for this run', { lineage, run });
    }
    if (assignment.grants.attempt_producer !== producer) {" \
  "    const assignment2 = assignment || { grants: { attempt_producer: producer, obligations } };
    if (assignment2.grants.attempt_producer !== producer) {"
probe RED "self-selected grants accepted"; revert kernel.mjs


plant admissibility.mjs "if (!(result.subjects > 0)) return 'vacuous_observation';" ""
probe RED "a run that exercised nothing passes"; revert admissibility.mjs

# The round-3 findings: state the party being judged used to supply.
plant gate.mjs "(r) => r.kind === 'attempt_opened' && r.lineage === lineage && r.run === run," \
  "(r) => r.kind === 'attempt_opened' && r.lineage === lineage,"
probe RED "another run's attempt decides this one"; revert gate.mjs

plant gate.mjs "  if (record.kind === 'capability_unavailable') {
    return { status: STATUS.UNAVAILABLE, code: null, record };
  }" "  if (record.kind === 'capability_unavailable') {
    return { status: STATUS.UNAVAILABLE, code: null, record };
  }
  return { status: STATUS.UNAVAILABLE, code: null, record };"
probe RED "unavailable arm skips admissibility"; revert gate.mjs

plant admissibility.mjs "  if (path.startsWith('/')) return false;" ""
probe RED "an absolute path is inside the boundary"; revert admissibility.mjs

plant admissibility.mjs "      if (parts.length === 0) return false;" ""
probe RED "traversal above the root cancels out"; revert admissibility.mjs

plant kernel.mjs "    const formation = formationProblems(contract);" "    const formation = [];"
probe RED "a Contract tracing to nothing approved"; revert kernel.mjs

plant kernel.mjs "    if (named.size !== 1) {" "if (false) { named.add('art1');"
probe RED "a deliverable nothing evidenced"; revert kernel.mjs

plant kernel.mjs "      decision: { outcome: 'accepted', origin: HOST, run, seq: signoff.seq }," \
  "      decision: { outcome: 'accepted', origin: HOST, run, seq: signoff.seq, why: 'because' },"
probe RED "an Acceptance carrying an extra field"; revert kernel.mjs

# Round 4's findings.
plant kernel.mjs "      path, identity, origin: HARNESS," "      path, identity, origin: 'submission',"
probe RED "the artifact recorded by a submission"; revert kernel.mjs

plant kernel.mjs "    const stale = checkVerifiableSources(" \
  "    const stale = []; const unusedStale = checkVerifiableSources("
probe RED "a citation to changed content accepted"; revert kernel.mjs

plant kernel.mjs "    if (pkg.lineage !== lineage) {" "    if (false) {"
probe RED "a package from another lineage filed"; revert kernel.mjs

# Round 5's findings.
plant admissibility.mjs "    if (result.artifact !== record.artifact) return 'binding_cross_execution';" ""
probe RED "a green run vouches for any artifact"; revert admissibility.mjs

plant formation.mjs "    if (!text.includes(entry.quote)) {" "    if (false) {"
probe RED "a citation to a passage nobody wrote"; revert formation.mjs

plant kernel.mjs "    if (!this.#render) {" "    if (false) { this.__r = 1;"
probe RED "an unrenderable Contract approved"; revert kernel.mjs

plant kernel.mjs "    return parseNdjson(bytes).map((r, seq) => ({ ...r, seq }));" \
  "    return parseNdjson(bytes).map((r) => ({ ...r, seq: 0 }));"
probe RED "every record claims the same position"; revert kernel.mjs

plant kernel.mjs "    const deliverable = this.deliverableFor({ lineage, run, contract: approved.contract });" \
  "    const deliverable = { identity: 'sha256:' + '0'.repeat(64) };"
probe RED "a sign-off names any deliverable"; revert kernel.mjs

plant codes.mjs "  if (!KNOWN.has(code)) {" "  if (false) {"
probe RED "a refusal with an unknown code"; revert codes.mjs

plant kernel.mjs "          state.unavailableDecision = { choice: r.choice, answers: r.answers };" ""
probe RED "replay forgets what the choice answers"; revert kernel.mjs

plant kernel.mjs "      return result.exit === 0;" \
  "      return process.env.AE_PASS === 'yes' || result.exit === 0;"
probe RED "the verdict consults the environment"; revert kernel.mjs

plant family.mjs "  const requested = requestedFamily(contract);" \
  "  const requested = requestedFamily(contract) || ['openai'];"
probe RED "a dispatch defaults its request"; revert family.mjs

plant kernel.mjs "      const found = records.filter((r) => r.kind === kind && r[field] === value);" \
  "      const found = records.filter((r) => r.kind === kind && r[field] === value).slice(0, 1);"
probe RED "two records under one name"; revert kernel.mjs

plant gate.mjs "  if (ctx.inputsChanged(record, ctx)) {" \
  "  if (record.at > 0 && ctx.inputsChanged(record, ctx)) {"
probe RED "a verdict that reads the clock"; revert gate.mjs

plant admissibility.mjs "  if (dispatch.substituted_family) return 'same_family_substituted';" ""
probe RED "a seat that stood in"; revert admissibility.mjs

plant admissibility.mjs "  if (dispatch.answered_family) return 'same_family_substituted';" ""
probe RED "a seat that replied"; revert admissibility.mjs

plant kernel.mjs "    if (contract.lineage !== lineage) {" "    if (false) {"
probe RED "a Contract naming another lineage"; revert kernel.mjs

plant kernel.mjs "    if (contract.revision !== revision) {" "    if (false) {"
probe RED "a Contract naming another revision"; revert kernel.mjs

plant codes.mjs "  (c) => !BY_CONSTRUCTION[c] && !RESERVED[c]," "  () => true,"
probe RED "a code nothing can raise, raisable"; revert codes.mjs

plant kernel.mjs "    if (opened && !opened.obligations.includes(obligation)) {" "    if (false) {"
probe RED "a surface writing out of scope"; revert kernel.mjs

# Round 19's finding: authority a child record narrowed, regained downstream.
plant admissibility.mjs "  if (!(attempt.obligations || []).includes(record.obligation)) {" \
  "  if (false) {"
probe RED "an attempt answering beyond its scope"; revert admissibility.mjs

plant admissibility.mjs "  if (!(assignment.grants.obligations || []).includes(record.obligation)) {" \
  "  if (false) {"
probe RED "an obligation the Assignment never granted"; revert admissibility.mjs

# Round 18's findings: facts sampled before the event that makes them final.
plant kernel.mjs "        && r.seq > lastAttempt.seq," ""
probe RED "the change ends before a retry"; revert kernel.mjs

plant kernel.mjs "    if (opened.length > 1) {" "    if (false) {"
probe RED "a lineage with two formations"; revert kernel.mjs

plant kernel.mjs "      if (!stat.isSymbolicLink()) break;" "      break;"
probe RED "a dangling link keeps its own name"; revert kernel.mjs

plant admissibility.mjs "    const recorded = new Set((pkg.material_inputs || []).map((i) => i.path));" \
  "    const recorded = new Set(stated);"
probe RED "a package that names no input at all"; revert admissibility.mjs

# Round 16's findings: cost is time, and an operation has its own event.
plant kernel.mjs "      formation_elapsed: approval.at - formationFrom.at," \
  "      formation_elapsed: approval.seq - formationFrom.seq,"
probe RED "cost measured in log traffic"; revert kernel.mjs

plant kernel.mjs "      (r) => r.kind === 'gate_completed' && r.lineage === lineage && r.run === run
        && r.seq > lastAttempt.seq," \
  "      (r) => r.kind === 'gate_result' && r.lineage === lineage && r.run === run
        && r.seq > lastAttempt.seq,"
probe RED "the interval ends at a component"; revert kernel.mjs

plant kernel.mjs "        if (found.length > 1) {
          fail('binding_unresolved', 'two dispatches answer to one attempt and obligation', {" \
  "        if (false) {
          fail('binding_unresolved', 'x', {"
probe RED "two dispatches under one name"; revert kernel.mjs

# Round 15's findings: exact event identity, and one of a thing per run.
plant kernel.mjs "      ? this.records()[entry[1].selected]" \
  "      ? this.records().find((r) => r.kind === 'capability_unavailable' && r.lineage === lineage && r.run === run)"
probe RED "a choice answering a lookalike event"; revert kernel.mjs

plant kernel.mjs "    if (existing.length > 0) {" "    if (false) {"
probe RED "a run records its facts twice"; revert kernel.mjs

# One falsifier per clause. They were a single predicate, so disabling it turned
# red on whichever half a test reached and covered the other by appearance.
plant kernel.mjs "    if (!(approval.seq > formationFrom.seq)) {" "    if (false) {"
probe RED "formation enclosing nothing"; revert kernel.mjs

plant kernel.mjs "    if (!(approval.at >= formationFrom.at)) {" "    if (false) {"
probe RED "formation running backwards on the clock"; revert kernel.mjs

plant kernel.mjs "    if (!(verdict.at >= attempt.at)) {" "    if (false) {"
probe RED "a change running backwards on the clock"; revert kernel.mjs

# Round 13's findings.
plant gate.mjs "  const superseded = boundRevision !== currentRevision;" "  const superseded = false;"
probe RED "a superseded run is not stale"; revert gate.mjs

plant gate.mjs "    superseded && verdict.status !== STATUS.INVALID" "    superseded"
probe RED "stale outranks invalid"; revert gate.mjs

plant kernel.mjs "    if (arithmetic && arithmetic.fired !== (choice === 'yes')) {" "    if (false) {"
probe RED "a decision against the arithmetic"; revert kernel.mjs

plant kernel.mjs "      if (!discrepancy) {" "      if (false) {"
probe RED "caught_something with no discrepancy"; revert kernel.mjs

plant kernel.mjs "      if (!disposition) {" "      if (false) {"
probe RED "caught_something with nothing done"; revert kernel.mjs

plant kernel.mjs "    const requested = requestedFamily(bound.contract);" \
  "    const requested = ['anthropic'];"
probe RED "an unavailability nobody asked about"; revert kernel.mjs

# Round 11's findings.
plant kernel.mjs "    const labels = new Set();" "    const labels = new Set(); if (true) return prior;"
probe RED "a revision label used twice"; revert kernel.mjs

plant kernel.mjs "    this.#recordArtifact({ id: artifact, lineage, run, entry, artifactKind: 'file' });" ""
probe RED "the artifact is never digested"; revert kernel.mjs

plant kernel.mjs "      if (verdicts.get(obligation) !== 'passed') {" "      if (false) {"
probe RED "a failing run is signed for"; revert kernel.mjs

plant kernel.mjs "    const entry = Object.entries(reduced).find(([, v]) => v.status === 'unavailable');" \
  "    const entry = Object.entries(reduced)[0];"
probe RED "a choice about an inadmissible arm"; revert kernel.mjs

# Round 10's findings: what a run is run against, and what it reads.
plant kernel.mjs "    const path = \`\${this.#sourceRoot}/\${entry.artifact}\`;" \
  "    const path = \`\${this.#sourceRoot}/work/decoy-artifact.txt\`;"
probe RED "the artifact is not the one named"; revert kernel.mjs

plant admissibility.mjs "      if (!recorded.has(used)) return 'material_input_incomplete';" ""
probe RED "a package that omits a stated input"; revert admissibility.mjs

# Round 9's findings.
plant kernel.mjs "        if (r.attempt !== latest) continue;" ""
probe RED "a superseded attempt still decides"; revert kernel.mjs

plant kernel.mjs "    if (contract.independence.required === 'cross_family_required') {" "    if (false) {"
probe RED "a cross-family Contract completes"; revert kernel.mjs

plant kernel.mjs "    if (actor !== this.#owner) {" "    if (false) {"
probe RED "anyone acts as the Human Owner"; revert kernel.mjs

plant kernel.mjs "    if (contract.final_signer !== this.#owner) {" "    if (false) {"
probe RED "a Contract nominates its own signer"; revert kernel.mjs

# Round 8's findings.
plant kernel.mjs "    this.path = join(realpathSync(dirname(target)), basename(target));" \
  "    this.path = target;"
probe RED "an aliased log takes its own lock"; revert kernel.mjs

plant admissibility.mjs "      if (!(now.seq > pkg.seq)) return 'material_input_incomplete';" ""
probe RED "an input observed before the evidence"; revert admissibility.mjs

# Round 7's findings: facts the Harness must produce rather than accept.
plant kernel.mjs "      exit = typeof error.status === 'number' ? error.status : 1;" "      exit = 0;"
probe RED "a failing command reports success"; revert kernel.mjs

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
probe RED "the artifact is not actually digested"; revert kernel.mjs

plant kernel.mjs "    for (let i = 1; i < prior.length; i += 1) {" "    for (let i = 1; i < 0; i += 1) {"
probe RED "a forked approval history reads clean"; revert kernel.mjs

# Round 6's findings.
plant kernel.mjs "    if (!reported) {" "    if (false) {"
probe RED "a sign-off before the Gate reported"; revert kernel.mjs

plant kernel.mjs "    if (issued.length > 1) {" "    if (false) {"
probe RED "a run with two Assignments proceeds"; revert kernel.mjs

# AC-13: a log that replays into a different verdict cannot account for its own
# Acceptance. The fresh-process check is what catches this; nothing in-process can.
plant admissibility.mjs "    if (record.run !== run) return 'binding_cross_execution';" ""
probe RED "a submission from another run admitted"; revert admissibility.mjs

plant kernel.mjs "    if (!unavailable) {" "    if (false) {"
probe RED "a pre-authorized choice accepted"; revert kernel.mjs

plant kernel.mjs "      ([k, v]) => r[k] === undefined || r[k] === v," "      ([k, v]) => r[k] === v,"
probe RED "replay cannot say which Contract ran"; revert kernel.mjs

# Not a defect in a branch — a staging call introduced onto the write path, which
# is what AC-11's no-staging property is actually about.
plant kernel.mjs "    const result = atomicFileNoReplace({ path: target, bytes });" \
  "    renameSync(target + '.staged', target); const result = atomicFileNoReplace({ path: target, bytes });"
probe RED "completion staged then moved"; revert kernel.mjs

probe GREEN "after revert"

# A survivor is a failure of this script, not a line in its output. It printed
# GREEN beside one and exited zero either way, so a guard nothing tests could go
# by unremarked in a green build.
if [ "$SURVIVORS" -gt 0 ]; then
  echo ""
  echo "$SURVIVORS planted defect(s) survived — a guard nothing tests"
  exit 1
fi
echo "sources untouched                       BY CONSTRUCTION"
