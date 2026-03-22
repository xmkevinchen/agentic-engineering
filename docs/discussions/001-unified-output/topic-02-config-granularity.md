---
id: "02"
title: "pipeline.yml Config Granularity"
status: decided
created: 2026-03-22
decision: "D — Semantic slots + sensible defaults, no root"
rationale: "Derived from SmartPal's real use case: existing projects' paths naturally align with defaults, requiring no migration. New projects work with zero configuration. The root concept is unnecessary. Also corrects the decision from topic 01."
---

# Topic: pipeline.yml Config Granularity

## Background

The current pipeline.yml `output` block has two independent paths, `output.plans` and `output.review`, and think has introduced its own `output.analyses`. We need to decide how much configuration freedom pipeline.yml should give users. This decision depends on topic 01 (root directory choice).

## Options

### A: Configure root directory only

```yaml
output:
  root: "docs/ae/"    # single configurable item, default docs/ae/
```

Subdirectories `analyses/`, `discussions/`, `plans/`, etc. are determined internally by each skill and are not configurable.

- **Pros**: Minimal config, one line does it all; no risk of misconfigured paths; skills have fixed relative path references to each other
- **Cons**: Cannot place plans in a different location independently; least flexible

### B: Root directory + overridable subdirectories

```yaml
output:
  root: "docs/ae/"            # default root
  analyses: "analyses/"       # relative to root, overridable
  discussions: "discussions/"
  plans: "plans/"
  reviews: "reviews/"
```

- **Pros**: Balances simplicity and flexibility; most users only change root; special needs can be handled per-item
- **Cons**: More config options; overriding subdirectories may break cross-skill references

### C: Per-skill independent configuration (current direction)

```yaml
output:
  plans: "docs/milestones/"
  reviews: "results/reviews/"
  analyses: "docs/analyses/"
  discussions: "docs/discussions/"
```

- **Pros**: Maximum flexibility; suitable for projects with strong directory preferences
- **Cons**: Verbose config; no relationship between paths, easy to become scattered; no unified feel; nobody is actually using this today

### D: Semantic slots + sensible defaults, no root (option emerging from discussion)

```yaml
output:
  discussions: "docs/discussions/"   # default value
  plans: "docs/plans/"              # default value
  milestones: "docs/milestones/"    # default value
  backlog: "docs/backlog/"          # default value
  reviews: "docs/reviews/"          # default value
  analyses: "docs/analyses/"        # default value
```

No root concept needed. Each slot is independent with a sensible default. Omitting config = use default.

Key validation: SmartPal's existing `docs/discussions/`, `docs/milestones/` naturally align with the defaults — **zero migration**.

Also corrects topic 01 — no need for a `docs/ae/` isolation layer, because:
- In new projects, everything in docs/ is ae output anyway
- Adding ae/ is YAGNI
- ae outputs are project documentation and should not be isolated

- **Pros**: Works with zero config; backward compatible for existing projects; simple agent read logic (one slot, one path); no need to resolve root + relative path
- **Cons**: More config items than A (but all optional)

## Recommendation

Recommend **D: Semantic slots + sensible defaults**. This is a solution derived by working backwards from SmartPal's real use case — existing projects are naturally compatible, new projects need zero configuration. It adds the concept of "defaults" compared to option C, and removes the concept of "root" compared to options A/B.
