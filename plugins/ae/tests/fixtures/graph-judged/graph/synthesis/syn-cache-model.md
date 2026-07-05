---
id: syn-cache-model
title: "Cache model"
created: 2026-01-01
written_by: batch
state: fresh
anchors:
  - source: "src/cache.txt:1"
    anchor_hash: "The cache subsystem uses a write-through policy for all writes."
---

The cache is write-through: every write lands in the backing store
synchronously (src/cache.txt:1). The storage-view component reads from the
same backing store. Consumers still poll the cache for changes on a timer.
