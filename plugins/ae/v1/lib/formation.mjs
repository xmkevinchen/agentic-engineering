// Formation trace — AC-6.
//
// Outbound: every material statement cites a specific source, and a statement
// derivable from none is listed as an agent proposal. Inbound: every obligation
// the verifiable sources place on V1 is carried or visibly disposed, and a
// disposition names a landing that actually carries it.
//
// The landing check is the one that matters. Three consecutive drafts of this
// Contract claimed coverage in the disposition table for criteria that did not
// contain the obligation — always in the direction of claiming more. A table that
// checks itself is the only kind worth keeping.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fail } from './codes.mjs';

export function fileDigest(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

// A cited source must exist and match the digest recorded for it. A citation to
// a source that has since changed is a citation to something else.
export function checkVerifiableSources(provenance, resolve) {
  const problems = [];
  for (const entry of provenance.verifiable) {
    let actual;
    try {
      actual = fileDigest(resolve(entry.source));
    } catch {
      problems.push({ id: entry.id, why: 'cited source does not resolve' });
      continue;
    }
    if (actual !== entry.sha256) {
      problems.push({ id: entry.id, why: 'cited digest does not match the file' });
    }
  }
  return problems;
}

// Outbound. A statement citing a broad entry that could support anything cites
// nothing: the check is that the cited id is specific, not merely present.
export function checkCitations(statements, provenance) {
  const known = new Set([
    ...provenance.verifiable.map((v) => v.id),
    ...provenance.transcribed.map((t) => t.id),
    ...provenance.proposals.map((p) => p.id),
  ]);
  const broad = new Set(
    provenance.transcribed.filter((t) => t.broad === true).map((t) => t.id),
  );

  const problems = [];
  for (const s of statements) {
    if (!s.cites || s.cites.length === 0) {
      problems.push({ statement: s.id, why: 'cites nothing' });
      continue;
    }
    for (const id of s.cites) {
      if (!known.has(id)) problems.push({ statement: s.id, why: `cites unknown source ${id}` });
    }
    if (s.cites.every((id) => broad.has(id))) {
      problems.push({ statement: s.id, why: 'cites only a broad entry' });
    }
  }
  return problems;
}

// Inbound, with the landing check. `carriedBy` answers whether a criterion
// actually contains an obligation — supplied by the caller, because only the
// caller knows what its criteria say.
export function checkDispositions(dispositions, carriedBy) {
  const problems = [];
  for (const d of dispositions) {
    if (!d.disposition) {
      problems.push({ obligation: d.obligation, why: 'neither carried nor disposed' });
      continue;
    }
    if (d.disposition === 'carried') {
      if (!d.lands_in || d.lands_in.length === 0) {
        problems.push({ obligation: d.obligation, why: 'carried but names no landing' });
        continue;
      }
      for (const criterion of d.lands_in) {
        if (!carriedBy(criterion, d.obligation)) {
          problems.push({
            obligation: d.obligation,
            why: `${criterion} does not contain this obligation`,
          });
        }
      }
    }
  }
  return problems;
}

// The view presented for approval must be derived from the approved bytes, and
// the derivation must be checkable — not two digests recorded side by side, which
// a stale view of one candidate plus the correct digest of another would satisfy.
export function checkPresentedView({ approvedBytes, view, render }) {
  if (!view || !view.rendering_sha256 || !view.renders_sha256) {
    fail('human_input_absent', 'approval must record what was shown and what it renders', {});
  }
  const approved = `sha256:${createHash('sha256').update(approvedBytes).digest('hex')}`;
  if (view.renders_sha256 !== approved) {
    fail('identity_mismatch', 'the view does not claim to render the approved bytes', {
      claimed: view.renders_sha256, approved,
    });
  }
  const rerendered = render(approvedBytes);
  const actual = `sha256:${createHash('sha256').update(rerendered).digest('hex')}`;
  if (actual !== view.rendering_sha256) {
    fail('identity_mismatch', 'the recorded rendering is not what those bytes render to', {
      recorded: view.rendering_sha256, actual,
    });
  }
  return true;
}
