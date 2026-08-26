// AC-11, AC-12, AC-13 — the write, the formats, the record.

import { mkdtempSync, mkdirSync, symlinkSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib');
import { commitCompletion } from '../lib/writer.mjs';
import { auditWritePath } from '../lib/write-audit.mjs';
import { Ledger, KINDS, auditKinds } from '../lib/ledger.mjs';
import { lintSchema, validate } from '../lib/schema.mjs';
import { OBJECTS, checkContractRelations } from '../schema/objects.mjs';
import { group, ok, eq, refuses } from './harness.mjs';

const tmp = (p) => mkdtempSync(join(tmpdir(), p));

export function recordTests() {
  group('AC-11 · the completion write', () => {
    const root = tmp('v1w-');
    const out = join(root, 'done');
    mkdirSync(out);
    mkdirSync(join(root, 'inside'));

    // A real Acceptance: the writer validates the shape now, not merely that
    // something truthy was passed.
    const d = (s) => `sha256:${'0'.repeat(64 - s.length)}${s}`;
    const acceptance = {
      lineage: 'L', contract_revision: 'r1',
      contract_identity: { byte_sha256: d('a'), canonical_sha256: d('b'), length: 10 },
      deliverable: { kind: 'commit', identity: d('c') },
      decision: { outcome: 'accepted', origin: 'host', run: 'run1', seq: 9 },
      review: { required: false, statement: 'none required' },
    };
    const recordedVerdicts = [{
      kind: 'gate_result', run: 'run1', contract_revision: 'r1',
      obligation: 'O', status: 'passed',
    }];
    const write = (path, over = {}) => commitCompletion({
      root, path, acceptance, recordedVerdicts, obligations: ['O'],
      run: 'run1', revision: 'r1', ...over,
    });

    eq('a first write succeeds', write(join(out, 'a.json')).outcome, 'created');
    refuses('it does not overwrite', 'write_would_clobber', () => write(join(out, 'a.json')));
    // Not a flag a fixture sets to be refused — that only proves a `fail` fires
    // when asked. The write path's own call sites are read, so a move, link or
    // copy is found whether or not anyone thought to test for it.
    const staging = auditWritePath({ readFileSync, dir: libDir });
    eq('it does not stage', staging.map((f) => `${f.file}:${f.call}`).join(','), '');
    refuses('traversal cannot leave the location', 'write_escapes_location',
      () => write(join(out, '..', '..', 'escaped.json')));

    // The writer takes an Acceptance and the verdicts it rests on. An earlier
    // draft accepted any path and any bytes with no Gate input, which made this
    // a file write that happened to be called completion.
    refuses('arbitrary bytes with no Acceptance', 'not_all_passed',
      () => write(join(out, 'c.json'), { acceptance: undefined }));
    refuses('an obligation with no recorded verdict', 'record_not_appended',
      () => write(join(out, 'd.json'), { obligations: ['O', 'NEVER-RUN'] }));
    refuses('an obligation that did not pass', 'not_all_passed',
      () => write(join(out, 'e.json'), {
        recordedVerdicts: [{ ...recordedVerdicts[0], status: 'failed' }],
      }));
    refuses('a verdict from another run', 'record_not_appended',
      () => write(join(out, 'h.json'), {
        recordedVerdicts: [{ ...recordedVerdicts[0], run: 'other' }],
      }));

    // Both kinds of symlink, because `O_EXCL` refuses one at the final component
    // and nothing at the parents — which is why the preflight exists.
    const elsewhere = tmp('v1o-');
    symlinkSync(elsewhere, join(root, 'outlink'));
    symlinkSync(join(root, 'inside'), join(root, 'inlink'));
    refuses('a parent symlink pointing outside', 'write_through_symlink',
      () => write(join(root, 'outlink', 'f.json')));
    refuses('a parent symlink pointing inside', 'write_through_symlink',
      () => write(join(root, 'inlink', 'g.json')));
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
