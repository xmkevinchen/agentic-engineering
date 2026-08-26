// AC-11, AC-12, AC-13 — the write, the formats, the record.

import { mkdtempSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitCompletion } from '../lib/writer.mjs';
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

    eq('a first write succeeds',
      commitCompletion({ root, path: join(out, 'a.json'), bytes: Buffer.from('{}') }).outcome,
      'created');
    refuses('it does not overwrite', 'write_would_clobber',
      () => commitCompletion({ root, path: join(out, 'a.json'), bytes: Buffer.from('{}') }));
    refuses('it does not stage', 'write_staged',
      () => commitCompletion({
        root, path: join(out, 'b.json'), bytes: Buffer.from('{}'), allowStaging: true,
      }));
    refuses('traversal cannot leave the location', 'write_escapes_location',
      () => commitCompletion({
        root, path: join(out, '..', '..', 'escaped.json'), bytes: Buffer.from('{}'),
      }));

    // Both kinds of symlink, because `O_EXCL` refuses one at the final component
    // and nothing at the parents — which is why the preflight exists.
    const elsewhere = tmp('v1o-');
    symlinkSync(elsewhere, join(root, 'outlink'));
    symlinkSync(join(root, 'inside'), join(root, 'inlink'));
    refuses('a parent symlink pointing outside', 'write_through_symlink',
      () => commitCompletion({ root, path: join(root, 'outlink', 'c.json'), bytes: Buffer.from('{}') }));
    refuses('a parent symlink pointing inside', 'write_through_symlink',
      () => commitCompletion({ root, path: join(root, 'inlink', 'd.json'), bytes: Buffer.from('{}') }));
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
    eq('no kind is orphaned', auditKinds().length, 0);
    ok('the set is non-empty', Object.keys(KINDS).length > 0);
  });

  group('AC-13 · the record appends, closes, and replays', () => {
    const dir = tmp('v1l-');
    const path = join(dir, 'log.ndjson');
    const ledger = new Ledger(path);

    ledger.append({ kind: 'attempt_opened', lineage: 'L', attempt: 'a1' });
    ledger.append({ kind: 'observation', lineage: 'L', obligation: 'O', attempt: 'a1' });

    // Rejection happens at the append boundary, so the Gate never sees it — and
    // `pending` for an obligation nothing was validly submitted for is correct.
    refuses('a kind outside the closed set', 'kind_without_consumer',
      () => ledger.append({ kind: 'invented_kind', lineage: 'L' }));

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
