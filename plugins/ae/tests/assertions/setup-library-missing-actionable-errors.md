---
id: setup-library-missing-actionable-errors
target: ae:setup
layer: 1
source: manual
---

## Expected Behavior

### MUST

- [file:contains:plugins/ae/skills/setup/SKILL.md] See README "Cross-machine setup" (verifies actionable hint present at all 3 edit sites — count ≥3)
- [file:contains:plugins/ae/skills/setup/SKILL.md] Cannot --add agent from missing library (verifies `--add` refuses on missing library directory — most user-facing entry point per F-005 MCE UAG)
- [file:contains:plugins/ae/skills/setup/SKILL.md] --add modifies agent state (verifies regret-hedge rationale present in `--add` message — anchors WHY refuse-vs-skip asymmetry survives future maintainers)
- [file:contains:plugins/ae/skills/setup/SKILL.md] Cannot verify drift (verifies `--sync` actionable message present — distinct from `--list` and `--add` patterns)
- [file:contains:README.md] Cross-machine setup (verifies README block exists)
- [file:contains:plugins/ae/skills/setup/SKILL.md] Skipping this library and continuing with remaining libraries (verifies `--list` continues, doesn't abort)

### MUST_NOT

- [file:contains:plugins/ae/skills/setup/SKILL.md] path missing: <source>. Skipping. (verifies old `--list` terse message at line 130 replaced; literal `<source>` is the placeholder token in SKILL.md prose)
- [file:contains:plugins/ae/skills/setup/SKILL.md] library '<library-name>' path missing. Skipping. (verifies old `--sync` terse message at line 273 replaced — distinct wording from `--list` per F-005 Doodlestein strategic + adversarial findings)
- [file:contains:README.md] --remove breaks (verifies BL-057's factually-wrong claim NOT propagated to README; `--remove` operates on local files only per setup/SKILL.md:144-158 — verified during F-005 4-grep gate)
