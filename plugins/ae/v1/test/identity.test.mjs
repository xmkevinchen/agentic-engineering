// AC-3 — identities stay exact; lineage relations hold.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { identify, verify, currentRevision } from '../lib/identity.mjs';
import { Kernel } from '../lib/kernel.mjs';
import { asObject, contractDoc, RENDERED, SOURCE_ROOT, OWNER } from './fixtures.mjs';
import { group, ok, eq, refuses } from './harness.mjs';

export function identityTests() {
  group('AC-3 · a lexical mutation is detectable', () => {
    // The decisive case. These two encode the same content, so canonicalization
    // maps them to the same bytes on purpose — a canonical digest alone cannot
    // tell them apart, which is why the byte identity exists.
    const a = '{"a":1,"b":2}';
    const b = '{"b":2,"a":1}';
    const ia = identify(a);
    const ib = identify(b);
    ok('byte identities differ', ia.byte_sha256 !== ib.byte_sha256);
    ok('canonical identities agree', ia.canonical_sha256 === ib.canonical_sha256);
    refuses('reordered members caught', 'identity_mismatch', () => verify(b, ia));

    const spaced = '{"a": 1, "b": 2}';
    refuses('whitespace caught', 'identity_mismatch', () => verify(spaced, ia));

    // And the other half of the pair, which nothing reached: for a lexical
    // mutation the byte check fires first, so the canonical comparison was only
    // ever run on values that had already passed. A recorded identity whose two
    // halves disagree with each other is where it does the work.
    refuses('a recorded identity whose halves disagree', 'identity_mismatch',
      () => verify(a, { ...ia, canonical_sha256: `sha256:${'0'.repeat(64)}` }));
  });

  group('AC-3 · keeping only one identity fails', () => {
    const i = identify('{"a":1}');
    refuses('byte only', 'identity_partial', () => verify('{"a":1}', { byte_sha256: i.byte_sha256 }));
    refuses('canonical only', 'identity_partial',
      () => verify('{"a":1}', { canonical_sha256: i.canonical_sha256 }));
    refuses('neither', 'identity_partial', () => verify('{"a":1}', {}));
  });

  // Through `approve`, not through a helper. The lineage rules lived in
  // `checkApproval`, which the tests called and the approval path did not — so
  // every case passed and none of it was reached.
  group('AC-3 · lineage relations', () => {
    const fresh = () => new Kernel(join(mkdtempSync(join(tmpdir(), 'v1i-')), 'log.ndjson'), { sourceRoot: SOURCE_ROOT, render: RENDERED, owner: OWNER });
    const approve = (k, over, extra = {}) => {
      const c = asObject(contractDoc(over));
      return k.approve({
        lineage: over.lineage || 'L', revision: over.revision || 'r1',
        bytes: c.bytes, identity: c.identity, actor: 'Human Owner',
        rendered: RENDERED(c.bytes), ...extra,
      });
    };

    const k = fresh();
    const genesis = approve(k, {});
    eq('genesis is current', k.currentRevision('L'), 'r1');
    ok('another lineage has no current', k.currentRevision('OTHER') === null);

    const ZERO = `sha256:${'0'.repeat(64)}`;
    refuses('a genesis may not carry a predecessor', 'lineage_predecessor_wrong',
      () => approve(fresh(), {}, { predecessor: ZERO }));
    refuses('a lineage may not open a second genesis', 'lineage_second_genesis',
      () => approve(k, { revision: 'r2' }));
    refuses('a predecessor must be the prior revision', 'lineage_predecessor_wrong',
      () => approve(k, { revision: 'r2', predecessor: ZERO }, { predecessor: ZERO }));

    // The Contract's own bytes name a predecessor too, and it must be the same
    // one. Both were wrong together in the case above, so the envelope check
    // fired first and the bytes check was never reached: deleting it left the
    // suite green.
    refuses('a Contract naming a different predecessor than its approval',
      'lineage_predecessor_wrong',
      () => approve(
        k, { revision: 'r2', predecessor: ZERO },
        { predecessor: genesis.identity.byte_sha256 },
      ));

    // And the inverse. The two checks read different places — one the approval
    // was given with, one the Contract's own bytes — so a case where both are
    // wrong together isolates neither.
    refuses('an approval given with a predecessor the Contract does not name',
      'lineage_predecessor_wrong',
      () => approve(
        k, { revision: 'r2', predecessor: genesis.identity.byte_sha256 },
        { predecessor: ZERO },
      ));

    const prior = genesis.identity.byte_sha256;
    approve(k, { revision: 'r2', predecessor: prior }, { predecessor: prior });
    eq('a correct predecessor supersedes it', k.currentRevision('L'), 'r2');
  });

  group('AC-3 · currency is per lineage', () => {
    // The composition defect an earlier draft had: currency computed over the
    // whole log made approving a test-corpus Contract stale the production one.
    const approvals = [
      { lineage: 'PROD', revision: 'p1', identity: { byte_sha256: 'sha256:aa' } },
      { lineage: 'TEST', revision: 't1', identity: { byte_sha256: 'sha256:bb' } },
    ];
    eq('approving TEST leaves PROD current', currentRevision(approvals, 'PROD'), 'p1');
    eq('and TEST has its own', currentRevision(approvals, 'TEST'), 't1');
  });
}
