#!/usr/bin/env python3
"""Copied-span detection between a proxy definition and the canonical shared references.

Granularity history, kept because each step was wrong for a reason worth not repeating:

  1. **Physical lines.** Markdown prose is hand-wrapped, so the same sentence wrapped at
     different columns in two files shares no whole line and a line-set comparison reports
     zero. Live instance (F-082): omlx-proxy.md carried "a locally-run model of a lineage
     another seat already represents is not an independent party" word-for-word from the
     canonical section, and the line check passed it.
  2. **Whole sentences.** Also wrong, and it also passed that same instance: the copy was an
     EMBEDDED span. The proxy sentence had a leading clause, the canonical one a long trailing
     clause, so as sentences they are nowhere near identical while sharing 11 verbatim words.
  3. **Shared word-runs** — what this does now. Normalise both sides to a word sequence and
     report any contiguous run of >= WINDOW words that appears in both. Wrapping, surrounding
     clauses and punctuation cannot hide it.

Remaining limit, stated rather than implied: this finds COPIED WORDING. Policy restated in
genuinely different words is semantic duplication and is not detectable here. That is the
judge's job, against the negative claim the trim record must carry per residual item.

usage: proxy-dup-sentences.py <proxy.md> <canonical.md> [<canonical.md> ...]
stdout: one line per copied span (empty output = none). exit 0 always.
"""
import re
import sys

# Calibrated, not guessed. Measured against two cases on this tree:
#   * the copy that must be caught — omlx-proxy's re-flowed sibling sentence, an 11-word
#     verbatim run ("a locally-run model of a lineage another seat already represents is")
#   * the copy that must NOT be flagged — the documented bootstrap exception, where each proxy
#     deliberately restates its ToolSearch trigger and stop-on-failure line; those share
#     runs of ~6-7 words with the canonical section by design
# 8 sits between them. Below 8 the bootstrap text trips; above 11 the real copy escapes.
WINDOW = 8

# The bootstrap exception, named rather than tuned away. Each proxy deliberately restates its
# ToolSearch trigger and the adjacent stop-on-failure line, because a rule reachable only by
# following a citation cannot be the rule that tells you to follow citations (see
# `ae:agent-teams` § Backend tool loading). Those restatements share 8-word runs with the
# canonical text by design. Raising WINDOW until they stopped showing would have hidden them —
# and would also have raised the bar past real copies of similar length. Exempting them by name
# keeps the window sensitive and keeps the exception auditable.
EXEMPT_SPANS = (
    "tools may arrive deferred listed by name schema",
    "that is the unavailable path report and",
)

FAMILY = re.compile(
    r"\b(codex|gemini|omlx|openai|google|anthropic|claude|qwen|llama|gemma|deepseek|mistral)\b",
    re.I,
)


def words(path: str):
    """Normalised word sequence for a markdown file, code blocks and frontmatter removed."""
    text = open(path, encoding="utf-8").read()
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) == 3:
            text = parts[2]
    text = re.sub(r"```.*?```", " ", text, flags=re.S)      # fenced code
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)    # links -> their text
    text = FAMILY.sub("<family>", text)
    text = re.sub(r"[^A-Za-z0-9<>/_.-]+", " ", text)
    return [w for w in text.lower().split() if w]


def runs(seq, window):
    for i in range(0, max(0, len(seq) - window + 1)):
        yield i, tuple(seq[i:i + window])


def main() -> int:
    proxy, canon_paths = sys.argv[1], sys.argv[2:]

    canon_grams = set()
    for c in canon_paths:
        try:
            cw = words(c)
        except OSError:
            continue
        canon_grams.update(g for _, g in runs(cw, WINDOW))

    pw = words(proxy)
    hits = [i for i, g in runs(pw, WINDOW) if g in canon_grams]

    # merge overlapping hit positions into maximal spans so one copy reports once
    spans = []
    for i in hits:
        if spans and i <= spans[-1][1] + 1:   # consecutive starts overlap — one copy, one report
            spans[-1][1] = i
        else:
            spans.append([i, i])

    for start, last in spans:
        span = " ".join(pw[start:last + WINDOW])
        if any(e in span for e in EXEMPT_SPANS):
            continue
        print(f"copied span ({last + WINDOW - start} words): {span[:150]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
