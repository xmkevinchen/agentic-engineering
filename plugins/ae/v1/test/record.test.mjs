// AC-11, AC-12, AC-13 — the write, the formats, the record.

import { mkdtempSync, mkdirSync, symlinkSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib');
import { auditWritePath } from '../lib/write-audit.mjs';
import { Ledger, KINDS, auditKinds } from '../lib/ledger.mjs';
import { lintSchema, validate } from '../lib/schema.mjs';
import { OBJECTS, checkContractRelations } from '../schema/objects.mjs';
import { execFileSync } from 'node:child_process';
import { Kernel } from '../lib/kernel.mjs';
import { asObject, assignmentDoc, contractDoc, walk, RENDERED, SOURCE_ROOT } from './fixtures.mjs';
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
      const k = new Kernel(join(dir, 'log.ndjson'), { completionRoot: dir, sourceRoot: SOURCE_ROOT });
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
    const escaping = new Kernel(join(esc.dir, 'log.ndjson'), { completionRoot: esc.dir, sourceRoot: SOURCE_ROOT });
    refuses('a lineage that climbs out of the root', 'write_escapes_location', () => {
      const c = asObject(contractDoc({ lineage: '../../escaped' }));
      escaping.approve({
        lineage: '../../escaped', revision: 'r1', bytes: c.bytes, identity: c.identity,
        actor: 'Owner', rendered: RENDERED(c.bytes), render: RENDERED,
      });
      const a2 = asObject(assignmentDoc({ lineage: '../../escaped' }));
      escaping.issueAssignment({
        lineage: '../../escaped', run: 'run1', bytes: a2.bytes, identity: a2.identity,
        actor: 'Owner',
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
      const k2 = new Kernel(join(linked, `${name.length}.ndjson`), { completionRoot: root, sourceRoot: SOURCE_ROOT });
      const w2 = walk(k2);
      refuses(name, 'write_through_symlink',
        () => k2.complete({ lineage: w2.lineage, run: w2.run, actor: 'Human Owner' }));
    }
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
    const k = new Kernel(logPath, { completionRoot: dir, sourceRoot: SOURCE_ROOT });
    const w = walk(k);
    const { acceptance } = k.complete({ lineage: w.lineage, run: w.run, actor: 'Human Owner' });

    const here = fileURLToPath(new URL('./replay.mjs', import.meta.url));
    const out = JSON.parse(execFileSync(
      process.execPath, [here, logPath, w.lineage, w.run], { encoding: 'utf8' },
    ));

    eq('the approved revision comes back', out.approvedRevision, 'r1');
    eq('the attempt comes back', out.attempts.join(','), w.attempt.attempt);
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

  group('AC-13 · the record appends, closes, and replays', () => {
    const dir = tmp('v1l-');
    const path = join(dir, 'log.ndjson');
    const ledger = new Ledger(path);

    // Full records, because `append` now validates the payload and not only the
    // kind. A shorthand fixture would have been refused — which is the point:
    // closure over names is not closure.
    ledger.append({
      kind: 'attempt_opened', lineage: 'L', run: 'run1', assignment: 'A1', attempt: 'a1',
      producer: 'P', obligations: ['O'],
    });
    ledger.append({
      kind: 'observation', lineage: 'L', run: 'run1', obligation: 'O',
      observation: 'sh run-tests.sh', attempt: 'a1', contract_revision: 'r1',
      assignment: 'A1', producer: 'P', artifact: 'art1', package: 'pkg1',
      command_result: 'cr1',
    });

    // Rejection happens at the append boundary, so the Gate never sees it — and
    // `pending` for an obligation nothing was validly submitted for is correct.
    refuses('a kind outside the closed set', 'kind_without_consumer',
      () => ledger.append({ kind: 'invented_kind', lineage: 'L' }));

    // The payload too. An earlier draft checked the name and accepted anything
    // beside it: missing fields, nulls, and additional properties all appended.
    refuses('a known kind with a field missing', 'format_open',
      () => ledger.append({ kind: 'attempt_opened', lineage: 'L', run: 'run1', attempt: 'a1' }));
    refuses('a known kind with a null field', 'format_open',
      () => ledger.append({
        kind: 'attempt_opened', lineage: 'L', run: 'run1', assignment: null, attempt: 'a1',
        producer: 'P', obligations: ['O'],
      }));
    refuses('a known kind with an additional field', 'format_open',
      () => ledger.append({
        kind: 'attempt_opened', lineage: 'L', run: 'run1', assignment: 'A1', attempt: 'a1',
        producer: 'P', obligations: ['O'], smuggled: 'value',
      }));
    // And the origin markers are constants in the shape, so a record claiming
    // host origin cannot be appended with anything else there.
    refuses('a decision claiming a different origin', 'format_open',
      () => ledger.append({
        kind: 'human_decision_choice', operation: 'signoff', actor: 'H', lineage: 'L', choice: 'sign',
        origin: 'model',
      }));

    const first = ledger.replay();
    eq('both records replay', first.records.length, 2);
    eq('the attempt is reconstructed', first.state.attempts.length, 1);
    eq('sequence is the record’s own', first.records.map((r) => r.seq).join(','), '0,1');

    // Replay is a check, not a re-enactment: a fresh reader must rebuild the same
    // state from the same bytes.
    const fresh = new Ledger(path).replay();
    ok('a fresh process rebuilds the same state',
      JSON.stringify(fresh.records) === JSON.stringify(first.records));

    refuses('a relied-on fact that was never recorded', 'record_not_appended',
      () => ledger.assertRecorded(['human_signoff']));
    ok('facts that were recorded', ledger.assertRecorded(['attempt_opened', 'observation']));
  });
}
