# findings-format.jq — F-082 AC7. The output contract a review backend must satisfy.
#
# One jq boolean assertion per line, executed by `scripts/verify-contract.sh`.
#
# This is a CONTRACT, not a request. The proxy states it to the backend and the bridge validates
# the reply against it; a reply that misses is reported as non-compliant, never reshaped into
# the expected structure. Reshaping is what lets a proxy attribute its own severity judgement to
# a backend that never made one.
#
# Severity vocabulary is AE's own (`skills/review/SKILL.md`): P1 blocker (security/data/crash),
# P2 should-fix (logic/perf/maintainability), P3 minor. A backend inventing P0 or "critical" is
# non-compliant — an unmapped severity would have to be mapped by the relay, which is judgement.

# --- shape --------------------------------------------------------------------------------
type == "object"
has("findings")
(.findings | type) == "array"

# An EMPTY findings array is compliant. This is a boundary value, instantiated rather than
# assumed: "the backend found nothing" and "the backend did not answer in the format" are
# different outcomes, and a contract that rejects the empty list forces the first to look like
# the second.
(.findings | length) >= 0

# --- every finding carries what a reader needs to check it --------------------------------
(.findings | all(type == "object"))
(.findings | all(has("severity")))
(.findings | all(has("file")))
(.findings | all(has("summary")))

# --- field domains -------------------------------------------------------------------------
(.findings | all(. as $f | ["P1", "P2", "P3"] | index($f.severity) != null))
(.findings | all(((.file | type) == "string") and ((.file | length) > 0)))
(.findings | all(((.summary | type) == "string") and ((.summary | length) > 0)))

# `line` is optional — a finding about a whole file has no line — but when present it must be a
# positive integer. Absent and 0 are different claims and only one of them is a location.
(.findings | all((has("line") | not) or (((.line | type) == "number") and (.line > 0))))

# `evidence` is optional and, when present, must be non-empty. An empty string reads as
# "evidence was considered and there is none", which is not what the backend meant.
(.findings | all((has("evidence") | not) or (((.evidence | type) == "string") and ((.evidence | length) > 0))))

# --- the contract is closed ----------------------------------------------------------------
# No top-level key other than `findings`. An open contract lets a backend return its findings
# alongside a summary field that a downstream reader might trust over the findings themselves.
((keys_unsorted - ["findings"]) | length) == 0
