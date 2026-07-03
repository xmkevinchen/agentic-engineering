---
id: F-902
title: "Fixture — out-of-enum edge kind"
status: done
created: 2026-07-03
edges:
  - kind: bogus_relationship
    id: F-041
    written_by: human
---

# Fixture — invalid kind

`kind: bogus_relationship` is not in the enum. validate-feature-frontmatter.sh must fail.
