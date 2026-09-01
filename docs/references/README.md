# References — knowledge sources and rationale

Each entry records what was adopted from a source and what was deliberately not.

| File | What it is for | Adopted | Rejected |
|---|---|---|---|
| [cross-family-rationale.md](cross-family-rationale.md) | Why more than one model family judges the work | The self-preference / same-family bias literature, as the reason cross-family review is not optional polish | — |
| [claude-code-plugin-api.md](claude-code-plugin-api.md) | What the host actually supports | Frontmatter fields, the plugin-agent security boundary, precedence order | Three frontmatter fields measured to do nothing for plugin agents |
| [cc-plugin-contract.md](cc-plugin-contract.md) | What AE depends on in the host, and what happens if it changes | The dependency list with a failure class and mitigation per row | Rotating this document to a machine-readable format before a consumer exists |
| [hooks.md](hooks.md) | How much a firing hook can refuse | The measured enforcement table; the rule that a hook is a detector, not a gate | Placing any acceptance boundary on a hook |
| [model-effort-matrix.md](model-effort-matrix.md) | Which model and effort each skill and agent declares | Per-role assignments and the override order | — |
| [prompt-patterns.md](prompt-patterns.md) | The prompt structure AE's own agents are written in | Identity, Critical Rules, Worked Examples, Severity + rationale + nit cap | The `vibe:` pattern (measured to reach nothing); pseudo-memory; emoji-heavy prose; hardcoded external paths; oversize agents; environment-locked tool lists |
