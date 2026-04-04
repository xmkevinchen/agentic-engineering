---
id: proxy-timeout-protocol-referenced-think
target: ae:think
layer: 1
source: generated
---

## Expected Behavior

### MUST
- SKILL.md MUST contain text referencing Proxy Timeout Protocol from Agent Selection Reference — exact wording at Step 2 Cross-family: "Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles fallback (swap family)."

### MUST_NOT
- MUST NOT define custom timeout values (e.g., hardcoded "120s") independent of the Agent Selection Reference protocol
- MUST NOT define custom fallback logic that duplicates or contradicts the Agent Selection Reference protocol
