---
id: agent-selection-subagent-not-tl-fallback
target: ae:agent-selection
layer: 1
source: generated
---

## Expected Behavior

### MUST
- The TL fallback logic section MUST contain the annotation "(TL executes this, not subagent leads)" — per exact wording: "### TL fallback logic (TL executes this, not subagent leads)"
- The fallback logic (conditions 1 and 2, swap decision) MUST be defined under this TL-annotated section

### MUST_NOT
- MUST NOT place fallback logic (spawn replacement, mark degraded, swap decision) in the "Proxy prompt suffix" section — that section only defines the proxy's own behavior (report unavailable + exit)
- MUST NOT place fallback logic in the "Lead/challenger prompt suffix" section — that section only defines "notify TL that proxy is unresponsive. TL handles fallback."
- MUST NOT include swap/degraded decision logic in any subagent prompt template
