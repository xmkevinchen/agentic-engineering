// V1 Kernel error codes.
//
// Kept separate from the foundation taxonomy the mechanisms carry: those name
// lexical, tree and policy failures, these name the Kernel's own admissibility
// verdicts. A code appears in exactly one of the two, so a caller can always tell
// which layer refused.
//
// Every falsifier in the Contract that says a thing is refused names a code here.
// A rejection with no code is a rejection a test cannot assert on.

import { FoundationError, fail as raise, ALL_CODES } from './errors.mjs';
import { deepFreeze } from './freeze.mjs';

export { FoundationError };

export const KERNEL_CODES = deepFreeze({
  // AC-3 — identity
  identity: [
    'identity_missing',          // an object persisted or read without both identities
    'identity_mismatch',         // stored bytes differ from the recorded byte identity
    'identity_partial',          // only one of the two identities kept
    'lineage_immutable',         // a revision changed its lineage identity
    'lineage_predecessor_wrong', // predecessor is not the prior revision of this lineage
    'lineage_second_genesis',    // a second genesis opened for an existing lineage
  ],

  // AC-2 — evidence admissibility
  evidence: [
    'observation_not_named',      // answers an observation the Contract did not name
    'result_self_authored',       // raw content came from the submission, not externally
    'binding_missing',            // one of the five identities absent
    'binding_unresolved',         // a named identity does not resolve
    'binding_cross_execution',    // the five resolve but do not belong to one execution
    'capture_before_activation',  // observation predates the revision's activation
    'change_out_of_boundary',     // a reported change lies outside the assignment boundary
    'vacuous_observation',        // exercised nothing, or subject count unestablishable
    'material_input_incomplete',  // depended on an input it did not record
  ],

  // AC-5, AC-7 — authority
  authority: [
    'authority_not_granted',      // claimed an authority the Assignment did not grant
    'authority_self_asserted',    // believed because the submission asserted it
    'identity_self_asserted',     // producer identity taken from the submission
    'assignment_self_issued',     // the party that benefits issued it
    'assignment_not_issued',      // no issuance record from the trust root
    'attempt_not_granted',        // opened an attempt without the grant
    'assignment_not_unique',      // a second Assignment in one run
    'mutation_producer_ungranted',// mutation submitted under an ungranted producer
    'human_input_absent',         // an authority operation carried only model output
    'human_input_self_supplied',  // satisfied by a caller-written field
  ],

  // AC-11 — the completion write
  write: [
    'writer_not_sole',            // completion written by something else
    'write_would_clobber',        // target exists
    'write_escapes_location',     // resolved path leaves the allowed location
    'write_through_symlink',      // a symlink at any path component
    'write_staged',               // materialized elsewhere first, then moved or linked
  ],

  // AC-12, AC-13 — persisted formats and the record
  record: [
    'format_open',                // a schema position admits an unusable value
    'format_unfrozen',            // persisted before the real run froze it
    'format_frozen_early',        // frozen before the real run exercised it
    'format_changed_in_place',    // a frozen format edited rather than superseded
    'enforcement_unpinned',       // frozen without pinning what enforces it
    'kind_without_producer',      // a persisted kind no V1 producer writes
    'kind_without_consumer',      // a persisted kind no V1 consumer reads
    'record_not_appended',        // a fact the Gate used was never recorded
    'replay_incomplete',          // a relied-on state replay cannot reconstruct
  ],

  // AC-1, AC-9 — completion and the run
  completion: [
    'not_all_passed',             // an Acceptance for a non-passed status
    'signoff_before_gate',        // sign-off predates the Gate result
    'signoff_wrong_run',          // sign-off belongs to another run
    'signoff_wrong_revision',     // sign-off belongs to another revision
    'signoff_wrong_deliverable',  // sign-off belongs to another deliverable
    'review_required_absent',     // silent about a review the Contract required
    'run_facts_incomplete',       // the run record is missing one of the four facts
    'cost_incomparable',          // the two cost figures cannot be compared
    'cost_boundary_post_hoc',     // boundaries chosen after the outcome was visible
    'trace_outcome_unsupported',  // caught_something with no recorded discrepancy
    'retreat_contradicts_facts',  // the decision disagrees with the arithmetic
    'retreat_not_acted_on',       // the condition fired and nothing was cut
  ],

  // AC-6 — formation
  formation: [
    'statement_uncited',          // a material statement cites no source
    'citation_unknown',           // cites an id the provenance does not list
    'citation_broad_only',        // cites only an entry broad enough to support anything
    'obligation_undisposed',      // a transcribed obligation neither carried nor disposed
    'disposition_lands_nowhere',  // carried, but nothing in the Contract cites it
  ],

  // AC-8 — requested identity
  family: [
    'requested_substituted',      // a default replaced the stated identity
    'requested_dropped',          // the field is gone
    'observed_without_answer',    // observed or effective present when nothing answered
    'requested_from_wrong_source',// read from the Assignment or configuration
    'same_family_substituted',    // a same-family seat stood in for an unavailable one
  ],
});

export const ALL_KERNEL_CODES = deepFreeze(Object.values(KERNEL_CODES).flat());

// A code must be unique across the whole taxonomy: two groups claiming one code
// is how a caller ends up branching on a verdict that means two things.
{
  const seen = new Set();
  for (const code of ALL_KERNEL_CODES) {
    if (seen.has(code)) {
      throw new Error(`duplicate kernel code: ${code}`);
    }
    seen.add(code);
  }
}

// Refusing with a code the taxonomy does not name is refusing with nothing a test
// can assert on, and the taxonomy had no reader at all — "every falsifier in the
// Contract that says a thing is refused names a code here" was a sentence in a
// comment. This is what makes it true: a typo, or a code invented at the call
// site, fails here rather than travelling as a plausible-looking string.
const KNOWN = new Set([...ALL_KERNEL_CODES, ...ALL_CODES]);

export function fail(code, message, detail) {
  if (!KNOWN.has(code)) {
    raise('kind_without_consumer', `refusal with a code no taxonomy names: ${code}`, { code });
  }
  return raise(code, message, detail);
}
