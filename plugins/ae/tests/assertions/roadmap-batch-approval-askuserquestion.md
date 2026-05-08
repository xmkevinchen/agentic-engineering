---
id: roadmap-batch-approval-askuserquestion
target: ae:roadmap
layer: 1
source: generated
---

## Expected Behavior

### MUST
- [text:contains] Step A `AskUserQuestion` has exactly 3 options: `Approve all`, `Remove some`, `Cancel (nothing will be promoted)`
- [text:contains] Cancel-with-disambiguation label is exactly `Cancel (nothing will be promoted)` on first display (full label required, not abbreviated `Cancel`)
- [text:contains] Step B fires ONLY when `Remove some` is chosen at Step A
- [text:contains] Step B uses `multiSelect: true` with options = displayed BLs all pre-checked (user unchecks BLs to drop)
- [text:contains] After multi-select, a confirm `AskUserQuestion` runs with 2 options: `Approve [N kept]` and `Cancel (nothing will be promoted)`

### MUST_NOT
- [text:contains] Step B does NOT fire when `Approve all` or `Cancel` is chosen at Step A
- [text:contains] Cancel at any prompt does NOT invoke any `/ae:analyze` (zero promotions)

### SHOULD
- [text:contains] Cancel exits with a clear "no promotions executed (cancelled)" message
- [text:contains] Post-approval execution streams a per-BL completion log line during the loop
