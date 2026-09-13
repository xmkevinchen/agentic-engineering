---
discuss: {}
---

# Sample problem (incomplete, sitting under the CONFIGURED root)

Deliberately missing `acceptance.md` and any `ended:` marker, so `check-stage-delivery.py`
reports it as not delivered. A hook that correctly resolves the configured root finds this one
and refuses the invocation; a hook still hardcoded to `.ae` finds the sibling under `.ae/`
instead, which is complete, and wrongly allows it.
