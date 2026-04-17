---
id: roadmap-gaps-validator-runs-checks
target: ae:roadmap
layer: 1
source: manual
---

## Context

Phase B of ae:roadmap v2 adds a `--gaps` structural validator. The validator must specify four deterministic audit types, a severity format, a CHANGELOG.md parse contract, and an explicit rule that shipped-but-misclassified items produce error-severity findings. The validator is the Phase A P1 escape prevention mechanism.

Fixture scenario (described for spec-check purposes): a BL item BL-999 sits in `.ae/backlog/closed/` but its body references "shipped in v0.7.9" and CHANGELOG.md v0.7.9 section mentions BL-999. Under Audit 1 (semantic classification), this MUST produce an error-severity finding.

## Prompt

Verify the ae:roadmap SKILL.md spec meets the Phase B `--gaps` contract: four audits, severity format, CHANGELOG parse contract documented, and the shipped-misclassified fixture scenario is explicitly described as an error-severity case.
