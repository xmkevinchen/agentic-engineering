# AE Plugin — Third-Party Notices

This plugin bundles components from third-party projects under their respective
licenses. Listed below.

---

## agency-agents

- **Source**: https://github.com/agency-agents/agency-agents
- **License**: MIT (https://opensource.org/licenses/MIT)
- **Bundled files**:
  - `plugins/ae/agents/engineering/minimal-change-engineer.md`
    vendored from `engineering/engineering-minimal-change-engineer.md`
    at upstream SHA `fd35c99ecc4b881d92bb9a3bf0be2d70eb06c2df`
    (snapshot at vendor date — not a live sync anchor)
    on 2026-05-08
- **Modifications from upstream**:
  - Frontmatter `name:` field changed from `Minimal Change Engineer` (Title Case with
    spaces) to `minimal-change-engineer` (kebab-case) so the resulting CC namespace
    identifier `ae:engineering:minimal-change-engineer` matches AE plugin agent
    naming convention.
  - Added HTML comment block between frontmatter and body (maintainer reference for
    future upstream merges). Block content:
    ```
    <!-- F-011 vendor: agency-agents/engineering/engineering-minimal-change-engineer.md
         Upstream SHA: fd35c99ecc4b881d92bb9a3bf0be2d70eb06c2df
         Bundled: 2026-05-08
         Modifications: (a) name: kebab-case, (b) this comment block -->
    ```
  - All other frontmatter fields and body content are byte-identical to upstream.

- **Maintenance rule for this section**: any future modification to a vendored file
  (frontmatter, body, or new metadata) MUST update the `Modifications from upstream`
  list above to keep attribution complete. Do not silently fork.

Original copyright and permission notice (MIT):

```
MIT License

Copyright (c) agency-agents contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```
