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
2. **Allocate next BL number**: run `bash plugins/ae/scripts/next-bl-id.sh` — it prints the next free `BL-NNN` (zero-padded to 3 digits; `001` when none exist). Do NOT compute `max+1` by hand. This is the **canonical BL allocator**: it union-scans `<output.backlog>` (recursive) ∪ the feature dirs `.ae/features/{active,done,abandoned,paused}/F-*/BL-*.md` (promoted BLs move into feature dirs and must not be reused — a backlog-only scan would silently reuse them). Every other BL-writing path (discuss/review/work defer sites) calls this same script rather than re-implementing the scan.
3. **Slugify** the description deterministically. Apply these steps **in this exact order** (not best-effort, not LLM-judged — same input always produces the same slug across agents):
   1. **Lowercase** the entire string.
   2. **Strip non-ASCII characters** (emoji, accents, full-width punctuation, etc.) — replace each with empty string. Do NOT transliterate (e.g., `ñ` becomes empty, not `n`).
   3. **Replace any run of one or more non-alphanumeric characters with a single `-`**. Underscores count as non-alphanumeric and become `-`.
   4. **Trim leading and trailing `-`**.
   5. **Truncate to 40 characters max** by simple right-side cut. Words may be cut mid-word — this is intentional. Do NOT use word-boundary truncation (LLM agents differ on what counts as a word boundary; mid-word cut is the only deterministic choice).
   6. **Trim trailing `-` again** after truncation (in case the cut landed on a `-`).
   7. **If the result is empty** (all-stop-word, all-non-ASCII, or all-punctuation input), the file is named `BL-NNN.md` with no slug suffix.
   - Examples:
     - `"Test the GTD pipeline"` → `test-the-gtd-pipeline`
     - `"🚀 Ship it!"` → `ship-it`
     - `"a the and"` → `a-the-and` (NOT empty — these are alphanumeric; "stop-words" was an imprecise earlier description)
     - `"!!!"` → empty → `BL-NNN.md`
     - `"Implement test-coverage feature for the new pipeline-runner"` (53 chars after slug ops) → `implement-test-coverage-feature-for-the` (40-char cut, trailing `-` trimmed)
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
