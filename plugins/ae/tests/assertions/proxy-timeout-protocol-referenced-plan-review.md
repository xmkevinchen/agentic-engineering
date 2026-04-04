---
id: proxy-timeout-protocol-referenced-plan-review
target: ae:plan-review
layer: 1
source: generated
---

## Expected Behavior

### MUST
- SKILL.md MUST contain text referencing Proxy Timeout Protocol from Agent Selection Reference — exact wording at Step 1 Cross-family: "Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles fallback (swap family)."

### MUST_NOT
- MUST NOT define custom timeout values (e.g., hardcoded "120s" or "60s") independent of the Agent Selection Reference protocol
- MUST NOT define custom fallback logic (e.g., inline retry logic or custom swap rules) that duplicates or contradicts the Agent Selection Reference protocol
