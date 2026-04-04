---
id: agent-selection-tl-fallback-swap-family
target: ae:agent-selection
layer: 1
source: generated
---

## Expected Behavior

### MUST
- TL fallback condition 1 MUST check: "Other family enabled in pipeline.yml AND not also failed" — per exact wording in TL fallback logic section
- When condition 1 is met, MUST "Spawn replacement proxy from other family (swap: Codex↔Gemini)"
- The swap direction MUST be bidirectional: Codex↔Gemini (either direction depending on which failed)
- The rationale for independence MUST be stated: "Codex (OpenAI) and Gemini (Google) are independent providers with separate quotas"

### MUST_NOT
- MUST NOT make the swap decision based on failure reason — per exact wording: "Failure reason is logged for diagnostics but does NOT affect swap decision."
- MUST NOT differentiate swap behavior based on whether the failure was timeout, connection, rate_limit, or quota_exhausted — all are treated identically for swap purposes
