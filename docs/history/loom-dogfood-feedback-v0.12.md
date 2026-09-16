# AE plugin — dogfood feedback from Loom F-023 (targeting v0.12.x)

> **Status: historical.** A dogfood report against ae 0.12, kept as evidence of
> what that version cost its user. Most of the surfaces it names were removed by
> the delete. **It is a record, not a task list.** See [`rebuild.md`](../rebuild.md).

> Source: a full `/ae:work → /ae:review → pre-merge integration review` cycle run by
> Claude Code while self-hosting AE on the Loom project (Rust). All items below are
> backed by what actually happened in this run, not speculation.

## TL;DR

One **harness defect that silently defeats Check 7** (P1 for the methodology), plus four
process/path issues. Ranked by impact. The per-AC `verify_by` harness and the cross-family
+ challenger adversarial pass both proved their worth in the same run (real bugs caught) —
the fixes below are about closing the gaps that let other real bugs slip past the *mechanical*
layer.

Run data (evidence base):
- Feature F-023 (append-only run journal): 5 plan steps, 9 ACs (8 deterministic + 1 judge).
- `/ae:review`: 4 reviewers (architecture + codex + gemini + challenger), 0 P1, 6 findings.
- Pre-merge integration review: 4-feature combined diff (F-021/022/023/024, 18 commits,
  +2576/-113, 15 files), 3 reviewers, 0 P1, 1 cross-feature seam bug caught.
- Test count grew 182 → 190 across the review (the +8 were the verification gaps below).

## Disposition (2026-06-30, after the HDD wave shipped)

| Item | Status | Where |
|---|---|---|
| **F1** verify-ac.py zero-match vacuous | ✅ resolved | F-065 replaced `verify-ac.py` with `collect-ac-evidence.py` — zero-match → collector-integrity-failure (exit 1) is its *core reason to exist*; the 2026-06-30 integration fixup also removed verify-ac.py's orphaned `bin/` symlink |
| **F2** frozen-AC reconcile / re-freeze | → **BL-182** | open |
| **F3** integration-review untracked | → **BL-183** | open — **re-confirmed live** on AE's own HDD branch merge (2 P1s caught, run only because the user asked) |
| **F4** cwd-relative script paths | ✅ resolved | Wave 1 (v0.12.2) bin/-PATH migration + the 2026-06-30 integration fixup finishing the residual (risk-floor + counter call sites) |
| **F5** counter output leaks BL-115 | → **BL-184** | open — the integration fixup changed the counter's *invocation path* but not its *output format* |
| **Meta** reproduced-vs-trusted | → **BL-185** | open — F-065's isolated judge partially narrows the judge-AC side; explicit disclosure not done |

---

## F1 — `verify-ac.py` passes on a zero-match filter → Check 7 is silently vacuous (HIGHEST)

**What happened (data):** F-023 had 9 ACs with `verify: cargo test <filter>` lines. **7 of 9
filters matched ZERO tests** (e.g. `verify: cargo test journal_append` — the real test was
`append_writes_exactly_n_well_formed_ndjson_records`). `cargo test <bad-filter>` exits 0
(`0 passed; 119 filtered out`), and `verify-ac.py` returned **exit 0 for all of them** because
it only forwards cargo's exit code. Two of those ACs (AC2 = run_id correlation, AC5 = status
skips recovery) **had no covering test at all** — the mis-keyed filter hid the absence.

So Check 7's "strong-confidence re-run" reported 8/8 deterministic ACs green while **2 ACs
were verified by literally nothing**. It was caught only because the reviewer manually ran
`cargo test <filter> -- --list` and saw zero matches — not by the provided tool.

**Fix:** `verify-ac.py` MUST fail when the filter matches 0 tests. Parse the runner output for
`running N tests` / `N filtered out` (or run `--list` and require ≥1 match) and return non-zero
on zero-match. Until then, `review/SKILL.md` Check 7 should explicitly instruct the reviewer:
"confirm each `verify:` filter matches ≥1 real test; exit-0 alone is not proof."

**Why it matters:** this is the exact silent-drop Check 7 exists to catch, defeated by Check 7's
own tooling. It is a property of the mechanism, not of F-023 — every feature is exposed.

---

## F2 — No clean reconcile path when a frozen AC is internally self-contradictory

**What happened (data):** F-023's `goal.frozen.md` AC2 said the run_id spans **three** filenames
(`run-`, `journal-`, `dispatch-`). The same plan's **Step 2 said two** (run-log independent by
design, per the discussion conclusion). The contradiction was frozen at plan-approval. The
implementation followed Step 2 (two); the frozen AC said three. `/ae:review` Check 7 measures
against the frozen goal, so AC2 read as unsatisfied.

