// AC-3 — identities stay exact; lineage relations hold.

import { identify, verify, checkApproval, currentRevision, isStale } from '../lib/identity.mjs';
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
  });

  group('AC-3 · keeping only one identity fails', () => {
    const i = identify('{"a":1}');
    refuses('byte only', 'identity_partial', () => verify('{"a":1}', { byte_sha256: i.byte_sha256 }));
    refuses('canonical only', 'identity_partial',
      () => verify('{"a":1}', { canonical_sha256: i.canonical_sha256 }));
    refuses('neither', 'identity_partial', () => verify('{"a":1}', {}));
  });

  group('AC-3 · lineage relations', () => {
    const genesis = { lineage: 'L', revision: 'r1', byte_sha256: 'sha256:aa' };
    eq('genesis is current', currentRevision([genesis], 'L'), 'r1');
    ok('another lineage has no current', currentRevision([genesis], 'OTHER') === null);

    ok('a fresh lineage may open a genesis',
      checkApproval([], { lineage: 'N', predecessor: null }).genesis === true);
    refuses('a genesis may not carry a predecessor', 'lineage_predecessor_wrong',
      () => checkApproval([], { lineage: 'N', predecessor: 'sha256:aa' }));
    refuses('a lineage may not open a second genesis', 'lineage_second_genesis',
      () => checkApproval([genesis], { lineage: 'L', predecessor: null }));
    refuses('a predecessor must be the prior revision', 'lineage_predecessor_wrong',
      () => checkApproval([genesis], { lineage: 'L', predecessor: 'sha256:zz' }));
    eq('a correct predecessor supersedes it',
      checkApproval([genesis], { lineage: 'L', predecessor: 'sha256:aa' }).supersedes, 'r1');
  });

  group('AC-3 · currency is per lineage', () => {
    // The composition defect an earlier draft had: currency computed over the
    // whole log made approving a test-corpus Contract stale the production one.
    const approvals = [
      { lineage: 'PROD', revision: 'p1', byte_sha256: 'sha256:aa' },
      { lineage: 'TEST', revision: 't1', byte_sha256: 'sha256:bb' },
    ];
    ok('approving TEST leaves PROD current',
      isStale({ lineage: 'PROD', contract_revision: 'p1' }, approvals) === false);
    ok('a superseded PROD revision is stale',
      isStale({ lineage: 'PROD', contract_revision: 'p0' }, approvals) === true);
  });
}
