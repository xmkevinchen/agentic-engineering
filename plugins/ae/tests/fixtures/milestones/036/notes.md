# Milestone Notes: Plan 036

## DEFERRED [Step 2]: Missing input sanitization on tag field
User-supplied tags are not sanitized before being written to the clustering algorithm. Low severity in this context (internal tool), but violates defense-in-depth.
Disposition: FIXED

## DEFERRED [Step 4]: No pagination on roadmap output for large corpora
Output could exceed terminal scroll buffer for projects with 100+ discussions. Unlikely in practice but possible.
Disposition: WAIVED: accepted as known limitation — /ae:roadmap is intentionally a one-shot display tool, not paginated

## DEFERRED [Step 6]: pipeline.test.yml paths use absolute plugin paths
Fixture paths should ideally be relative for portability across install locations. Current approach works but is brittle if plugin directory moves.