The frozen-goal rule ("Do NOT edit to match the work") left only the `WAIVED_AC` escape hatch.
The challenger fairly objected that a waiver is weaker than re-freezing a genuinely-wrong AC.

**Fix (two parts):**
1. `/ae:plan-review` (or the freeze step) should add an **AC↔Step consistency check**: the same
   fact stated differently in an AC and in a Step is a block *before* freezing. This contradiction
   was present and reviewable at plan time; nothing caught it.
2. Define an explicit **re-freeze** path distinct from `WAIVED_AC`. Semantics differ: a waiver =
   "this AC legitimately didn't run, here's why"; a re-freeze = "this AC's *standard* was authored
   wrong, here's the correction + provenance." Today both collapse into the waiver.

---

## F3 — The pre-merge integration review caught a real P2 nothing else did, but is unenforced/untracked

**What happened (data):** Each of F-021/022/023/024 passed its own `/ae:review` (cross-family).
The **combined-diff** integration review then found a genuine cross-feature seam bug
(architecture, P2): F-023's `recover_orphan_runs` called `write_dispatch_log` directly,
**bypassing F-024's `deliver()` stderr diagnostic** — a recovery write failure was invisible on
the terminal. F-024 existed *specifically* to surface that failure class; F-023's recovery path
predated the `deliver` wrapper and was never updated. No per-feature review could see this — the
two features are only co-present on the integrated diff.

It was only run because the user asked. `pre-merge-integration-review.md` is "a habit, not a gate,"
and the Completion Invariant's BL-145 reminder only *prints a line* — nothing records whether the
review actually happened before merge.

**Fix:** for a feature with non-empty `depends_on`, the Completion Invariant should write a
tracked state (e.g. `integration_review: pending|done` in the feature index, or a checklist item
`/ae:dashboard` surfaces) so "stack merged without integration review" is *visible*, not silent.
A soft gate, consistent with the doc's "not CI" stance, but better than an ephemeral printed line.

---

## F4 — Plugin script paths are cwd-relative; they break when AE self-hosts on an external repo

**What happened (data):** `verify-ac.py`, `cross-family-counter.sh`, `/ae:test-plugin` are all
invoked as `plugins/ae/scripts/<x>` relative to cwd. When AE dogfoods **on Loom**, cwd is the
Loom repo and the scripts live at `../agentic-engineering/plugins/ae/scripts/`. Every Check 7
`verify-ac.py` call and the Check 6 protocol check would `No such file` from the Loom cwd; the
reviewer had to manually prefix `../agentic-engineering/`.

**Fix:** resolve plugin-script paths from the plugin's install location, not cwd. AE is its own
first external user (per Loom's CLAUDE.md); this breaks for every external dogfood project.

---

## F5 (minor) — `cross-family-counter.sh` leaks internal bookkeeping into operator-facing output

**What happened (data):** the emitted line was
`...of 9 reviews with family-tracking data; 9/34 reviews tracked; flip-rate quality metric
deferred → BL-115 [degraded: 1 state-unknown]`. It's verbose and leaks a backlog ID (`BL-115`)
into a line meant for a human reading a review. Descriptive-counter intent is right; the surface
needs trimming (lead with the count; keep the `BL-115`/degraded notes in a comment, not the line).

---

## What worked (do not regress)

- **Per-AC `verify_by` concept** is sound *when filters are correct* — it localized exactly which
  ACs were under-verified once the names were fixed.
- **Challenger (pure opposition) + cross-family earned their cost.** Real, non-hallucinated catches
  in this run: AC8 wiring untested (test bypassed `run_one_feature`), AC1 lossless test was
  sequential-only (never exercised the `Arc<Mutex<File>>` contention the AC's rationale invokes),
  codex's `dispatch_log_is_valid` under-validation, the integration `deliver`-bypass seam.
- **Completion Invariant + path-derived archive** (active→done mv + frontmatter writeback) ran clean.
- **Gemini → local `gemma` fallback on rate-limit** worked transparently, preserving the family lens.

---

## Meta: review-process honesty (a gap in *how the verdict is earned*, not a skill bug)

Worth surfacing because it bears on what a `verdict: pass` actually certifies. In this run the
executor (Claude) genuinely ran the build/test harness — proven by hitting a real `124 passed; 1
failed` when a tightened check broke a fixture, then diagnosing+fixing it. But the PASS verdict
also rested on **trusting reviewer reports that were not each independently reproduced** (codex's
"13 confirmed correct" table; the integration "4 seams clean"), and the **judge AC (AC9) was
adjudicated via the automated scope-guard test + a proxy's confirmation rather than the reviewer's
own line-by-line rubric pass**, which Check 7 nominally requires of `judge` ACs. This is inherent
to delegating review to agents, but `review/SKILL.md` could state plainly which parts of a verdict
are *reproduced* vs *trusted*, so a `pass` isn't over-read.
