// Object identity and lineage — AC-3.
//
// Two identities per object, not one. The byte identity catches a lexical
// mutation — reordered members, changed whitespace, a respelled escape — which a
// canonical digest cannot, because canonicalization maps all of those to the same
// bytes on purpose. The canonical identity makes two encodings of the same content
// comparable, which byte identity cannot. Keeping only one loses one of those, so
// keeping only one is a defect rather than a simplification.

import { canonicalDigest, digestBytes, parseStrict } from './canonical-json.mjs';
import { deepFreeze } from './freeze.mjs';
import { fail } from './codes.mjs';

// The frozen parser takes Buffers — it checks `Buffer.isBuffer` rather than
// accepting any view, because a subarray of a larger buffer would otherwise
// digest bytes nobody meant to include.
function asBuffer(bytes) {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
}

export function identify(bytes) {
  const raw = asBuffer(bytes);
  const value = parseStrict(raw);
  return deepFreeze({
    byte_sha256: digestBytes(raw),
    canonical_sha256: canonicalDigest(value),
    length: raw.length,
  });
}

// Read is where identity is checked, because a consumer that acts on unverified
// bytes has already acted. What the Contract requires is the property — no
// consumer relies on an object whose byte identity does not verify — not that the
// check sits at any particular call site.
export function verify(bytes, recorded) {
  if (!recorded || !recorded.byte_sha256 || !recorded.canonical_sha256) {
    fail('identity_partial', 'an object must carry both its byte and canonical identity', { recorded });
  }
  const actual = identify(bytes);
  if (actual.byte_sha256 !== recorded.byte_sha256) {
    fail('identity_mismatch', 'stored bytes differ from the recorded byte identity', {
      expected: recorded.byte_sha256, actual: actual.byte_sha256,
    });
  }
  if (actual.canonical_sha256 !== recorded.canonical_sha256) {
    fail('identity_mismatch', 'canonical form differs from the recorded canonical identity', {
      expected: recorded.canonical_sha256, actual: actual.canonical_sha256,
    });
  }
  return actual;
}

// ---------------------------------------------------------------------------
// Lineage — relations a schema alone cannot establish.
//
// A schema can require the fields. It cannot say that this revision's lineage is
// the same one its predecessor used, that its predecessor is the prior revision
// rather than any revision, or that a lineage has one genesis. Those are facts
// about the approval history, so they are checked against it.

export function currentRevision(approvals, lineage) {
  const own = approvals.filter((a) => a.lineage === lineage);
  if (own.length === 0) return null;
  return own[own.length - 1].revision;
}
