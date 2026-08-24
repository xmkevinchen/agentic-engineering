# AE v1 documentation set

> **Pre-acceptance draft.** This documentation set was prepared from the
> frozen AE 1.0 specification before implementation and release acceptance
> were complete. It does not claim that AE v1 is implemented, accepted, or
> released.

This directory is the publication staging area for AE v1's post-implementation
documentation. It separates four questions that should not be collapsed into
one release note:

| Document | Question it answers | Authority after release |
|---|---|---|
| [Design and limitations](design-and-limitations.md) | What was built, where are its trust boundaries, and what does it deliberately not do? | Descriptive as-built record |
| [Usage guide](usage-guide.md) | How should a person use AE v1 in a Claude Code session? | User guidance; never completion authority |
| [Acceptance dossier](acceptance-dossier.md) | Which implementation and evidence artifacts justify release? | Evidence index only; Gate/Finalizer retain feature-completion authority, and a separate digest-bound human decision owns release acceptance |
| [v1+ roadmap](v1-plus-roadmap.md) | What should be investigated after v1, including a Codex port? | Non-normative roadmap |

## Publication rule

Until all release placeholders are resolved, the repository's released-version
documentation remains the description of current product behavior. These files
must not be linked as the default quickstart or presented as shipped behavior.

Publication requires all of the following:

- every `RELEASE-BLOCKER` marker is replaced with an observed value or an
  explicit, accepted limitation;
- the design's implementation map points to the released code, schemas, and
  build identities;
- the usage guide is replayed against every supported Claude Code invocation
  mode;
- the acceptance dossier contains the final scorecard and raw evidence links;
- a separate release-acceptance record binds the exact candidate and frozen
  dossier digests;
- the roadmap remains clearly outside the v1 Contract and release Gate; and
- a final documentation review confirms that normative intent is not phrased
  as observed implementation fact.

## Source of truth while drafting

The frozen AE 1.0 specification is the normative design source. This directory
is deliberately downstream of that specification:

1. the frozen design defines required semantics;
2. implementation and qualification produce observable facts;
3. this set records the resulting as-built behavior and its limitations; and
4. the deterministic Gate and sole Finalizer decide completion, not these
   Markdown files.

If the released implementation differs from the frozen specification, record
the difference in the design's deviation table with evidence, residual risk,
and disposition. Do not silently edit the as-built description to resemble the
specification.
