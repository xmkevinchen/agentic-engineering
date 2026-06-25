---
id: discuss-no-teamdelete-between-topics
target: ae:discuss
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Step 2 contains explicit prohibition: "DO NOT shut down teammates between topics, after scoring, or before Doodlestein"
- [text:contains] Step 2 states teammates persist from Step 2 through Step 9 (Conclusion)
- [text:contains] Step 2 explains why teammates must persist (Doodlestein challenge-response cycle requires original participants)

### MUST_NOT
- [text:contains] No teammate shutdown (shutdown_request) call or instruction appears in any step except Step 10 Shutdown
- [structure:completeness] No step between 2 and 9 instructs or implies teammate shutdown

### SHOULD
- [text:contains] The prohibition is prominent (not buried in a footnote or sub-bullet)
