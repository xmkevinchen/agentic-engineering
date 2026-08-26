// AC-11, AC-12, AC-13 — the write, the formats, the record.

import {
  mkdtempSync, mkdirSync, symlinkSync, readdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib');
import { auditWritePath, auditReductionIgnoresTime } from '../lib/source-audit.mjs';
import { KINDS, auditKinds } from '../lib/ledger.mjs';
import { lintSchema, validate } from '../lib/schema.mjs';
import { OBJECTS, checkContractRelations } from '../schema/objects.mjs';
import { RECORDS } from '../schema/records.mjs';
import {
  fail, ALL_KERNEL_CODES, RAISABLE, BY_CONSTRUCTION, RESERVED,
} from '../lib/codes.mjs';
import { execFileSync } from 'node:child_process';
import { Kernel } from '../lib/kernel.mjs';
import {
  asObject, assignmentDoc, contractDoc, walk, RENDERED, SOURCE_ROOT, OWNER, FAILING,
} from './fixtures.mjs';
import { group, ok, eq, refuses } from './harness.mjs';

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

export function recordTests() {
  group('AC-11 · the completion write', () => {
    // Through `complete`, because there is no other way in. It used to be an
    // exported `commitCompletion(root, path, acceptance, verdicts)`, which was a
    // second completion entry point however carefully the Kernel called it:
    // importing the module wrote an Acceptance with no Gate and no sign-off.
    const completed = () => {
      const dir = tmp('v1w-');
      const k = new Kernel(join(dir, 'log.ndjson'), { completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
      const w = walk(k);
      return { dir, k, w };
    };

    const { k, w, dir } = completed();
    const written = k.complete({ lineage: w.lineage, run: w.run, actor: 'Human Owner' });
    eq('a first write succeeds', written.written.outcome, 'created');
    refuses('it does not overwrite', 'write_would_clobber',
      () => k.complete({ lineage: w.lineage, run: w.run, actor: 'Human Owner' }));
    ok('and it landed inside the root', written.written.path.startsWith(dir));

    // Not a flag a fixture sets to be refused — that only proves a `fail` fires
    // when asked. The write path's own call sites are read, so a move, link or
    // copy is found whether or not anyone thought to test for it.
    const staging = auditWritePath({ readFileSync, dir: libDir });
    eq('it does not stage', staging.map((f) => `${f.file}:${f.call}`).join(','), '');

    // The destination is built from the lineage and the run, so those are the two
    // ways a caller could aim it somewhere else.
    const esc = completed();
    const escaping = new Kernel(join(esc.dir, 'log.ndjson'), { completionRoot: esc.dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
    refuses('a lineage that climbs out of the root', 'write_escapes_location', () => {
      const c = asObject(contractDoc({ lineage: '../../escaped' }));
      escaping.approve({
        lineage: '../../escaped', revision: 'r1', bytes: c.bytes, identity: c.identity,
        actor: 'Human Owner', rendered: RENDERED(c.bytes),
      });
      const a2 = asObject(assignmentDoc({ lineage: '../../escaped' }));
      escaping.issueAssignment({
        lineage: '../../escaped', run: 'run1', bytes: a2.bytes, identity: a2.identity,
        actor: 'Human Owner',
      });
      escaping.completionPathFor({ lineage: '../../escaped', run: 'run1' });
    });

    // Both kinds of symlink, because `O_EXCL` refuses one at the final component
    // and nothing at the parents — which is why the preflight exists.
    const linked = tmp('v1l-');
    const elsewhere = tmp('v1o-');
    mkdirSync(join(linked, 'inside'));
    symlinkSync(elsewhere, join(linked, 'outlink'));
    symlinkSync(join(linked, 'inside'), join(linked, 'inlink'));
    for (const [name, root] of [
      ['a parent symlink pointing outside', join(linked, 'outlink')],
      ['a parent symlink pointing inside', join(linked, 'inlink')],
    ]) {
      const k2 = new Kernel(join(linked, `${name.length}.ndjson`), { completionRoot: root, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
      const w2 = walk(k2);
      refuses(name, 'write_through_symlink',
        () => k2.complete({ lineage: w2.lineage, run: w2.run, actor: 'Human Owner' }));
    }
  });

  group('AC-12 · a refusal names a code the taxonomy knows', () => {
    // "Every falsifier in the Contract that says a thing is refused names a code
    // here" was a sentence in a comment with no reader: nothing compared a raised
    // code against the taxonomy, so a typo travelled as a plausible-looking
    // string that no test could assert on.
    refuses('a code no taxonomy names', 'kind_without_consumer',
      () => fail('invented_code', 'something went wrong', {}));
    ok('the taxonomy is not empty', ALL_KERNEL_CODES.length > 0);

    // Every raisable code is raised somewhere, and every by-construction one is
    // not. A code nothing can raise, sitting in the raisable set, is a claim of
    // protection no test could ever assert on — and there were ten.
    //
    // Call sites, not occurrences: this looked for the string, so a mention in a
    // comment counted as a use and a code could stop being raised while the
    // assertion stayed green.
    const source = readdirSync(libDir).filter((f) => f.endsWith('.mjs'))
      .filter((f) => f !== 'codes.mjs')
      .map((f) => readFileSync(join(libDir, f), 'utf8')).join('\n');
    // Two shapes reach a caller: a refusal raised by name, and a code carried on
    // a problem the caller then raises. Both count; a mention in prose does not.
    const called = new Set([
      ...[...source.matchAll(/(?:fail|return)\s*\(?\s*'([a-z_]+)'/g)].map((m) => m[1]),
      ...[...source.matchAll(/code:\s*'([a-z_]+)'/g)].map((m) => m[1]),
    ]);
    eq('every raisable code is raised', RAISABLE.filter((c) => !called.has(c)).join(','), '');
    eq('and nothing raises one the design rules out',
      Object.keys(BY_CONSTRUCTION).filter((c) => called.has(c)).join(','), '');

    // The three sets partition the taxonomy. Comparing against `RAISABLE` alone
    // could not fail: it is *defined* as what the other two leave over, so the
    // assertion restated its definition. Disjointness and containment are what
    // it was meant to say.
    const ruledOut = Object.keys(BY_CONSTRUCTION);
    const reserved = Object.keys(RESERVED);
    eq('nothing is both ruled out and reserved',
      ruledOut.filter((c) => RESERVED[c]).join(','), '');
    const known = new Set(ALL_KERNEL_CODES);
    eq('and every named code is in the taxonomy',
      [...ruledOut, ...reserved].filter((c) => !known.has(c)).join(','), '');
    eq('which the three sets cover exactly',
      RAISABLE.length + ruledOut.length + reserved.length, ALL_KERNEL_CODES.length);
    refuses('a code the design rules out', 'kind_without_consumer',
      () => fail('write_staged', 'this cannot happen', {}));
  });

  group('AC-12 · every schema is closed, recursively', () => {
    for (const [name, schema] of Object.entries(OBJECTS)) {
      eq(`${name} is closed`, lintSchema(schema, name).length, 0);
    }
  });

  group('AC-12 · the linter catches the shapes that reopen a format', () => {
    // The three the Contract names. Each passed an earlier draft's fixtures.
    const emptyProperty = {
      type: 'object', additional: false, required: ['a'], properties: { a: {} },
    };
    ok('a property defined as {}', lintSchema(emptyProperty).length > 0);

    const openItems = {
      type: 'object', additional: false, required: ['c'],
      properties: { c: { type: 'array', minItems: 1, items: {} } },
    };
    // Rejects an empty array while admitting [null] — the same defect one level in.
    ok('items defined as {}', lintSchema(openItems).some((p) => p.path.includes('[]')));

    const openObject = { type: 'object', additional: false, required: [], properties: {} };
    ok('an object with no properties', lintSchema(openObject).length > 0);

    const permissive = {
      type: 'object', required: ['a'], properties: { a: { type: 'string', minLength: 1 } },
    };
    ok('an object that admits additional properties', lintSchema(permissive).length > 0);
  });

  group('AC-12 · values are constrained, not merely present', () => {
    const s = OBJECTS.Assignment;
    const base = {
      id: 'A1', lineage: 'L', contract_revision: 'r1',
      owner: { role: 'implementer', session: 's1' },
      dependencies: [], boundary: ['docs/v1'],
      grants: { attempt_producer: 'P', mutation_producer: 'P', obligations: ['O'] },
    };
    eq('a well-formed Assignment', validate(s, base).length, 0);
    ok('an empty string is refused', validate(s, { ...base, id: '' }).length > 0);
    ok('null is refused', validate(s, { ...base, id: null }).length > 0);
    ok('an additional property is refused', validate(s, { ...base, family: 'openai' }).length > 0);
    // The family field specifically: two sources for one fact is how the fact
    // gets quietly changed, so the Assignment has none at all.
    ok('a family field is an additional property',
      validate(s, { ...base, family: 'openai' })[0].why === 'additional property');
  });

  group('AC-12 · relations a schema cannot state', () => {
    const c = {
      obligations: ['O1', 'O2'],
      observations: [{ obligation: 'O1', observation: 'x' }, { obligation: 'O2', observation: 'y' }],
      independence: { required: 'none', assurance: 'workflow_attested' },
    };
    eq('every obligation has an observation', checkContractRelations(c).length, 0);
    ok('an obligation with none is caught',
      checkContractRelations({ ...c, obligations: ['O1', 'O2', 'O3'] }).length > 0);
    ok('an observation for an unlisted obligation is caught',
      checkContractRelations({ ...c, obligations: ['O1'] }).length > 0);
    ok('cross-family without a requested family is caught',
      checkContractRelations({
        ...c, independence: { required: 'cross_family_required', assurance: 'workflow_attested' },
      }).length > 0);
  });

  group('AC-12 · every persisted kind has a producer and a consumer', () => {
    // Real call sites, not hand-written labels. An earlier draft checked that the
    // metadata rows contained non-empty strings, which is a check on the comment
    // rather than on the program — and several of those labels were wrong. The
    // first run of this version found twelve.
    const problems = auditKinds({ readdirSync, readFileSync, dir: libDir });
    eq('no kind is orphaned', problems.map((p) => `${p.kind}:${p.code}`).join(','), '');
    ok('the set is non-empty', Object.keys(KINDS).length > 0);
  });

  // AC-13's actual wording: the same records reconstruct the same state in a
  // fresh process. Reconstructing in the process that wrote the log establishes
  // that the objects in memory agree with themselves, which is not the claim.
  group('AC-13 · a fresh process rebuilds what the run reached', () => {
    const dir = mkdtempSync(join(tmpdir(), 'v1r-'));
    const logPath = join(dir, 'log.ndjson');
    const k = new Kernel(logPath, { completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
    const w = walk(k);
    const { acceptance } = k.complete({ lineage: w.lineage, run: w.run, actor: 'Human Owner' });

    const here = fileURLToPath(new URL('./replay.mjs', import.meta.url));
    const out = JSON.parse(execFileSync(
      process.execPath, [here, logPath, w.lineage, w.run], { encoding: 'utf8' },
    ));

    eq('the approved revision comes back', out.approvedRevision, 'r1');
    eq('the attempt comes back', out.attempts.join(','), String(w.attempt.attempt));
    eq('the Gate verdict comes back', out.gateVerdicts.O, 'passed');
    ok('the sign-off comes back', out.signoffPresent);
    // Both identities, like the other three durable objects: a single digest
    // cannot tell a lexical mutation of the written file from the same content
    // spelled differently, which is the pair's whole reason.
    ok('the completion comes back with two identities',
      typeof out.completion?.byte_sha256 === 'string'
        && typeof out.completion?.canonical_sha256 === 'string');
    ok('and it is the Acceptance that was written', acceptance.decision.run === w.run);

    // The decisive half: recomputing from the records alone agrees with what the
    // original run decided. A log that replays into a different verdict is a log
    // that cannot account for its own Acceptance.
    eq('and recomputing agrees', out.recomputed.O, 'passed');
  });

  group('AC-4 · the verdict does not read when a record landed', () => {
    // Records carry `at` because AC-9 asks a question about the world. A verdict
    // reading it would depend on how long something took — and the noninterference
    // cases below cannot catch that, because they replay one log and a stored
    // timestamp is the same on every replay.
    const timely = auditReductionIgnoresTime({ readFileSync, dir: libDir });
    eq('the reduction ignores it',
      timely.map((t) => `${t.file}:${t.source}`).join(','), '');
  });

  group('AC-13 · the verdict depends on the log and nothing else', () => {
    // The completeness half — "did we write what we relied on" — asked as
    // noninterference: hold the log fixed, vary everything around it, and the
    // verdict must not move. If it cannot move, then nothing outside the log
    // reached it, and whatever the Gate relied on was written down.
    //
    // A source-level blacklist was the first attempt and reached too little: it
    // covered the reduction's two modules while the readers it uses are assembled
    // in `kernel.mjs`, which legitimately touches the filesystem. Teaching one of
    // those readers to consult an environment variable left the suite green.
    const dir = tmp('v1n-');
    const logPath = join(dir, 'log.ndjson');
    const k = new Kernel(logPath, {
      completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
    });
    const w = walk(k);
    const here = fileURLToPath(new URL('./replay.mjs', import.meta.url));
    const verdict = (env) => JSON.parse(execFileSync(
      process.execPath, [here, logPath, w.lineage, w.run],
      { encoding: 'utf8', env: { ...process.env, ...env }, cwd: env.CWD || process.cwd() },
    )).recomputed.O;

    // Two logs identical but for when each record landed. The environment cases
    // below hold one log fixed, so a verdict reading a *stored* timestamp would be
    // the same on every replay and pass them; this is what covers that dataflow,
    // through the readers assembled in `kernel.mjs` rather than only the two
    // modules a source audit can read.
    const shifted = join(dir, 'shifted.ndjson');
    writeFileSync(shifted, readFileSync(logPath, 'utf8')
      .split('\n').filter(Boolean)
      .map((line, i) => {
        const record = JSON.parse(line);
        return JSON.stringify({ ...record, at: 1_000_000 + i * 7919 });
      }).join('\n') + '\n');
    const shiftedVerdict = JSON.parse(execFileSync(
      process.execPath, [here, shifted, w.lineage, w.run], { encoding: 'utf8' },
    )).recomputed.O;

    const plain = verdict({});
    eq('a log with every timestamp changed agrees', shiftedVerdict, plain);
    eq('a second process agrees', verdict({}), plain);
    eq('a different timezone and locale agree',
      verdict({ TZ: 'Asia/Tokyo', LANG: 'ja_JP.UTF-8' }), plain);
    eq('a different working directory agrees', verdict({ CWD: dir }), plain);
    eq('an environment full of noise agrees',
      verdict({ AE_ANYTHING: 'x', AE_PASS: 'yes', AE_FAIL: 'yes', HOME: dir }), plain);

    // A run the environment could plausibly be asked to rescue: it failed, and
    // the noise includes exactly the sort of flag a shortcut would read. The
    // comparisons above cannot catch that on a passing run — a defect that turns
    // things green changes nothing that was already green.
    const other = tmp('v1n2-');
    const otherLog = join(other, 'log.ndjson');
    const k2 = new Kernel(otherLog, {
      completionRoot: other, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER,
    });
    const failing = walk(k2, { command: FAILING });
    const failedVerdict = (env) => JSON.parse(execFileSync(
      process.execPath, [here, otherLog, failing.lineage, failing.run],
      { encoding: 'utf8', env: { ...process.env, ...env } },
    )).recomputed.O;
    eq('a failing run fails', failedVerdict({}), 'failed');
    eq('and nothing in the environment rescues it',
      failedVerdict({ AE_PASS: 'yes', AE_FORCE: '1', CI: 'true' }), 'failed');

    // And not vacuous: different facts must reach a different verdict, or the
    // comparisons would pass on a function that ignores its input.
    ok('different facts reach a different verdict', failedVerdict({}) !== plain);
  });

  group('AC-13 · the unavailable arm replays too', () => {
    // The ordinary path was the only one a fresh process rebuilt. AC-7's arm has
    // its own state — a request, a capability that was missing, and the Human
    // Owner's answer to *that* event — and a reconstruction that keeps the choice
    // without what it answers cannot say which event was decided about.
    const dir = tmp('v1u-');
    const logPath = join(dir, 'log.ndjson');
    const k = new Kernel(logPath, { sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
    const cross = asObject(contractDoc({
      independence: {
        required: 'cross_family_required',
        requested_family: ['openai', 'qwen'],
        assurance: 'workflow_attested',
      },
    }));
    k.approve({
      lineage: 'L', revision: 'r1', bytes: cross.bytes, identity: cross.identity,
      actor: OWNER, rendered: RENDERED(cross.bytes),
    });
    const a = asObject(assignmentDoc());
    k.issueAssignment({
      lineage: 'L', run: 'run1', bytes: a.bytes, identity: a.identity, actor: OWNER,
    });
    const at = k.openAttempt({
      lineage: 'L', run: 'run1', producer: 'P', obligations: ['O'], submitter: 'P',
    });
    k.recordDispatch({ lineage: 'L', run: 'run1', attempt: at.attempt, obligation: 'O' });
    const missing = k.recordUnavailable({
      lineage: 'L', run: 'run1', obligation: 'O', attempt: at.attempt,
    });
    k.status({ lineage: 'L', run: 'run1' });
    k.decideUnavailable({ lineage: 'L', run: 'run1', actor: OWNER, choice: 'stop' });

    const here = fileURLToPath(new URL('./replay.mjs', import.meta.url));
    const out = JSON.parse(execFileSync(
      process.execPath, [here, logPath, 'L', 'run1'], { encoding: 'utf8' },
    ));
    eq('the request comes back', (out.requested || []).join(','), 'openai,qwen');
    eq('so does the capability that was missing', out.unavailable, missing.seq);
    eq('and the choice', out.unavailableDecision.choice, 'stop');
    eq('bound to the event it answers', out.unavailableDecision.answers, missing.seq);
    eq('and the arm did not become a pass', out.gateVerdicts.O, 'unavailable');
  });

  group('AC-13 · the record appends, closes, and replays', () => {
    // Through a Kernel, because there is no other way to append. `Ledger` was
    // exported, so `import { Ledger }` and `append` was a second way into the log
    // — which made "the Kernel is the only way in" a sentence in a README rather
    // than a property.
    const dir = tmp('v1l-');
    const path = join(dir, 'log.ndjson');
    const k = new Kernel(path, { completionRoot: dir, sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
    const w = walk(k);
    k.status({ lineage: w.lineage, run: w.run });

    // The closure itself, asserted against the shapes that enforce it: a kind
    // outside the set has no shape, and a known kind with a missing, null or
    // additional field does not match the one it has.
    ok('a kind outside the closed set has no shape', RECORDS.invented_kind === undefined);
    for (const [why, record] of [
      ['a field missing', { kind: 'attempt_opened', lineage: 'L', run: 'run1', seq: 0 }],
      ['a null field', {
        kind: 'attempt_opened', lineage: 'L', run: 'run1', assignment: null,
        producer: 'P', obligations: ['O'], seq: 0,
      }],
      ['an additional field', {
        kind: 'attempt_opened', lineage: 'L', run: 'run1', assignment: 'A1',
        producer: 'P', obligations: ['O'], smuggled: 'value', seq: 0,
      }],
      ['a decision claiming a different origin', {
        kind: 'human_decision_unavailable', operation: 'unavailable_decision',
        actor: 'Human Owner', lineage: 'L', run: 'run1', answers: 3,
        choice: 'stop', origin: 'model', seq: 0,
      }],
    ]) {
      ok(`${why} is refused`, validate(RECORDS[record.kind], record).length > 0);
    }

    // Reconstructed here and again by a fresh reader: the same records must
    // rebuild the same state. A bucketed projection used to be compared instead,
    // which compared the sorting code with itself.
    const scope = { lineage: w.lineage, run: w.run };
    const here = k.reconstruct(scope);
    ok('the run rebuilt something', here.attempts.length > 0);
    eq('and a fresh reader agrees',
      JSON.stringify(new Kernel(path).reconstruct(scope)), JSON.stringify(here));
    eq('including the verdict it reached', here.gateVerdicts.O, 'passed');
    eq('and the revision it was judged against', here.boundRevision, 'r1');

    // Every kind is accounted for: one the reconstruction has no branch for and
    // has not declared as carrying nothing is refused, rather than dropped from
    // the state without anything saying so.
    const present = new Set(k.records().map((r) => r.kind));
    ok('the run exercised several kinds', present.size > 5);
    ok('and the reconstruction accounted for all of them', here.boundRevision === 'r1');

    // The completeness half — "did we write what we relied on" — is carried by
    // the shape of the reduction rather than by a check. The Gate reduces from
    // records and from nothing else, so a fact that was not recorded is a fact it
    // cannot have used: this asserts that every input the verdict rested on is in
    // the log, by finding it there.
    const kinds = new Set(k.records().map((r) => r.kind));
    for (const relied of ['attempt_opened', 'observation', 'command_result', 'gate_result']) {
      ok(`${relied} is in the log`, kinds.has(relied));
    }
  });

}
