---
id: proxy-timeout-protocol-referenced-analyze
target: ae:analyze
layer: 1
source: generated
---

## Expected Behavior

### MUST
- SKILL.md MUST contain text referencing Proxy Timeout Protocol from Agent Selection Reference — found in Step 3 Cross-family section: "Apply **Proxy Timeout Protocol** from Agent Selection Reference — on proxy failure, TL handles angle-aware fallback."
- The additional "**Proxy timeout**: Apply Proxy Timeout Protocol from Agent Selection Reference." line at Step 3 end MUST be a reference to the central protocol, not a redefinition

### MUST_NOT
- MUST NOT define custom timeout values (e.g., hardcoded "120s") independent of the Agent Selection Reference protocol
- MUST NOT define custom fallback logic that duplicates or contradicts the Agent Selection Reference protocol
- The additional "Proxy timeout:" line at Step 3 end MUST NOT introduce new timeout parameters or values — it is a reminder reference, not a separate definition
