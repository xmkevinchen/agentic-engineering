---
id: discuss-no-teamdelete-between-topics
target: ae:discuss
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Step 2 contains explicit prohibition: "DO NOT delete the team between topics, after scoring, or before Doodlestein"
- [text:contains] Step 2 states team persists from Step 2 through Step 9 (Conclusion)
- [text:contains] Step 2 explains why team must persist (Doodlestein challenge-response cycle requires original participants)

### MUST_NOT
- [text:contains] No TeamDelete call or instruction appears in any step except Step 10 Shutdown
- [structure:completeness] No step between 2 and 9 instructs or implies team teardown

### SHOULD
- [text:contains] The prohibition is prominent (not buried in a footnote or sub-bullet)
