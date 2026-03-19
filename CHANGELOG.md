# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-03-19

### Added
- Initial release
- 7 commands: `/ae:setup`, `/ae:analyze`, `/ae:discuss`, `/ae:plan`, `/ae:work`, `/ae:code-review`, `/ae:review`
- 11 agents across 3 categories:
  - Review: architecture-reviewer, code-reviewer, performance-reviewer, security-reviewer, simplicity-reviewer
  - Research: archaeologist, dependency-analyst, standards-expert
  - Workflow: architect, challenger, qa
- 1 skill: cross-family-review (Claude + Codex + Gemini guide)
- Pipeline template for project configuration
- Support for project-specific agents via pipeline.yml `agents` config
