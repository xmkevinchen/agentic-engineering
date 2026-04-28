---
name: ae:backlog
description: Capture a backlog item — one-line description → BL-NNN file in the inbox
argument-hint: "<one-line description of the idea, problem, or task>"
user-invocable: true
effort: minimal
---

# /ae:backlog — GTD Capture

Drop a one-line idea into the inbox without breaking flow. Allocates the next `BL-NNN` and writes a stub file under `<output.backlog>/unscheduled/`.

## Trigger

User runs `/ae:backlog <description>`.

If the user runs `/ae:backlog` without an argument, ask them once for the one-line description, then proceed.

## Steps

1. **Read** `<output.backlog>` from `.claude/pipeline.yml` (default: `.ae/backlog/`).
2. **Allocate next BL number**: scan **recursively** across all subdirs (`unscheduled/`, `closed/`, `done/`, and any sprint dirs) — `find <output.backlog> -type f -name 'BL-*.md'`. Parse the `NNN` digits from each filename, take `max(NNN) + 1`. Zero-pad to 3 digits (`042`, `100`). If no BL exists yet, start at `001`. The recursive scan is required — a non-recursive listing would miss closed/done BLs and reuse already-assigned numbers.
3. **Slugify** the description deterministically:
   - Lowercase, strip emoji and other non-ASCII, replace non-alphanumeric runs with `-`.
   - Trim leading/trailing `-`.
   - Truncate to **40 characters max** (hard cap, not word-based — words can be cut mid-word; this keeps the rule deterministic across LLM agents).
   - If the result is empty (all-stop-word or all-non-ASCII input), the file is named `BL-NNN.md` with no slug suffix.
   - Example: `"Test the GTD pipeline"` → `test-the-gtd-pipeline`. `"🚀 Ship it"` → `ship-it`. `"a the and"` → empty → `BL-NNN.md`.
4. **Write** `<output.backlog>/unscheduled/BL-NNN-<slug>.md` (or `BL-NNN.md` if slug empty) with frontmatter:

   ```yaml
   ---
   id: BL-NNN
   title: <description verbatim>
   status: open
   created: <today YYYY-MM-DD>
   ---
   
   # BL-NNN — <description>
   
   <empty body — user fills in later, or `ae:roadmap` Clarify surfaces it>
   ```

   The user may add `priority`, `source`, `depends_on`, `notes`, or any other field by hand later — the schema is intentionally minimal at capture time. Do NOT prompt for `priority`/`kind`/etc. at capture; that's the Clarify step's job.

5. **Output** the new BL ID + path so the user can open it if they want to flesh it out immediately.

## Output

Confirmation only — the goal is "file and forget" (GTD capture discipline). Do NOT suggest next steps; classification happens later when the user invokes Clarify or Organize on their own schedule.

```
✅ BL-NNN captured: <title>
   .ae/backlog/unscheduled/BL-NNN-<slug>.md
```

## Non-goals

- **No follow-up prompts** — never ask for priority, kind, tags, or any field beyond the one-line description. Capture must be frictionless; classification is the Clarify (`ae:roadmap`) and Organize (`ae:analyze`) phases' job.
- **No "next step" nudge** in the output — pointing the user at `ae:roadmap` or `ae:analyze` right after capture breaks file-and-forget psychology.
- **No deduplication** against existing BLs. Capture must not pause flow to ask "did you mean BL-042?"; duplicates surface later in Clarify.
- **No promotion to feature dir.** That's `ae:analyze BL-NNN` (Organize).
- **No concurrent-invocation safety.** Two `/ae:backlog` calls racing on the BL counter could collide on the same number — accepted limit for a solo-dev workflow. If this becomes a real failure, swap allocation for a `mkdir`-based atomic claim.
